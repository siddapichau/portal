/**
 * ============================================================================
 *  PORTAL DE REPORTES — Backend 100% Google Sheets ("cérebro" do portal)
 * ============================================================================
 *  Este Apps Script transforma uma planilha Google Sheets no banco de dados
 *  do portal, expondo uma API REST compatível com o formato que o portal
 *  já usava (contrato Firebase REST). O portal NÃO fala mais com Firebase —
 *  a ÚNICA conexão com Firebase que existe está AQUI DENTRO, usada apenas
 *  pelas funções de IMPORTAÇÃO dos dados já existentes.
 *
 *  ⚠️ DEPOIS DE COLAR ESTE ARQUIVO: Implantar → Gerenciar implantações
 *     → lápis → Nova versão → Implantar. Sem isso o portal continua mudo.
 *
 *  ┌─ COMO IMPLANTAR ────────────────────────────────────────────────────────
 *  │  1. Crie um Google Sheets novo (ex.: "Portal — Cérebro").
 *  │  2. Extensões → Apps Script → cole este arquivo → Salvar.
 *  │  3. No menu da planilha "⚙️ Portal" → "1️⃣ Preparar planilha" (autorize).
 *  │     Isso cria SÓ as abas do cérebro (Menu, Usuarios, Noticias, Status,
 *  │     Logs, Config...). NÃO cria mais abas db_* — o DB de cada página
 *  │     fica na planilha dela e será ligado no futuro.
 *  │  4. Se a planilha já tiver abas db_*: ⚙️ Portal → 🧹 Remover abas db_*.
 *  │  5. Importe o NÚCLEO parte a parte (Usuários, Menu, Notícias, Status…).
 *  │  6. Implantar → Nova implantação (ou Nova versão) → Aplicativo da web
 *  │     → Executar como: EU → Acesso: QUALQUER PESSOA → copie a URL /exec.
 *  │  7. Cole a URL /exec em js/portal-db.js (PortalDB.URL). Pronto.
 *  │
 *  │  Teste rápido: abra a URL /exec no navegador. Deve aparecer um JSON
 *  │  { ok:true, nodes:{ menu_global:{registros:N}, ... } } — não "Rota inválida".
 *  └─────────────────────────────────────────────────────────────────────────
 *
 *  FORMATO DAS ABAS — planilha de verdade (NÃO é mais "key | json"):
 *     linha 1  = cabeçalho com os NOMES DOS CAMPOS (coluna A sempre "id")
 *     linha 2+ = um registro por linha, um campo por coluna
 *        Usuarios:  id | usuario | nome | sobrenome | email | telefone | cargo | ...
 *        Menu:      id | tipo | categoria | pai | ordem | titulo | url | icone | ...
 *     Campos compostos (objetos/arrays) ficam como texto JSON na célula e
 *     são convertidos de volta para objeto automaticamente na leitura da API.
 *
 *  CONTRATO DA API (o portal não mudou — troca transparente):
 *     GET    /exec?path={node}.json            -> coleção (ou null)
 *     GET    /exec?path={node}/{chave}.json    -> registro (ou null)
 *     GET    /exec?path={node}.json&orderBy="campo"&limitToLast=50
 *     POST   /exec  body { __method, __path, __body }  (PUT/PATCH/DELETE/POST)
 *
 *  Por que ?path= e não /exec/{node}.json ?
 *     pathInfo depois de /exec/ exige login Google mesmo com a implantação
 *     "Qualquer pessoa". Query string é pública e é o que o portal-db.js envia.
 *
 *  Observação: o Apps Script só expõe doGet/doPost. O front (js/portal-db.js)
 *  traduz PUT/PATCH/DELETE para POST com body { __method, __path, __body }.
 * ============================================================================
 */

// ⚠️ ÚNICA referência ao Firebase em todo o projeto — usada SOMENTE pelas
// funções de importação (menu "📥 Importar"). O portal web nunca acessa.
var FIREBASE_URL_ORIGEM = 'https://reportes-bdb0a-default-rtdb.firebaseio.com/';

// Mapa "nó lógico -> nome da aba". ESTA PLANILHA É SÓ O CÉREBRO DO PORTAL.
// Nós de páginas (equipamentos, aderência…) NÃO moram aqui — cada um virá
// da planilha própria da página, no futuro. Pedidos a nós desconhecidos
// devolvem null e NÃO criam aba db_*.
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
  user_bookmarks: 'Favoritos',
  config: '_Config'
};

var CONFIG_SHEET = '_Config';

// Cabeçalhos preferidos por aba (ordem amigável p/ quem edita na mão).
// A coluna "id" é SEMPRE a primeira (guarda a chave única do registro).
var PREFERRED_HEADERS = {
  menu_global: ['id', 'tipo', 'categoria', 'pai', 'ordem', 'titulo', 'url', 'icone', 'viewRoles', 'uploadRoles', 'allowedUsers'],
  users: ['id', 'usuario', 'nome', 'sobrenome', 'email', 'telefone', 'cargo', 'solicitacao', 'favorito', 'avatar', 'senha'],
  cargos: ['id', 'rotulo', 'nivel', 'descricao'],
  funcoes: ['id', 'rotulo', 'descricao'],
  portal_news: ['id', 'titulo', 'corpo', 'autor', 'tag', 'data', 'likes', 'likedBy', 'data_edit'],
  portal_status: ['id', 'nome', 'estado', 'descricao', 'icon', 'lastUpdate'],
  portal_bigquery: ['id', 'titulo', 'categoria', 'tags', 'descricao', 'codigo_sql', 'corpo_post', 'autor', 'data', 'data_edit'],
  logs: ['id', 'timestamp', 'usuario', 'avatar', 'modulo', 'acao', 'tipo'],
  presence: ['id', 'lastSeen', 'cargo', 'pagina'],
  user_bookmarks: ['id', 'pagina', 'nome', 'atualizadoEm'],
  config: ['chave', 'valor']
};

// ---------------------------------------------------------------------------
// LISTAS DE IMPORTAÇÃO (um item de menu para cada parte — nunca tudo junto)
// ---------------------------------------------------------------------------

var IMPORT_NUCLEO = [
  ['users', '🔑 Usuários'],
  ['menu_global', '🧭 Menu'],
  ['cargos', '🏷️ Cargos'],
  ['funcoes', '💼 Funções'],
  ['portal_news', '📰 Notícias'],
  ['portal_status', '📊 Status dos reportes'],
  ['portal_bigquery', '🗄️ BigQuery'],
  ['logs', '📜 Logs (radar de atividades)'],
  ['presence', '🟢 Presença (quem está online)'],
  ['user_bookmarks', '⭐ Favoritos (cofre)']
];

// Catálogo das páginas — NÃO é importado nesta planilha.
// Cada página puxará o DB da planilha que já existe dela (fase futura).
var IMPORT_PAGINAS = [
  ['equipamentos', '🖥️ Equipamentos'],
  ['aderencia', '📈 Aderência'],
  ['aderencia_historico', '📈 Aderência — histórico'],
  ['ofensores', '📉 Ofensores (aderência 2)'],
  ['devolucao', '↩️ Devolução (aging)'],
  ['envios_diarios_v8', '📦 Expedir devolução (envios diários)'],
  ['salvados_aprendizado', '🧠 Salvados — aprendizado'],
  ['salvados_encontrados', '🔎 Salvados — encontrados'],
  ['salvados_ia_config', '⚙️ Salvados — config IA'],
  ['salvados_ia_keys', '🗝️ Salvados — chaves IA'],
  ['salvados_recuperados', '♻️ Salvados — recuperados'],
  ['emails_tratativas', '✉️ E-mails tratativas'],
  ['insumos', '🧾 Insumos / contagem'],
  ['parado_percurso', '🚚 Parado em percurso'],
  ['parado_percurso_emails', '✉️ Parado em percurso — e-mails'],
  ['pendencias_cftv_consolidado', '🎥 Pendências CFTV'],
  ['poka_avarias_diario', '📋 Poka avarias — diário'],
  ['poka_avarias_consolidado_v3', '📊 Poka avarias — consolidado'],
  ['poka_aduanas_pacotes', '🛃 Aduana — pacotes'],
  ['poka_aduanas_resumo', '🛃 Aduana — resumo'],
  ['bpp_inventariado_v2', '📝 BPP — inventariado'],
  ['inventario_dhs_separado_v1', '🗃️ Inventário DHS']
];

// Parâmetros da importação em lotes (para não estourar os limites do Google):
var IMPORT_PAGE = 200;               // registros por requisição ao Firebase
var IMPORT_MAX_MS = 4.5 * 60 * 1000; // para antes do limite de 6 min/execução
var IMPORT_CHUNK = 500;              // linhas gravadas por batelada na planilha
var PROP_CURSOR = 'portal_imp_cursor_'; // prefixo da propriedade de "continuação"
var PROP_TOTAL = 'portal_imp_total_';

// ---------------------------------------------------------------------------
// ENTRY POINTS (REST)
// ---------------------------------------------------------------------------

function doGet(e) {
  var parsed = parsePath_(resolvePath_(e));
  if (!parsed.node) return jsonResponse_(healthPayload_());

  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(8000); } catch (lockErr) { locked = false; }
  try {
    var data;
    if (parsed.key !== null) data = readRecord_(parsed.node, parsed.key);
    else data = readNode_(parsed.node);
    data = applyQueryParams_(data, e && e.parameter);
    return jsonResponse_(data);
  } catch (err) {
    return jsonResponse_({ error: String(err) });
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (relErr) {}
    }
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

// Aceita pathInfo (legado) OU ?path=menu_global.json (o que o portal realmente envia).
function resolvePath_(e) {
  if (e && e.parameter && e.parameter.path) return String(e.parameter.path);
  if (e && e.parameter && e.parameter.n) return String(e.parameter.n);
  if (e && e.pathInfo) return String(e.pathInfo);
  return '';
}

function parsePath_(pathInfo) {
  var p = String(pathInfo || '').replace(/^\/+/, '').replace(/\.json$/, '');
  var parts = p.split('/').filter(function (x) { return x.length > 0; });
  return {
    node: parts[0] || '',
    key: parts.length > 1 ? parts.slice(1).join('/') : null
  };
}

function isNucleo_(node) {
  return !!NODE_TO_SHEET[node];
}

function recusarPagina_(node) {
  return 'Nó "' + node + '" não pertence ao cérebro desta planilha. ' +
    'Menu, notícias, usuários e status ficam aqui. ' +
    'O DB de cada página virá da planilha própria dela (fase futura).';
}

function listarAbasDb_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var extras = [];
  ss.getSheets().forEach(function (s) {
    var name = s.getName();
    if (name.indexOf('db_') === 0) extras.push(name);
  });
  return extras;
}

function healthPayload_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nodes = {};
  Object.keys(NODE_TO_SHEET).forEach(function (node) {
    var name = NODE_TO_SHEET[node];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      nodes[node] = { aba: name, existe: false, registros: 0 };
    } else {
      nodes[node] = { aba: name, existe: true, registros: Math.max(0, sh.getLastRow() - 1) };
    }
  });
  return {
    ok: true,
    service: 'portal-cerebro',
    versao: '2.2-cerebro',
    planilha: ss.getName(),
    nodes: nodes,
    versao_por_no: getVersaoPorNo_(),
    abas_db_sobrando: listarAbasDb_(),
    uso: 'GET /exec?path=menu_global.json'
  };
}

// ---------------------------------------------------------------------------
// VERSIONAMENTO POR NÓ (invalidação do cache do navegador)
// ---------------------------------------------------------------------------
// Cada vez que um nó do cérebro é ALTERADO, incrementamos o contador "v_<nó>"
// na aba _Config. O front guarda em localStorage o conteúdo + a versão; se a
// versão mudar ele descarta o cache daquele nó e busca de novo — mas SEM tocar
// no login (que fica em outra chave do localStorage).

function readConfigValue_(sheet, chave) {
  if (!sheet) return '';
  var last = sheet.getLastRow();
  if (last >= 2) {
    var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
    var vals = sheet.getRange(2, 2, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === chave) return String(vals[i][0]);
    }
  }
  return '';
}

function getVersaoNo_(node) {
  try {
    var c = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    return parseInt(readConfigValue_(c, 'v_' + node) || '0', 10) || 0;
  } catch (e) { return 0; }
}

function getVersaoPorNo_() {
  var out = {};
  Object.keys(NODE_TO_SHEET).forEach(function (node) {
    out[node] = getVersaoNo_(node);
  });
  return out;
}

function bumpVersao_(node) {
  if (!node || !isNucleo_(node)) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var c = ss.getSheetByName(CONFIG_SHEET);
    if (!c) c = ensureConfig_(ss); // só cria se ainda não existir
    var n = parseInt(readConfigValue_(c, 'v_' + node) || '0', 10) || 0;
    setConfigValue_(c, 'v_' + node, n + 1);
  } catch (e) { /* versão é otimização; falhar não quebra a escrita */ }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj === undefined ? null : obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetNameForNode_(node) {
  return NODE_TO_SHEET[node] || null;
}

function headersForNode_(node) {
  return (PREFERRED_HEADERS[node] || ['id', 'valor']).slice();
}

// Cria a aba do nó do CÉREBRO (se não existir). Nós de página: não cria db_*.
function getSheetForNode_(node, optCreate) {
  if (!isNucleo_(node)) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameForNode_(node);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    if (optCreate === false) return null;
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    writeHeaderRow_(sheet, headersForNode_(node));
  }
  return sheet;
}

function writeHeaderRow_(sheet, headers) {
  ensureCapacity_(sheet, 2, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e3c72')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 190);
}

function ensureCapacity_(sheet, minRows, minCols) {
  if (sheet.getMaxColumns() < minCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minCols - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }
}

// Lê o cabeçalho (linha 1) de uma aba. Garante coluna "id" em A1.
function readHeaders_(sheet) {
  var nCols = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, nCols).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  if (!headers[0]) { headers[0] = 'id'; sheet.getRange(1, 1).setValue('id'); }
  // corta colunas vazias no fim
  while (headers.length > 1 && headers[headers.length - 1] === '') headers.pop();
  return headers;
}

// ---------------------------------------------------------------------------
// CODEC — planilha colunar  ⇄  JSON (o coração da Fase 2)
// ---------------------------------------------------------------------------

// Célula -> valor JS. Texto que "parece JSON" ( {…} ou […] ) vira objeto/array.
function cellToValue_(v) {
  if (typeof v !== 'string') return v;
  var t = v.replace(/^\s+|\s+$/g, '');
  var first = t.charAt(0), last = t.charAt(t.length - 1);
  if ((first === '{' && last === '}') || (first === '[' && last === ']')) {
    try { return JSON.parse(t); } catch (e) { /* não era JSON de verdade */ }
  }
  return v;
}

// Valor JS -> conteúdo da célula (objetos/arrays viram texto JSON).
function valueToCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// Linha da planilha -> registro. Retorna { found, id, value }.
function rowToRecord_(headers, row) {
  var id = String(row[0]).replace(/^\s+|\s+$/g, '');
  if (!id) return { found: false };
  // Aba "chave | valor" simples (registros primitivos, ex.: chaves de IA)
  if (headers.length === 2 && headers[1] === 'valor') {
    return { found: true, id: id, value: cellToValue_(row[1]) };
  }
  var obj = {};
  for (var c = 1; c < headers.length; c++) {
    var v = row[c];
    if (v === '' || v === null || v === undefined) continue;
    obj[headers[c]] = cellToValue_(v);
  }
  return { found: true, id: id, value: obj };
}

// Registro -> linha da planilha (array alinhado aos cabeçalhos).
function recordToRow_(headers, id, record) {
  var row = new Array(headers.length);
  row[0] = id;
  if (record === null || typeof record !== 'object') {
    // primitivo: usa a coluna "valor" quando existir
    for (var c = 1; c < headers.length; c++) row[c] = (headers[c] === 'valor') ? valueToCell_(record) : '';
    return row;
  }
  for (var i = 1; i < headers.length; i++) {
    row[i] = valueToCell_(record[headers[i]]);
  }
  return row;
}

// Garante que todos os campos do registro existam como colunas na aba.
// Acrescenta colunas novas ao final do cabeçalho quando surgir campo novo.
function ensureFields_(sheet, headers, records) {
  var missing = [];
  for (var r = 0; r < records.length; r++) {
    var rec = records[r];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
    for (var field in rec) {
      if (Object.prototype.hasOwnProperty.call(rec, field) && headers.indexOf(field) === -1 && missing.indexOf(field) === -1) {
        missing.push(field);
      }
    }
  }
  if (!missing.length) return headers;
  var startCol = headers.length + 1;
  ensureCapacity_(sheet, 1, headers.length + missing.length);
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  sheet.getRange(1, startCol, 1, missing.length)
    .setFontWeight('bold').setBackground('#1e3c72').setFontColor('#ffffff');
  return headers.concat(missing);
}

// ---------------------------------------------------------------------------
// CODEC ESPECIAL — Menu (menu_global  ⇄  aba "Menu" achatada em 3 níveis)
// ---------------------------------------------------------------------------
// Aba Menu: id | tipo | categoria | pai | ordem | titulo | url | icone |
//           viewRoles | uploadRoles | allowedUsers
//   tipo = categoria (1º nível) | item (2º nível) | subitem (3º nível)
//   id   = cat0  |  cat0/item2  |  cat0/item2/sub1

function flattenMenu_(menu) {
  var rows = [];
  if (!menu || !menu.categorias) return rows;
  for (var ci = 0; ci < menu.categorias.length; ci++) {
    var cat = menu.categorias[ci] || {};
    var catId = 'cat' + ci;
    rows.push([catId, 'categoria', '', '', ci,
      cat.category || '', '', cat.icon || '', cat.viewRoles || '', '', '']);
    var items = cat.items || [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii] || {};
      var itemId = catId + '/item' + ii;
      rows.push([itemId, 'item', cat.category || '', catId, ii,
        item.title || '', item.url || '', item.icon || '',
        item.viewRoles || '', item.uploadRoles || '', item.allowedUsers || '']);
      var subs = item.subItems || [];
      for (var si = 0; si < subs.length; si++) {
        var sub = subs[si] || {};
        rows.push([itemId + '/sub' + si, 'subitem', cat.category || '', itemId, si,
          sub.title || '', sub.url || '', sub.icon || '',
          sub.viewRoles || '', sub.uploadRoles || '', sub.allowedUsers || '']);
      }
    }
  }
  return rows;
}

function unflattenMenu_(rows) {
  var menu = { categorias: [] };
  var catById = {}, itemById = {};
  var semCategoria = null;
  function getSemCategoria() {
    if (!semCategoria) {
      semCategoria = { category: 'Sem categoria', icon: '📦', viewRoles: 'view,view2,editor,admin', items: [] };
      menu.categorias.push(semCategoria);
    }
    return semCategoria;
  }
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = String(r[0] || '');
    var tipo = String(r[1] || '').toLowerCase();
    var pai = String(r[3] || '');
    if (!id || !tipo) continue;

    if (tipo === 'categoria') {
      var cat = { category: r[5] || '', icon: r[7] || '', viewRoles: r[8] || '', items: [] };
      menu.categorias.push(cat);
      catById[id] = cat;
    } else if (tipo === 'item') {
      var parentCat = catById[pai] || getSemCategoria();
      var item = {
        icon: r[7] || '', title: r[5] || '', url: r[6] || '',
        viewRoles: r[8] || '', uploadRoles: r[9] || '', allowedUsers: r[10] || '',
        subItems: []
      };
      parentCat.items.push(item);
      itemById[id] = item;
    } else if (tipo === 'subitem') {
      var parentItem = itemById[pai];
      if (!parentItem) continue; // órfão: ignora com segurança
      parentItem.subItems.push({
        icon: r[7] || '', title: r[5] || '', url: r[6] || '',
        viewRoles: r[8] || '', uploadRoles: r[9] || '', allowedUsers: r[10] || ''
      });
    }
  }
  return menu;
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

function readNode_(node) {
  if (!isNucleo_(node)) return null;

  if (node === 'menu_global') {
    var sheetMenu = getSheetForNode_(node, false);
    if (!sheetMenu) return { categorias: [] };
    return unflattenMenu_(readDataRows_(sheetMenu));
  }

  var sheet = getSheetForNode_(node, false);
  if (!sheet) return null;
  var headers = readHeaders_(sheet);
  var last = sheet.getLastRow();
  var result = {};
  if (last < 2) return null;

  // Lê em blocos de 1000 linhas — aguenta abas enormes sem estourar memória.
  var CHUNK = 1000;
  for (var start = 2; start <= last; start += CHUNK) {
    var n = Math.min(CHUNK, last - start + 1);
    var rows = sheet.getRange(start, 1, n, headers.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var rec = rowToRecord_(headers, rows[i]);
      if (rec.found) result[rec.id] = rec.value;
    }
  }
  return Object.keys(result).length ? result : null;
}

function readDataRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var nCols = Math.max(1, sheet.getLastColumn());
  var out = [];
  var CHUNK = 1000;
  for (var start = 2; start <= last; start += CHUNK) {
    var n = Math.min(CHUNK, last - start + 1);
    var rows = sheet.getRange(start, 1, n, nCols).getValues();
    for (var i = 0; i < rows.length; i++) out.push(rows[i]);
  }
  return out;
}

function readRecord_(node, key) {
  if (!isNucleo_(node)) return null;

  if (node === 'menu_global') {
    var menu = readNode_('menu_global');
    if (key === 'categorias') return menu.categorias;
    return menu[key] !== undefined ? menu[key] : null;
  }

  var sheet = getSheetForNode_(node, false);
  if (!sheet) return null;
  var headers = readHeaders_(sheet);
  var rowNum = findRowByKey_(sheet, key);
  if (rowNum === -1) return null;
  var row = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  var rec = rowToRecord_(headers, row);
  return rec.found ? rec.value : null;
}

// Simula os parâmetros do Firebase REST (?orderBy="campo"&limitToLast=50)
function applyQueryParams_(data, params) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !params) return data;
  var orderBy = params.orderBy;
  var limitFirst = parseInt(params.limitToFirst, 10);
  var limitLast = parseInt(params.limitToLast, 10);
  if (!orderBy && isNaN(limitFirst) && isNaN(limitLast)) return data;

  var entries = [];
  for (var k in data) {
    if (Object.prototype.hasOwnProperty.call(data, k)) entries.push([k, data[k]]);
  }
  if (orderBy) {
    var field = String(orderBy).replace(/^["']+|["']+$/g, '');
    entries.sort(function (a, b) {
      var va = (field === '$key') ? a[0] : (a[1] != null && typeof a[1] === 'object') ? a[1][field] : a[1];
      var vb = (field === '$key') ? b[0] : (b[1] != null && typeof b[1] === 'object') ? b[1][field] : b[1];
      if (va === vb) return 0;
      if (va === undefined || va === null) return -1;
      if (vb === undefined || vb === null) return 1;
      return va < vb ? -1 : 1;
    });
  }
  if (!isNaN(limitFirst)) entries = entries.slice(0, limitFirst);
  if (!isNaN(limitLast)) entries = entries.slice(-limitLast);
  var out = {};
  for (var i = 0; i < entries.length; i++) out[entries[i][0]] = entries[i][1];
  return out;
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
  var key = generateKey_();
  writeRecord_(node, key, record);
  return key;
}

function assertNucleo_(node) {
  if (!isNucleo_(node)) throw new Error(recusarPagina_(node));
}

function writeRecord_(node, key, record) {
  assertNucleo_(node);
  if (node === 'menu_global') {
    // Escrita unitária não se aplica ao menu achatado; só coleção inteira.
    if (key === 'categorias') return replaceNode_(node, { categorias: record });
    var menu = readNode_('menu_global');
    menu[key] = record;
    return replaceNode_(node, menu);
  }

  var sheet = getSheetForNode_(node);
  var headers = readHeaders_(sheet);
  headers = ensureFields_(sheet, headers, [record]);
  var row = recordToRow_(headers, key, record);
  var rowNum = findRowByKey_(sheet, key);
  if (rowNum === -1) {
    var target = sheet.getLastRow() + 1;
    ensureCapacity_(sheet, target, headers.length);
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.getRange(rowNum, 1, 1, headers.length).setValues([row]);
  }
  bumpVersao_(node);
  return record;
}

function patchRecord_(node, key, patch) {
  if (node === 'menu_global') {
    var menu = readNode_('menu_global');
    if (key === 'categorias' && Array.isArray(patch)) menu.categorias = patch;
    else menu[key] = Object.assign({}, menu[key] || {}, patch);
    return replaceNode_(node, menu);
  }
  var current = readRecord_(node, key);
  var isObj = current !== null && typeof current === 'object' && !Array.isArray(current);
  var patchObj = patch !== null && typeof patch === 'object' && !Array.isArray(patch);
  var merged = (isObj && patchObj) ? Object.assign({}, current, patch) : patch;
  writeRecord_(node, key, merged);
  return merged;
}

function replaceNode_(node, records) {
  assertNucleo_(node);
  if (node === 'menu_global') {
    var rows = flattenMenu_(records);
    var sheetMenu = getSheetForNode_(node);
    rewriteTab_(sheetMenu, headersForNode_('menu_global'), rows);
    bumpVersao_(node);
    return records;
  }

  var sheet = getSheetForNode_(node);
  var headers = headersForNode_(node);
  var list = [];
  if (records && typeof records === 'object') {
    for (var k in records) {
      if (Object.prototype.hasOwnProperty.call(records, k)) list.push([k, records[k]]);
    }
  }
  // Cabeçalho final: preferidos + união dos campos presentes nos registros
  var plainRecords = list.map(function (p) { return p[1]; });
  var hasObjects = plainRecords.some(function (r) { return r !== null && typeof r === 'object' && !Array.isArray(r); });
  if (!list.length) {
    rewriteTab_(sheet, headers, []);
    bumpVersao_(node);
    return records;
  }
  if (!hasObjects) headers = ['id', 'valor'];
  headers = ensureFieldsNoWrite_(headers, plainRecords);

  var rows = list.map(function (p) { return recordToRow_(headers, p[0], p[1]); });
  rewriteTab_(sheet, headers, rows);
  bumpVersao_(node);
  return records;
}

// União de campos sem tocar na planilha (usado na reescrita completa).
function ensureFieldsNoWrite_(headers, records) {
  var out = headers.slice();
  for (var r = 0; r < records.length; r++) {
    var rec = records[r];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
    for (var field in rec) {
      if (Object.prototype.hasOwnProperty.call(rec, field) && out.indexOf(field) === -1) out.push(field);
    }
  }
  return out;
}

// Regrava a aba inteira (cabeçalho + linhas), em bateladas de IMPORT_CHUNK.
function rewriteTab_(sheet, headers, rows) {
  sheet.clearContents();
  writeHeaderRow_(sheet, headers);
  var offset = 0;
  while (offset < rows.length) {
    var part = rows.slice(offset, offset + IMPORT_CHUNK);
    var startRow = 2 + offset;
    ensureCapacity_(sheet, startRow + part.length - 1, headers.length);
    sheet.getRange(startRow, 1, part.length, headers.length).setValues(part);
    offset += part.length;
  }
  // limpa cauda antiga (se a reescrita ficou menor que o conteúdo anterior)
  var last = sheet.getLastRow();
  var expected = rows.length + 1;
  if (last > expected) {
    sheet.getRange(expected + 1, 1, last - expected, headers.length).clearContent();
  }
  SpreadsheetApp.flush();
}

function deleteRecord_(node, key) {
  if (node === 'menu_global') return; // menu só por coleção inteira
  assertNucleo_(node);
  var sheet = getSheetForNode_(node, false);
  if (!sheet) return;
  var row = findRowByKey_(sheet, key);
  if (row !== -1) {
    sheet.deleteRow(row);
    bumpVersao_(node);
  }
}

function findRowByKey_(sheet, key) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var target = String(key);
  var CHUNK = 1000;
  for (var start = 2; start <= last; start += CHUNK) {
    var n = Math.min(CHUNK, last - start + 1);
    var keys = sheet.getRange(start, 1, n, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === target) return start + i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// SETUP — cria a planilha com todas as abas + dados iniciais (menu da planilha)
// ---------------------------------------------------------------------------

function setupPortal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureConfig_(ss);

  var todosNos = [];
  IMPORT_NUCLEO.forEach(function (par) {
    var sheet = getSheetForNode_(par[0], true);
    if (sheet) todosNos.push(sheet.getName());
  });

  // Seed de Cargos (catálogo de níveis de acesso)
  seedIfEmpty_('cargos', {
    view:   { rotulo: 'Viewer',    nivel: 1, descricao: 'Somente visualização básica' },
    view2:  { rotulo: 'View Plus', nivel: 2, descricao: 'Visualização ampliada' },
    editor: { rotulo: 'Editor',    nivel: 3, descricao: 'Pode subir/editar dados' },
    admin:  { rotulo: 'Admin',     nivel: 4, descricao: 'Acesso total ao painel' }
  });

  // Seed de Funcoes (catálogo de funções/áreas)
  seedIfEmpty_('funcoes', {
    inventario: { rotulo: 'Inventário', descricao: 'Controle de equipamentos e insumos' },
    aduana:     { rotulo: 'Aduana',     descricao: 'Processos de aduana' },
    tratativas: { rotulo: 'Tratativas', descricao: 'E-mails e tratativas' },
    logistica:  { rotulo: 'Logística',  descricao: 'Operações de percurso e avarias' }
  });

  SpreadsheetApp.flush();
  var extras = listarAbasDb_();
  var msg = 'Abas do CÉREBRO prontas: ' + todosNos.join(', ') + ' + ' + CONFIG_SHEET + '.\n\n' +
    '1) Importe o núcleo: ⚙️ Portal → 🧠 Importar (Menu, Usuários, Notícias, Status…).\n' +
    '2) Implante como Aplicativo da web e gere UMA NOVA VERSÃO.\n' +
    '3) Abra a URL /exec no navegador — deve aparecer { ok:true, ... }.';
  if (extras.length) {
    msg += '\n\n⚠️ Encontrei ' + extras.length + ' aba(s) db_* que NÃO deveriam estar aqui:\n' +
      extras.join(', ') + '\n\nUse ⚙️ Portal → 🧹 Remover abas db_* para limpar.\n' +
      'O DB de cada página fica na planilha própria dela (fase futura).';
  }
  mostrarMensagem_('✅ Cérebro preparado', msg);
}

function ensureConfig_(ss) {
  var c = ss.getSheetByName(CONFIG_SHEET);
  if (!c) c = ss.insertSheet(CONFIG_SHEET);
  if (c.getLastRow() === 0) {
    c.getRange(1, 1, 1, 2).setValues([['chave', 'valor']]).setFontWeight('bold');
  }
  setConfigValue_(c, 'versao', '2.1-cerebro');
  setConfigValue_(c, 'origem_firebase_importacao', FIREBASE_URL_ORIGEM);
  return c;
}

function setConfigValue_(sheet, chave, valor) {
  var last = sheet.getLastRow();
  if (last >= 2) {
    var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === chave) {
        sheet.getRange(i + 2, 2).setValue(valor);
        return;
      }
    }
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([[chave, valor]]);
}

function seedIfEmpty_(node, records) {
  var sheet = getSheetForNode_(node);
  if (sheet.getLastRow() > 1) return; // já tem dados, não sobrescreve
  var headers = readHeaders_(sheet);
  headers = ensureFields_(sheet, headers, Object.keys(records).map(function (k) { return records[k]; }));
  var rows = Object.keys(records).map(function (k) { return recordToRow_(headers, k, records[k]); });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

// ---------------------------------------------------------------------------
// IMPORTAÇÃO DO FIREBASE — parte por parte, em lotes, com continuação
// ---------------------------------------------------------------------------

// Motor genérico: importa UM nó em lotes (orderBy=$key + startAt), gravando
// em bateladas. Se o tempo de execução estiver perto do fim, salva a posição
// e avisa para rodar de novo (o menu "Continuar importações pendentes" retoma).
function importarNo_(node, rotulo) {
  if (!isNucleo_(node)) {
    mostrarMensagem_('⏭️ Fora desta planilha', recusarPagina_(node));
    return;
  }
  var inicio = new Date().getTime();

  // Menu é pequeno e estrutural: importa inteiro e grava achatado (3 níveis).
  if (node === 'menu_global') {
    var respMenu = UrlFetchApp.fetch(FIREBASE_URL_ORIGEM + 'menu_global.json', { muteHttpExceptions: true });
    if (respMenu.getResponseCode() !== 200) {
      mostrarMensagem_('❌ Erro ao importar Menu', 'HTTP ' + respMenu.getResponseCode() + '\n' + respMenu.getContentText().slice(0, 300));
      return;
    }
    var menuData = JSON.parse(respMenu.getContentText() || 'null') || {};
    replaceNode_('menu_global', menuData);
    var linhas = Math.max(0, getSheetForNode_('menu_global').getLastRow() - 1);
    mostrarMensagem_('✅ Menu importado', 'Itens gravados na aba Menu: ' + linhas);
    return;
  }

  var sheet = getSheetForNode_(node);
  var props = PropertiesService.getScriptProperties();
  var cursor = props.getProperty(PROP_CURSOR + node) || '';
  var total = parseInt(props.getProperty(PROP_TOTAL + node) || '0', 10) || 0;

  // Primeira execução do nó: recomeça a aba do zero (cabeçalho preferido).
  if (!cursor) {
    rewriteTab_(sheet, headersForNode_(node), []);
  }
  var headers = readHeaders_(sheet);
  var houveColunaNova = false;

  while (true) {
    var url = FIREBASE_URL_ORIGEM + node + '.json?orderBy=%22%24key%22&limitToFirst=' + (IMPORT_PAGE + 1);
    if (cursor) url += '&startAt=%22' + encodeURIComponent(cursor) + '%22';

    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      mostrarMensagem_('❌ Erro ao importar ' + (rotulo || node),
        'Nó: ' + node + '\nHTTP ' + resp.getResponseCode() + '\n' + resp.getContentText().slice(0, 300));
      return;
    }
    var data = JSON.parse(resp.getContentText() || 'null');
    if (!data || typeof data !== 'object') data = {};

    var keys = Object.keys(data);
    if (cursor && keys.length && keys[0] === cursor) keys.shift(); // startAt é inclusivo
    if (!keys.length) break; // não há mais registros: importação concluída

    // Descobre colunas novas antes de escrever (mantém uma coluna por campo).
    var batchRecords = keys.map(function (k) { return data[k]; });
    var antes = headers.length;
    headers = ensureFields_(sheet, headers, batchRecords);
    if (headers.length !== antes) houveColunaNova = true;

    var rows = keys.map(function (k) { return recordToRow_(headers, k, data[k]); });
    appendRows_(sheet, headers, rows);

    total += rows.length;
    cursor = keys[keys.length - 1];
    props.setProperty(PROP_CURSOR + node, cursor);
    props.setProperty(PROP_TOTAL + node, String(total));

    if (keys.length < IMPORT_PAGE) break; // última página

    // Guarda de tempo: para antes do limite do Google e avisa como continuar.
    if (new Date().getTime() - inicio > IMPORT_MAX_MS) {
      SpreadsheetApp.flush();
      mostrarMensagem_('⏸️ Importação parcial — ' + (rotulo || node),
        'Foram importados ' + total + ' registros até agora.\n\n' +
        'O tempo de execução do Google estava acabando, então parei num ponto seguro.\n' +
        '👉 Rode o MESMO item de menu de novo (ou "🔄 Continuar importações pendentes") para retomar de onde parou.');
      return;
    }
  }

  // Concluído: limpa marcadores e registra na aba _Config.
  props.deleteProperty(PROP_CURSOR + node);
  props.deleteProperty(PROP_TOTAL + node);
  setConfigValue_(ensureConfig_(SpreadsheetApp.getActiveSpreadsheet()),
    'migrado_' + node, new Date().toISOString() + ' (' + total + ' registros)');
  SpreadsheetApp.flush();
  mostrarMensagem_('✅ ' + (rotulo || node) + ' importado',
    'Registros importados para a aba "' + sheet.getName() + '": ' + total +
    (houveColunaNova ? '\n\nℹ️ Colunas novas foram criadas ao final do cabeçalho para campos encontrados no meio do caminho.' : ''));
}

function appendRows_(sheet, headers, rows) {
  var offset = 0;
  while (offset < rows.length) {
    var part = rows.slice(offset, offset + IMPORT_CHUNK);
    var startRow = sheet.getLastRow() + 1;
    ensureCapacity_(sheet, startRow + part.length - 1, headers.length);
    sheet.getRange(startRow, 1, part.length, headers.length).setValues(part);
    offset += part.length;
  }
}

// Rótulos amigáveis para as caixas de diálogo
function rotuloDoNo_(node) {
  var todas = IMPORT_NUCLEO.concat(IMPORT_PAGINAS);
  for (var i = 0; i < todas.length; i++) if (todas[i][0] === node) return todas[i][1];
  return node;
}

// Pede confirmação e dispara a importação de UM nó.
function importarComConfirmacao_(node) {
  if (!isNucleo_(node)) {
    mostrarMensagem_('⏭️ Fora desta planilha', recusarPagina_(node));
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var cursor = PropertiesService.getScriptProperties().getProperty(PROP_CURSOR + node);
  var texto = 'Nó do Firebase: ' + node + '\nAba de destino: ' + sheetNameForNode_(node) + '\n\n';
  texto += cursor
    ? '⚠️ Existe uma importação PARCIAL desta parte. Ela vai CONTINUAR de onde parou.\n\nContinuar?'
    : 'A aba será RECRIADA do zero e preenchida com os dados do Firebase, em lotes.\n\nComeçar agora?';
  var r = ui.alert('📥 Importar — ' + rotuloDoNo_(node), texto, ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  importarNo_(node, rotuloDoNo_(node));
}

function mostrarMensagem_(titulo, texto) {
  try { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { Logger.log(titulo + '\n' + texto); }
}

function mostrarAjuda() {
  mostrarMensagem_('ℹ️ Como funciona',
    'Esta planilha é o CÉREBRO do portal (menu, usuários, notícias, status, logs).\n' +
    'O DB de cada página NÃO entra aqui — fica na planilha dela.\n\n' +
    '1) "Preparar planilha" cria só as abas do cérebro.\n' +
    '2) Se existirem abas db_*, use "🧹 Remover abas db_*".\n' +
    '3) Importe o NÚCLEO parte a parte (Menu, Usuários, Notícias…).\n' +
    '4) Se uma importação parar no meio, rode o mesmo item de novo.\n' +
    '5) Implante como Aplicativo da web (NOVA VERSÃO) e cole a URL /exec\n' +
    '   em js/portal-db.js. Teste abrindo /exec — deve vir { ok:true }.');
}

function limparAbasDb() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var extras = listarAbasDb_();
  if (!extras.length) {
    mostrarMensagem_('🧹 Nada a limpar', 'Não há abas db_* nesta planilha. Ela já está só com o cérebro.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert(
    '🧹 Remover abas db_*',
    'Serão removidas ' + extras.length + ' aba(s):\n' + extras.join(', ') +
    '\n\nEsta planilha fica só com o cérebro (Menu, Usuarios, Noticias, Status, Logs, _Config...).\n' +
    'O DB de cada página virá da planilha própria dela, no futuro.\n\nContinuar?',
    ui.ButtonSet.YES_NO
  );
  if (r !== ui.Button.YES) return;
  var removidas = [];
  extras.forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (s && ss.getSheets().length > 1) {
      ss.deleteSheet(s);
      removidas.push(name);
    }
  });
  mostrarMensagem_('✅ Abas removidas', 'Removidas: ' + (removidas.join(', ') || '(nenhuma)'));
}

// Retoma todas as partes que ficaram pela metade.
function continuarImportacoesPendentes() {
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var pendentes = [];
  for (var k in todas) {
    if (k.indexOf(PROP_CURSOR) === 0) pendentes.push(k.slice(PROP_CURSOR.length));
  }
  if (!pendentes.length) {
    mostrarMensagem_('🔄 Nada pendente', 'Não há importações parciais. Tudo certo! ✅');
    return;
  }
  for (var i = 0; i < pendentes.length; i++) {
    importarNo_(pendentes[i], rotuloDoNo_(pendentes[i]));
    // se ainda restar cursor (tempo esgotou de novo), para por aqui
    if (props.getProperty(PROP_CURSOR + pendentes[i])) return;
  }
}

function importarNoPersonalizado() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('📥 Importar nó do cérebro',
    'Digite o nome EXATO do nó do cérebro (users, menu_global, portal_news, portal_status, logs…):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var node = String(r.getResponseText() || '').replace(/^\s+|\s+$/g, '');
  if (!node) return;
  importarComConfirmacao_(node);
}

// ---------------------------------------------------------------------------
// MENU DA PLANILHA — "⚙️ Portal"
// ---------------------------------------------------------------------------

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  var subNucleo = ui.createMenu('🧠 Importar — Núcleo do portal');
  IMPORT_NUCLEO.forEach(function (par) {
    subNucleo.addItem(par[1], fnImportador_(par[0]));
  });

  ui.createMenu('⚙️ Portal')
    .addItem('1️⃣ Preparar planilha (só o cérebro)', 'setupPortal')
    .addItem('🧹 Remover abas db_*', 'limparAbasDb')
    .addSeparator()
    .addSubMenu(subNucleo)
    .addItem('📥 Importar nó do cérebro…', 'importarNoPersonalizado')
    .addSeparator()
    .addItem('🔄 Continuar importações pendentes', 'continuarImportacoesPendentes')
    .addItem('ℹ️ Ajuda', 'mostrarAjuda')
    .addToUi();
}

// Itens de menu só chamam funções GLOBAIS sem argumentos: criamos um wrapper
// global por nó (ex.: importar_users, importar_equipamentos, ...) apontando
// para a função de importação correspondente.
function fnImportador_(node) {
  return 'importar__' + node;
}

// --- Wrappers Núcleo ---
function importar__users() { importarComConfirmacao_('users'); }
function importar__menu_global() { importarComConfirmacao_('menu_global'); }
function importar__cargos() { importarComConfirmacao_('cargos'); }
function importar__funcoes() { importarComConfirmacao_('funcoes'); }
function importar__portal_news() { importarComConfirmacao_('portal_news'); }
function importar__portal_status() { importarComConfirmacao_('portal_status'); }
function importar__portal_bigquery() { importarComConfirmacao_('portal_bigquery'); }
function importar__logs() { importarComConfirmacao_('logs'); }
function importar__presence() { importarComConfirmacao_('presence'); }
function importar__user_bookmarks() { importarComConfirmacao_('user_bookmarks'); }

// --- Wrappers Páginas ---
function importar__equipamentos() { importarComConfirmacao_('equipamentos'); }
function importar__aderencia() { importarComConfirmacao_('aderencia'); }
function importar__aderencia_historico() { importarComConfirmacao_('aderencia_historico'); }
function importar__ofensores() { importarComConfirmacao_('ofensores'); }
function importar__devolucao() { importarComConfirmacao_('devolucao'); }
function importar__envios_diarios_v8() { importarComConfirmacao_('envios_diarios_v8'); }
function importar__salvados_aprendizado() { importarComConfirmacao_('salvados_aprendizado'); }
function importar__salvados_encontrados() { importarComConfirmacao_('salvados_encontrados'); }
function importar__salvados_ia_config() { importarComConfirmacao_('salvados_ia_config'); }
function importar__salvados_ia_keys() { importarComConfirmacao_('salvados_ia_keys'); }
function importar__salvados_recuperados() { importarComConfirmacao_('salvados_recuperados'); }
function importar__emails_tratativas() { importarComConfirmacao_('emails_tratativas'); }
function importar__insumos() { importarComConfirmacao_('insumos'); }
function importar__parado_percurso() { importarComConfirmacao_('parado_percurso'); }
function importar__parado_percurso_emails() { importarComConfirmacao_('parado_percurso_emails'); }
function importar__pendencias_cftv_consolidado() { importarComConfirmacao_('pendencias_cftv_consolidado'); }
function importar__poka_avarias_diario() { importarComConfirmacao_('poka_avarias_diario'); }
function importar__poka_avarias_consolidado_v3() { importarComConfirmacao_('poka_avarias_consolidado_v3'); }
function importar__poka_aduanas_pacotes() { importarComConfirmacao_('poka_aduanas_pacotes'); }
function importar__poka_aduanas_resumo() { importarComConfirmacao_('poka_aduanas_resumo'); }
function importar__bpp_inventariado_v2() { importarComConfirmacao_('bpp_inventariado_v2'); }
function importar__inventario_dhs_separado_v1() { importarComConfirmacao_('inventario_dhs_separado_v1'); }
