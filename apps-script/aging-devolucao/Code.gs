/**
 * ============================================================================
 *  AGING DEVOLUÇÃO | API somente leitura para o Portal de Reportes
 * ============================================================================
 *
 *  Cole este arquivo em:
 *    Planilha de Aging Devolução → Extensões → Apps Script
 *
 *  Depois publique como Aplicativo da Web:
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 *
 *  A URL /exec gerada deve ser cadastrada em:
 *    Admin → Planilhas por Página → Aging de Devolução (pages/aging-devolucao.html)
 *
 *  Esta API NÃO cria abas, NÃO altera células e NÃO recebe upload de CSV.
 *  A planilha é a fonte única de dados da página aging-devolucao.html.
 *
 *  ABA NECESSÁRIA NA PLANILHA (criada manualmente por quem administra):
 *    - A aba de dados DEVE existir. O script procura nesta ordem:
 *        1º) aba com o gid informado (abaGid = 0, a primeira aba da planilha);
 *        2º) aba com o nome informado (abaNome = 'Aging Devolucao');
 *        3º) a primeira aba que existir.
 *    - Linha 1 = cabeçalho (nomes das colunas). Dados a partir da linha 2.
 *    - Cabeçalho recomendado:
 *        ID do envio | Substatus do envio | Aging Sorting | Aging Devolução |
 *        Valor declarado | Preparação | Suporte | Análise
 *      (a página localiza as colunas por palavras-chave como "id", "substatus",
 *      "sorting", "devolu", "valor", "prep", "análise" / "suporte").
 * ============================================================================
 */

var CONFIG_DEVOLUCAO = {
  // Se o script for colado diretamente na planilha de Aging Devolução,
  // pode deixar planilhaId vazio (ele usa a planilha ativa).
  // Caso use um script independente, cole o ID da planilha entre aspas.
  planilhaId: '',
  abaGid: 0,
  abaNome: 'Aging Devolucao', // fallback se o gid 0 não existir
  linhaCabecalho: 1,
  node: 'devolucao'
};

/**
 * Rotas públicas aceitas:
 *   /exec
 *   /exec?path=health.json
 *   /exec?path=devolucao.json
 *
 * O portal-db.js converte internamente a chamada com aparência Firebase para
 * o parâmetro ?path=, pois esse formato funciona sem login no Apps Script.
 */
function doGet(e) {
  var node = normalizarNode_(e);

  if (!node || node === 'health') {
    return respostaJson_(criarHealth_());
  }

  if (node !== CONFIG_DEVOLUCAO.node) {
    return respostaJson_({
      ok: false,
      error: 'Rota não encontrada: ' + node,
      nodeDisponivel: CONFIG_DEVOLUCAO.node
    });
  }

  try {
    return respostaJson_(lerDevolucao_());
  } catch (erro) {
    console.error(erro);
    return respostaJson_({
      ok: false,
      error: 'Não foi possível ler a planilha de Aging Devolução: ' + String(erro)
    });
  }
}

/**
 * Endpoint deliberadamente somente leitura.
 */
function doPost() {
  return respostaJson_({
    ok: false,
    error: 'Esta API é somente leitura. Edite os dados diretamente na planilha.'
  });
}

function normalizarNode_(e) {
  var path = '';
  if (e && e.parameter && e.parameter.path) path = e.parameter.path;
  else if (e && e.pathInfo) path = e.pathInfo;

  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/\.json$/i, '')
    .split('/')[0]
    .trim();
}

/**
 * Lê valores exatamente como aparecem na planilha (getDisplayValues) para
 * preservar formatação de números, moedas e textos.
 */
function lerDevolucao_() {
  var aba = obterAba_();
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  var linhaCabecalho = CONFIG_DEVOLUCAO.linhaCabecalho;

  if (ultimaLinha < linhaCabecalho || ultimaColuna < 1) return [];

  var cabecalhosBrutos = aba
    .getRange(linhaCabecalho, 1, 1, ultimaColuna)
    .getDisplayValues()[0];
  var cabecalhos = criarCabecalhosUnicos_(cabecalhosBrutos);
  var quantidadeLinhas = ultimaLinha - linhaCabecalho;

  if (quantidadeLinhas < 1) return [];

  var valores = aba
    .getRange(linhaCabecalho + 1, 1, quantidadeLinhas, ultimaColuna)
    .getDisplayValues();
  var registros = [];

  for (var linha = 0; linha < valores.length; linha++) {
    var celulas = valores[linha];
    if (linhaVazia_(celulas)) continue;

    var registro = {};
    for (var coluna = 0; coluna < cabecalhos.length; coluna++) {
      registro[cabecalhos[coluna]] = celulas[coluna] || '';
    }
    registros.push(registro);
  }

  return registros;
}

/**
 * Evita perda de dados quando há título vazio ou repetido no cabeçalho.
 */
function criarCabecalhosUnicos_(cabecalhosBrutos) {
  var usados = {};
  var cabecalhos = [];

  for (var i = 0; i < cabecalhosBrutos.length; i++) {
    var base = String(cabecalhosBrutos[i] || '').trim();
    if (!base) base = 'Coluna ' + (i + 1);

    var ocorrencia = (usados[base] || 0) + 1;
    usados[base] = ocorrencia;
    cabecalhos.push(ocorrencia === 1 ? base : base + ' (' + ocorrencia + ')');
  }

  return cabecalhos;
}

function linhaVazia_(celulas) {
  for (var i = 0; i < celulas.length; i++) {
    if (String(celulas[i] || '').trim() !== '') return false;
  }
  return true;
}

function contarRegistros_(aba) {
  var quantidadeLinhas = aba.getLastRow() - CONFIG_DEVOLUCAO.linhaCabecalho;
  var quantidadeColunas = aba.getLastColumn();
  if (quantidadeLinhas < 1 || quantidadeColunas < 1) return 0;

  var valores = aba
    .getRange(CONFIG_DEVOLUCAO.linhaCabecalho + 1, 1, quantidadeLinhas, quantidadeColunas)
    .getDisplayValues();
  var total = 0;

  for (var i = 0; i < valores.length; i++) {
    if (!linhaVazia_(valores[i])) total++;
  }
  return total;
}

function obterPlanilha_() {
  if (CONFIG_DEVOLUCAO.planilhaId && String(CONFIG_DEVOLUCAO.planilhaId).trim() !== '') {
    try {
      return SpreadsheetApp.openById(CONFIG_DEVOLUCAO.planilhaId.trim());
    } catch (e) {
      console.warn('Falha ao abrir por ID, tentando planilha ativa:', e);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function obterAba_() {
  var planilha = obterPlanilha_();
  if (!planilha) {
    throw new Error('Nenhuma planilha encontrada. Cole o script em Extensões → Apps Script da planilha de Aging Devolução ou configure o planilhaId.');
  }

  var abas = planilha.getSheets();

  // 1º) aba pelo gid (padrão: gid=0, a primeira aba da planilha)
  for (var i = 0; i < abas.length; i++) {
    if (abas[i].getSheetId() === CONFIG_DEVOLUCAO.abaGid) return abas[i];
  }

  // 2º) aba pelo nome
  if (CONFIG_DEVOLUCAO.abaNome) {
    var porNome = planilha.getSheetByName(CONFIG_DEVOLUCAO.abaNome);
    if (porNome) return porNome;
  }

  // 3º) primeira aba existente
  if (abas.length > 0) return abas[0];

  throw new Error('A planilha de Aging Devolução não tem nenhuma aba. Crie a aba de dados (primeira aba, gid=0).');
}

function criarHealth_() {
  try {
    var planilha = obterPlanilha_();
    var aba = obterAba_();
    return {
      ok: true,
      service: 'portal-aging-devolucao',
      versao: '1.0.0',
      planilha: planilha.getName(),
      aba: aba.getName(),
      gid: aba.getSheetId(),
      registros: contarRegistros_(aba),
      node: CONFIG_DEVOLUCAO.node,
      somenteLeitura: true,
      uso: 'GET /exec?path=' + CONFIG_DEVOLUCAO.node + '.json'
    };
  } catch (erro) {
    return {
      ok: false,
      service: 'portal-aging-devolucao',
      error: String(erro)
    };
  }
}

function respostaJson_(conteudo) {
  return ContentService
    .createTextOutput(JSON.stringify(conteudo === undefined ? null : conteudo))
    .setMimeType(ContentService.MimeType.JSON);
}
