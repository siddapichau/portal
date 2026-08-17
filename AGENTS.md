# Contexto permanente para agentes — Portal de Reportes

> Leia este arquivo primeiro em qualquer novo chat. Ele é o resumo operacional do projeto. Não faça uma varredura de todos os HTMLs: confira somente os arquivos diretamente ligados à tarefa e o `git diff` atual.

## 1. Missão do projeto

Este repositório é o **Portal de Reportes**, um portal web estático em português do Brasil. `index.html` é o shell, `menu.js` controla navegação/permissões e os reportes em `pages/*.html` são carregados em iframe.

A migração em andamento elimina uploads manuais de CSV e bancos intermediários. O portal passa a usar **Google Sheets como fonte única de dados**, sem mudar filtros, KPIs, gráficos, tabelas, links ou exportações que cada reporte já oferece.

### Regra de ouro (não negociar)

- Cada página de reporte **somente lê** a planilha própria dela.
- Não reintroduzir upload de CSV, Firebase, cópia para banco ou aba `db_*`.
- Alterações nos dados são feitas diretamente na planilha; o portal apenas consulta e apresenta.
- Ao migrar uma página, preserve seu comportamento visual e analítico.

## 2. Arquitetura atual

```text
Portal (HTML/JS)
  ├─ cérebro central ──> Apps Script central /exec ──> planilha central
  │                      (menu, usuários, config, notícias, status, logs...)
  └─ página de reporte ─> Apps Script próprio /exec ─> planilha daquela página
```

- `js/portal-db.js` é a camada única de dados.
- `PortalDB.URL` é o `/exec` central.
- `PortalDB.baseCentral()` deve ser usado pelo núcleo/Admin.
- `PortalDB.baseAtiva('pages/arquivo.html')` escolhe o `/exec` da página.
- As URLs por página são guardadas na aba `_Config` da planilha central com chaves `url_pages/arquivo.html` e espelhadas em `localStorage.portal_page_urls`.
- O Admin gerencia isso em **Admin → Planilhas por Página** (`pages/admin.html`). A URL cadastrada deve terminar em `/exec`.
- `portal-db.js` converte chamadas no estilo antigo (`base + node + '.json'`) em `GET /exec?path=node.json`. Para escrita central, converte PUT/PATCH/DELETE em POST envelopado.
- Variáveis chamadas `FIREBASE_URL` em páginas antigas são nomes legados; não significam que o front ainda use Firebase.
- A única referência Firebase permitida está em `apps-script/Code.gs`, exclusivamente no importador histórico do cérebro. Nunca criar fallback Firebase no front.

## 3. Cérebro x páginas

### Cérebro central

- Backend: `apps-script/Code.gs`.
- Implantação: `apps-script/COMO_IMPLANTAR.md`.
- Nós: `menu_global`, `users`, `cargos`, `funcoes`, `portal_news`, `portal_status`, `portal_bigquery`, `logs`, `presence`, `user_bookmarks`, `config`.
- A planilha central é editável via portal/Admin e não deve receber dados analíticos das páginas.

### Backend de uma página

Cada planilha de reporte recebe um Apps Script pequeno e **somente leitura**. Contrato obrigatório:

- `GET /exec` ou `GET /exec?path=health.json` → JSON com `ok: true`, `service`, `node`, `registros` e `somenteLeitura: true`.
- `GET /exec?path=NOME_DO_NODE.json` → dados no formato que o HTML já consumia (normalmente array de objetos).
- `POST` → erro informando que a API é somente leitura.
- Ler com `getDisplayValues()` quando o painel depende de datas/moedas formatadas.
- Não criar, renomear ou limpar abas da planilha.
- Cabeçalho normalmente na linha 1; deixe isso configurável no topo do script.

## 4. Processo padrão para migrar um reporte

1. Leia apenas o HTML alvo e identifique nós, formato esperado, filtros e fluxo antigo de CSV.
2. Crie `apps-script/<pagina>/Code.gs` configurado com ID da planilha, gid, linha do cabeçalho e node.
3. Crie `apps-script/<pagina>/COMO_IMPLANTAR.md` com publicação e cadastro do `/exec` no Admin.
4. No HTML, mantenha o dashboard e remova biblioteca, botão, permissões, listeners e gravações ligados ao CSV.
5. Leia via `PortalDB.baseAtiva('pages/<pagina>.html')`; mantenha o node esperado para minimizar mudanças.
6. Ofereça atualização manual se útil, além da carga ao abrir.
7. Mostre estados claros de carregando, planilha vazia e erro, sem apagar dados já exibidos quando apenas uma atualização falhar.
8. Teste sintaxe do JavaScript inline, procure resíduos de CSV/Firebase e valide o diff.
9. Atualize este arquivo e `PLANO_DE_ACAO.md` com o estado da migração.
10. Entregue PR e informe exatamente qual `Code.gs` copiar e onde cadastrar o `/exec`.

## 5. Estado da migração por página

### Avarias — Diário (primeira página)

- Página: `pages/avarias-diario.html`.
- Planilha: `https://docs.google.com/spreadsheets/d/1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE/edit?gid=0#gid=0`.
- Spreadsheet ID: `1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE`.
- Gid: `0`.
- Node: `poka_avarias_diario`.
- Backend: `apps-script/avarias-diario/Code.gs`.
- Instruções: `apps-script/avarias-diario/COMO_IMPLANTAR.md`.
- Situação do código: migrada para somente leitura; CSV/PapaParse/gravação removidos; carga ao abrir e botão de atualização mantêm o mesmo dashboard.
- Pendência externa: o responsável deve colar o script na planilha, publicar como Aplicativo da Web para “Qualquer pessoa” e cadastrar o `/exec` em **Admin → Planilhas por Página → Avarias — Diário**.

### Demais reportes

Ainda devem ser migrados, um por vez, seguindo a regra de ouro. O mapa de páginas e nós está em `PLANO_DE_ACAO.md`.

## 6. Arquivos que normalmente importam

- `index.html`: shell, autenticação e iframe.
- `menu.js`: menu/permissões.
- `js/portal-db.js`: roteamento central/página, fetch e cache.
- `pages/admin.html`: Admin, inclusive URLs `/exec` por página e versão/cache.
- `pages/<reporte>.html`: UI e transformação dos dados do reporte.
- `apps-script/Code.gs`: backend central; não reutilizar inteiro nas páginas.
- `apps-script/<reporte>/Code.gs`: adaptador somente leitura da planilha da página.
- `PLANO_DE_ACAO.md`: histórico e mapa macro.

## 7. Convenções e cuidados

- UI, mensagens e documentação em pt-BR.
- Preserve compatibilidade com páginas estáticas, sem exigir build ou framework.
- Não coloque URL `/exec` de página direto no HTML; ela deve vir do Admin.
- Não exponha credenciais. IDs e links das planilhas fornecidos para integração podem ficar na configuração do script.
- O Apps Script deve ser implantado como **Executar como: Eu** e **Acesso: Qualquer pessoa**.
- Depois de mudar Apps Script: criar **Nova versão** da implantação. Salvar não atualiza o `/exec` publicado.
- Depois de trocar URL no Admin: salvar e usar **Versão / Cache** para propagar.
- O teste de URL no Admin só deve aprovar quando o health retornar `ok: true`.
- Antes de concluir: `git status`, testes disponíveis, revisão de `git diff --check`, commit, push da branch de trabalho e PR.
