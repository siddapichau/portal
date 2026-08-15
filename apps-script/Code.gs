/**
 * ============================================================================
 *  PORTAL DE REPORTES — Backend Google Sheets (substituto do Firebase)
 * ============================================================================
 *  Este script transforma um Google Sheets em banco de dados do portal,
 *  expondo uma API REST **compatível com o formato que o portal já usa**.
 *
 *  COMO IMPLANTAR:
 *   1. Crie um Google Sheets novo.
 *   2. Extensões -> Apps Script -> cole este arquivo -> Salvar.
 *   3. Rode `setupPortal()` UMA vez (autorize) — cria as abas + dados iniciais.
 *   4. (Opcional) rode `importarDoFirebase()` para migrar os dados atuais.
 *   5. Implantar -> Nova implantação -> Aplicativo da web
 *      - Executar como: Eu
 *      - Quem tem acesso: Qualquer pessoa
 *   6. Copie a URL `/exec` e cole em `js/portal-db.js` (PortalDB.URL).
 *
 *  CONTRATO DA API (idêntico ao Firebase REST, para troca transparente):
 *     GET    /{node}.json            -> { "chave": {registro}, ... }  (ou null)
 *     GET    /{node}/{chave}.json    -> {registro}                    (ou null)
 *     POST   /{node}.json            -> cria registro  (retorna { "name": chave })
 *     PUT    /{node}/{chave}.json    -> substitui o registro na chave
 *     PATCH  /{node}/{chave}.json    -> mescla campos no registro
 *     DELETE /{node}/{chave}.json    -> remove o registro
 *
 *  Observação: o App Script só expõe doGet/doPost. O front (js/portal-db.js)
 *  traduz PUT/PATCH/DELETE para POST com body { __method, __path, __body }.
 * ============================================================================
 */

var FIREBASE_URL_ORIGEM = 'https://reportes-bdb0a-default-rtdb.firebaseio.com/';

// Mapa "nó lógico -> nome da aba" (abas amigáveis). Nós não mapeados viram
// uma aba "db_<nó>" automaticamente (usado pelas páginas de reporte).
var NODE_TO_SHEET = {
  menu_global: 'Menu',
  users: 'Usuarios',
  cargos: 'Cargos',
  funcoes: 'Funcoes',
  portal_news: 'Noticias',
  portal_status: 'Status',
  portal_bigquery: 'BigQuery',
  logs: 'Logs',
  presence: 'Presenca',
  user_bookmarks: 'Favoritos'
};

var CONFIG_SHEET = '_Config';

// ---------------------------------------------------------------------------
// ENTRY POINTS (REST)
// ---------------------------------------------------------------------------

function doGet(e) {
  var parsed = parsePath_(e && e.pathInfo);
  if (!parsed.node) return jsonResponse_({ error: 'Rota inválida' });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (parsed.key !== null) {
      return jsonResponse_(readRecord_(parsed.node, parsed.key));
    }
    return jsonResponse_(readNode_(parsed.node));
  } catch (err) {
    return jsonResponse_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var body = null;
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) { body = null; }

  var method = 'POST';
  var pathInfo = e && e.pathInfo ? e.pathInfo : '';
  var payload = body;

  // Escrita traduzida pelo front (PUT/PATCH/DELETE -> POST com __method)
  if (body && typeof body === 'object' && body.__method) {
    method = String(body.__method).toUpperCase();
    pathInfo = body.__path || '';
    payload = body.__body !== undefined ? body.__body : null;
  }

  var parsed = parsePath_(pathInfo);
  if (!parsed.node) return jsonResponse_({ error: 'Rota inválida' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    switch (method) {
      case 'POST': // criar
        if (parsed.key !== null) return jsonResponse_({ error: 'POST deve usar a coleção' });
        var newKey = createRecord_(parsed.node, payload || {});
        return jsonResponse_({ name: newKey });

      case 'PUT': // substituir
        if (parsed.key === null) {
          // PUT na raiz = substituir a coleção inteira (ex.: menu_global)
          return jsonResponse_(replaceNode_(parsed.node, payload || {}));
        }
        return jsonResponse_(writeRecord_(parsed.node, parsed.key, payload || {}));

      case 'PATCH': // mesclar
        if (parsed.key === null) return jsonResponse_({ error: 'PATCH exige chave' });
        return jsonResponse_(patchRecord_(parsed.node, parsed.key, payload || {}));

      case 'DELETE':
        if (parsed.key === null) return jsonResponse_({ error: 'DELETE exige chave' });
        deleteRecord_(parsed.node, parsed.key);
        return jsonResponse_(null);

      default:
        return jsonResponse_({ error: 'Método não suportado: ' + method });
    }
  } catch (err) {
    return jsonResponse_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// HELPERS DE ROTA
// ---------------------------------------------------------------------------

function parsePath_(pathInfo) {
  var p = String(pathInfo || '').replace(/^\/+/, '').replace(/\.json$/, '');
  var parts = p.split('/').filter(function (x) { return x.length > 0; });
  return {
    node: parts[0] || '',
    key: parts.length > 1 ? parts.slice(1).join('/') : null
  };
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj === undefined ? null : obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeSheetName_(name) {
  var s = String(name).replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 80);
  return s.length ? s : 'dados';
}

function sheetNameForNode_(node) {
  if (NODE_TO_SHEET[node]) return NODE_TO_SHEET[node];
  return 'db_' + sanitizeSheetName_(node);
}

function getSheetForNode_(node) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameForNode_(node);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['key', 'json']);
  }
  return sheet;
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

function readNode_(node) {
  var sheet = getSheetForNode_(node);
  var last = sheet.getLastRow();
  var result = {};
  if (last < 2) return result; // só cabeçalho

  var rows = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0]).trim();
    if (!key) continue;
    result[key] = parseJsonCell_(rows[i][1]);
  }
  return result;
}

function readRecord_(node, key) {
  var sheet = getSheetForNode_(node);
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) {
      return parseJsonCell_(sheet.getRange(i + 2, 2).getValue());
    }
  }
  return null;
}

function parseJsonCell_(value) {
  if (value === null || value === undefined || value === '') return {};
  try { return JSON.parse(String(value)); } catch (e) { return {}; }
}

// ---------------------------------------------------------------------------
// ESCRITA
// ---------------------------------------------------------------------------

function generateKey_() {
  // ID compacto e seguro para URL (estilo push-id do Firebase)
  var chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  var out = [];
  var ts = Date.now();
  for (var i = 7; i >= 0; i--) { out.push(chars.charAt(ts % 62)); ts = Math.floor(ts / 62); }
  for (var j = 0; j < 12; j++) out.push(chars.charAt(Math.floor(Math.random() * 62)));
  return out.join('');
}

function createRecord_(node, record) {
  var sheet = getSheetForNode_(node);
  var key = generateKey_();
  sheet.appendRow([key, JSON.stringify(record)]);
  return key;
}

function writeRecord_(node, key, record) {
  var sheet = getSheetForNode_(node);
  var row = findRowByKey_(sheet, key);
  if (row === -1) sheet.appendRow([key, JSON.stringify(record)]);
  else {
    sheet.getRange(row, 2).setValue(JSON.stringify(record));
  }
  return record;
}

function patchRecord_(node, key, patch) {
  var current = readRecord_(node, key) || {};
  var merged = Object.assign({}, current, patch);
  writeRecord_(node, key, merged);
  return merged;
}

function replaceNode_(node, records) {
  var sheet = getSheetForNode_(node);
  sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 2).clearContent();
  var rows = [];
  if (records && typeof records === 'object') {
    for (var k in records) {
      if (Object.prototype.hasOwnProperty.call(records, k)) rows.push([k, JSON.stringify(records[k])]);
    }
  }
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  return records;
}

function deleteRecord_(node, key) {
  var sheet = getSheetForNode_(node);
  var row = findRowByKey_(sheet, key);
  if (row !== -1) sheet.deleteRow(row);
}

function findRowByKey_(sheet, key) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) return i + 2;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// SETUP — cria a planilha com todas as abas + dados de exemplo
// ---------------------------------------------------------------------------

function setupPortal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureConfig_(ss);
  ensureSheetWithHeader_(ss, 'Usuarios');
  ensureSheetWithHeader_(ss, 'Cargos');
  ensureSheetWithHeader_(ss, 'Funcoes');
  ensureSheetWithHeader_(ss, 'Menu');
  ensureSheetWithHeader_(ss, 'Noticias');
  ensureSheetWithHeader_(ss, 'Status');
  ensureSheetWithHeader_(ss, 'BigQuery');
  ensureSheetWithHeader_(ss, 'Logs');
  ensureSheetWithHeader_(ss, 'Presenca');
  ensureSheetWithHeader_(ss, 'Favoritos');

  // Seed de Cargos (catálogo de níveis de acesso)
  var cargos = {
    view:   { rotulo: 'Viewer',      nivel: 1, descricao: 'Somente visualização básica' },
    view2:  { rotulo: 'View Plus',   nivel: 2, descricao: 'Visualização ampliada' },
    editor: { rotulo: 'Editor',      nivel: 3, descricao: 'Pode subir/editar dados' },
    admin:  { rotulo: 'Admin',       nivel: 4, descricao: 'Acesso total ao painel' }
  };
  seedIfEmpty_('cargos', cargos);

  // Seed de Funcoes (catálogo de funções/áreas)
  var funcoes = {
    inventario:  { rotulo: 'Inventário',    descricao: 'Controle de equipamentos e insumos' },
    aduana:      { rotulo: 'Aduana',        descricao: 'Processos de aduana' },
    tratativas:  { rotulo: 'Tratativas',    descricao: 'E-mails e tratativas' },
    logistica:   { rotulo: 'Logística',     descricao: 'Operações de percurso e avarias' }
  };
  seedIfEmpty_('funcoes', funcoes);

  Logger.log('Setup concluído! Abas criadas em: ' + ss.getUrl());
}

function ensureConfig_(ss) {
  var c = ss.getSheetByName(CONFIG_SHEET);
  if (!c) {
    c = ss.insertSheet(CONFIG_SHEET);
    c.appendRow(['chave', 'valor']);
    c.appendRow(['versao', '1.0']);
    c.appendRow(['origem_firebase', FIREBASE_URL_ORIGEM]);
    c.appendRow(['migrado', 'nao']);
  }
}

function ensureSheetWithHeader_(ss, name) {
  if (!ss.getSheetByName(name)) {
    var s = ss.insertSheet(name);
    s.appendRow(['key', 'json']);
  }
}

function seedIfEmpty_(node, records) {
  var sheet = getSheetForNode_(node);
  if (sheet.getLastRow() > 1) return; // já tem dados, não sobrescreve
  for (var k in records) {
    if (Object.prototype.hasOwnProperty.call(records, k)) {
      sheet.appendRow([k, JSON.stringify(records[k])]);
    }
  }
}

// ---------------------------------------------------------------------------
// MIGRAÇÃO — copia os dados atuais do Firebase para a planilha
// ---------------------------------------------------------------------------

var NODES_PARA_MIGRAR = [
  'menu_global', 'users', 'portal_news', 'portal_status', 'portal_bigquery',
  'logs', 'presence', 'user_bookmarks',
  // páginas de reporte (Fase 2) — descomente conforme migrar:
  // 'equipamentos', 'aderencia', 'devolucao', 'ofensores',
  // 'salvados_aprendizado', 'salvados_encontrados', 'salvados_ia_config',
  // 'salvados_ia_keys', 'emails_tratativas', 'insumos',
  // 'parado_percurso', 'parado_percurso_emails', 'pendencias_cftv_consolidado',
  // 'poka_avarias_diario', 'salvados_recuperados'
];

function importarDoFirebase() {
  var total = 0;
  for (var i = 0; i < NODES_PARA_MIGRAR.length; i++) {
    var node = NODES_PARA_MIGRAR[i];
    try {
      var resp = UrlFetchApp.fetch(FIREBASE_URL_ORIGEM + node + '.json', { muteHttpExceptions: true });
      var data = JSON.parse(resp.getContentText());
      if (!data) continue;

      var records = Array.isArray(data) ? data : (typeof data === 'object' ? data : {});
      if (Array.isArray(records)) {
        records = records.filter(Boolean).reduce(function (acc, v, idx) { acc['arr_' + idx] = v; return acc; }, {});
      }
      var sheet = getSheetForNode_(node);
      var rows = [];
      for (var k in records) {
        if (Object.prototype.hasOwnProperty.call(records, k)) rows.push([k, JSON.stringify(records[k])]);
      }
      if (rows.length) {
        sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 2).clearContent();
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      }
      total += rows.length;
    } catch (err) {
      Logger.log('Falha ao migrar ' + node + ': ' + err);
    }
  }
  Logger.log('Migração concluída. Registros importados: ' + total);
}

// Atalho no menu da planilha
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Portal')
    .addItem('1. Configurar abas (setup)', 'setupPortal')
    .addItem('2. Importar do Firebase', 'importarDoFirebase')
    .addToUi();
}
