/**
 * ============================================================================
 *  AVARIAS — DIÁRIO | API somente leitura para o Portal de Reportes
 * ============================================================================
 *
 *  Cole este arquivo em:
 *    Planilha de Avarias → Extensões → Apps Script
 *
 *  Depois publique como Aplicativo da Web:
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 *
 *  A URL /exec gerada deve ser cadastrada em:
 *    Admin → Planilhas por Página → Avarias — Diário
 *
 *  Esta API NÃO cria abas, NÃO altera células e NÃO recebe upload de CSV.
 *  A planilha abaixo é a fonte única de dados da página avarias-diario.html.
 *
 *  ABA NECESSÁRIA NA PLANILHA (criada manualmente por quem administra):
 *    - A aba de dados DEVE existir. O script procura nesta ordem:
 *        1º) aba com o gid informado (abaGid = 0, a primeira aba da planilha);
 *        2º) aba com o nome informado (abaNome);
 *        3º) a primeira aba que existir.
 *    - Linha 1 = cabeçalho (nomes das colunas). Dados a partir da linha 2.
 *    - Cabeçalho recomendado:
 *        ID do pacote | ID da avaria | Data | Semana | Lançado Por |
 *        Descrição | Valor | Origem de dano | Resolução | Status de resolução
 *      (a página localiza as colunas por palavras-chave, então nomes parecidos
 *      também funcionam — desde que existam).
 * ============================================================================
 */

var CONFIG_AVARIAS = {
  planilhaId: '1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE',
  abaGid: 0,
  abaNome: 'Avarias Diario', // fallback se o gid acima não existir (pode ser qualquer nome)
  linhaCabecalho: 1,
  node: 'poka_avarias_diario'
};

/**
 * Rotas públicas aceitas:
 *   /exec
 *   /exec?path=health.json
 *   /exec?path=poka_avarias_diario.json
 *
 * O portal-db.js converte internamente a chamada com aparência Firebase para
 * o parâmetro ?path=, pois esse formato funciona sem login no Apps Script.
 */
function doGet(e) {
  var node = normalizarNode_(e);

  if (!node || node === 'health') {
    return respostaJson_(criarHealth_());
  }

  if (node !== CONFIG_AVARIAS.node) {
    return respostaJson_({
      ok: false,
      error: 'Rota não encontrada: ' + node,
      nodeDisponivel: CONFIG_AVARIAS.node
    });
  }

  try {
    return respostaJson_(lerAvarias_());
  } catch (erro) {
    console.error(erro);
    return respostaJson_({
      ok: false,
      error: 'Não foi possível ler a planilha de Avarias: ' + String(erro)
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
 * Lê valores exatamente como aparecem na planilha. Assim datas continuam no
 * formato brasileiro e valores monetários continuam compatíveis com o painel.
 */
function lerAvarias_() {
  var aba = obterAba_();
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  var linhaCabecalho = CONFIG_AVARIAS.linhaCabecalho;

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
  var quantidadeLinhas = aba.getLastRow() - CONFIG_AVARIAS.linhaCabecalho;
  var quantidadeColunas = aba.getLastColumn();
  if (quantidadeLinhas < 1 || quantidadeColunas < 1) return 0;

  var valores = aba
    .getRange(CONFIG_AVARIAS.linhaCabecalho + 1, 1, quantidadeLinhas, quantidadeColunas)
    .getDisplayValues();
  var total = 0;

  for (var i = 0; i < valores.length; i++) {
    if (!linhaVazia_(valores[i])) total++;
  }
  return total;
}

function obterAba_() {
  var planilha = SpreadsheetApp.openById(CONFIG_AVARIAS.planilhaId);
  var abas = planilha.getSheets();

  // 1º) aba pelo gid (padrão: gid=0, a primeira aba da planilha)
  for (var i = 0; i < abas.length; i++) {
    if (abas[i].getSheetId() === CONFIG_AVARIAS.abaGid) return abas[i];
  }

  // 2º) aba pelo nome (ajuda quando a aba foi criada/renomeada e ganhou outro gid)
  if (CONFIG_AVARIAS.abaNome) {
    var porNome = planilha.getSheetByName(CONFIG_AVARIAS.abaNome);
    if (porNome) return porNome;
  }

  // 3º) primeira aba existente (último recurso — evita erro de configuração)
  if (abas.length > 0) return abas[0];

  throw new Error('A planilha de Avarias não tem nenhuma aba. Crie a aba de dados (primeira aba, gid=0).');
}

function criarHealth_() {
  try {
    var planilha = SpreadsheetApp.openById(CONFIG_AVARIAS.planilhaId);
    var aba = obterAba_();
    return {
      ok: true,
      service: 'portal-avarias-diario',
      versao: '1.0.0',
      planilha: planilha.getName(),
      aba: aba.getName(),
      gid: aba.getSheetId(),
      registros: contarRegistros_(aba),
      node: CONFIG_AVARIAS.node,
      somenteLeitura: true,
      uso: 'GET /exec?path=' + CONFIG_AVARIAS.node + '.json'
    };
  } catch (erro) {
    return {
      ok: false,
      service: 'portal-avarias-diario',
      error: String(erro)
    };
  }
}

function respostaJson_(conteudo) {
  return ContentService
    .createTextOutput(JSON.stringify(conteudo === undefined ? null : conteudo))
    .setMimeType(ContentService.MimeType.JSON);
}
