# 🧠 Plano de Ação — Portal 100% via Planilha (Google Sheets)

> **Autor:** Equipe de engenharia do Portal de Reportes
> **Objetivo:** Substituir o Firebase Realtime Database por um **Google Sheets (planilha)** como único banco de dados do portal, **sem mudar a experiência do usuário final**, e organizar as páginas dentro de `pages/`.
> **Estratégia:** execução **por fases** (cérebro primeiro, depois página a página), cada fase entregue como um Pull Request separado e testável.

---

## 1. Arquitetura atual

O portal é um SPA estático (`index.html` + `menu.js` como "corpo") que carrega páginas de reporte dentro de um `<iframe>`. O cérebro já usa uma planilha Google central via Apps Script; as páginas estão sendo migradas, uma por vez, para ler diretamente suas próprias planilhas. O Firebase não é usado pelo front-end.

### 1.1 "Cérebro" e "corpo" (o núcleo que todas as páginas usam)

| Nó | Conteúdo | Quem usa |
|---|---|---|
| `menu_global` | Estrutura do menu (categorias → itens → subitens, com permissões `viewRoles`/`uploadRoles`/`allowedUsers`) | `menu.js`, `admin.html`, `cadastro_celulares.html` |
| `users` | Usuários (`usuario`, `email`, `senha`, `cargo`, `solicitacao`, `favorito`, `avatar`, `nome`, `sobrenome`, `telefone`) | `menu.js` (login/registro), `index.html`, `admin.html`, `perfil.html` |
| `logs` | Radar de atividades (auditoria) | `index.html`, `admin.html`, `perfil.html`, todas as páginas |
| `portal_news` | Mural de notícias | `index.html`, `admin.html`, `perfil.html` |
| `portal_status` | Central de status dos reportes (ON/OFF) | `menu.js`, `index.html`, `admin.html` |
| `portal_bigquery` | Biblioteca de queries | `admin.html`, `perfil.html`, `bigquery.html` |
| `presence` | Quem está online agora | `index.html` |
| `user_bookmarks` | Cofre de favoritos (backup `.html`) | `perfil.html` |
| `cargos` 🆕 | Níveis de acesso (view / view2 / editor / admin) | catálogo da planilha |
| `funcoes` 🆕 | Funções de trabalho (Inventário, Aduana, Tratativas…) | catálogo da planilha |

### 1.2 Páginas de reporte (dados dos gráficos)

Cada página lê o seu "nó" de dados **na planilha que já existe dela** (não nesta planilha do portal). Nesta fase o cérebro (menu, notícias, usuários…) é o que precisa funcionar. Mapa das páginas, para a Fase 2.1:

| Página | Nó(s) de dados |
|---|---|
| `equipamentos.html` | `equipamentos` |
| `aderencia.html` | `aderencia`, `aderencia_historico` |
| `aderencia2.html` | `ofensores` |
| `aging-devolucao.html` | `devolucao` |
| `expedir_devolucao.html` | `envios_diarios_v8` |
| `salvados_procurar/v2/v3.html` | `salvados_aprendizado`, `salvados_encontrados`, `salvados_ia_config`, `salvados_ia_keys` |
| `salvados_recuperados.html` | `salvados_recuperados` |
| `emails_tratativas.html` | `emails_tratativas` |
| `insumos.html`, `contagem_insumos.html` | `insumos` |
| `parado_percurso.html` | `parado_percurso`, `parado_percurso_emails` |
| `pendencias_cftv.html` | `pendencias_cftv_consolidado` |
| `avarias-diario.html` | `poka_avarias_diario` |
| `poka-avaria.html` | `poka_avarias_consolidado_v3` |
| `aduana.html` | `poka_aduanas_pacotes`, `poka_aduanas_resumo` |
| `bpp.html` | `bpp_inventariado_v2` |
| `pendentes_inventariov2.html` | `inventario_dhs_separado_v1`, `aderencia_historico` |
| `bigquery.html` | `portal_bigquery` (núcleo) |

---

## 2. Arquitetura alvo (planilha como banco) ✅ IMPLEMENTADA

```
┌──────────────┐   fetch/JSON   ┌───────────────────────────┐   lê/escreve   ┌──────────────────┐
│  Portal Web  │ ─────────────▶ │ Google Apps Script (API)  │ ─────────────▶ │ Google Sheets    │
│  (HTML/JS)   │ ◀───────────── │  /exec  (REST compatível) │ ◀───────────── │  (planilha = BD) │
└──────────────┘                └───────────────────────────┘                └──────────────────┘
```

- **Google Sheets (cérebro)** = banco do portal. Só abas de menu, usuários, notícias, status, logs e `_Config`. Cada página de reporte continua com a **planilha dela**.
- **Google Apps Script central** (`apps-script/Code.gs`) = API editável do cérebro, com contrato compatível com o REST usado pelo portal.
- **Google Apps Script por reporte** (`apps-script/<pagina>/Code.gs`) = adaptador somente leitura sobre a planilha existente daquela página; não copia, importa nem grava dados.
- **`js/portal-db.js`** = ponto único de configuração (URL central, seleção da URL por página e tradutor de métodos).
- **Firebase: 0% no portal.** Não existe fallback nem URL do Firebase em nenhum `.html`/`.js` do front. A **única** referência ao Firebase no repositório está dentro do Apps Script (`FIREBASE_URL_ORIGEM`), usada **exclusivamente** pelas funções de importação para copiar os dados já existentes.

### 2.1 Formato das abas — planilha de verdade (colunar) ✅

Cada aba é uma planilha normal, **uma coluna por campo e uma linha por registro** (coluna A sempre `id`, com a chave única do registro):

```
Aba Usuarios:
  id            | usuario  | nome | sobrenome | email          | telefone | cargo  | solicitacao | favorito        | avatar | senha
  -Nxyz123...   | ana.s    | Ana  | Silva     | ana@ml.com     | 11999... | editor | aprovado   |Equip.,Aderência | https… | <hash>

Aba Menu (menu achatado em 3 níveis):
  id                | tipo      | categoria   | pai        | ordem | titulo       | url               | icone | viewRoles              | uploadRoles  | allowedUsers
  cat0              | categoria |             |            | 0     | Operacional  |                   | 📦    | view,view2,editor,admin|              |
  cat0/item0        | item      | Operacional | cat0       | 0     | Equipamentos | equipamentos.html | 📋    | view,view2,editor,admin| editor,admin |
  cat0/item0/sub0   | subitem   | Operacional | cat0/item0 | 0     | Cadastros    | cadastro.html     | ↳     | admin                  | admin        | wesleyclp
```

Regras do codec (implementadas no `Code.gs`):
- Valores simples ficam naturais (texto, número, booleano).
- Valores compostos (objeto/array) ficam como texto JSON na célula e são **convertidos de volta para objeto** automaticamente na leitura da API.
- Campos novos aparecem como **colunas novas ao final do cabeçalho**, automaticamente.
- A aba `Menu` é especial: a API achata/remonta o JSON de 3 níveis (categoria → item → subitem) de forma transparente — o portal continua recebendo `menu_global` no formato original.
- Registros primitivos (ex.: chaves de API em `salvados_ia_keys`) usam a aba `id | valor`.

### 2.2 Importação — parte por parte, em lotes ✅

Importar tudo de uma vez estourava os limites do Google (tempo de execução). Por isso o script agora tem **menu próprio na planilha** (`⚙️ Portal`), com **um item para cada parte**:

- **🧠 Importar — Núcleo do portal:** Usuários, Menu, Cargos, Funções, Notícias, Status, BigQuery, Logs, Presença, Favoritos.
- **📄 Páginas:** o DB de cada reporte **não** é importado nesta planilha. Cada página já tem a planilha dela; ligamos isso na Fase 2.1.
- **🧹 Remover abas db_*:** apaga as abas de página que o setup antigo criou por engano.
- **🔄 Continuar importações pendentes:** se uma parte for grande demais e o tempo do Google esgotar, o script para num ponto seguro e **continua de onde parou** na próxima execução (cursor salvo em `PropertiesService`).

Como funciona por dentro: leitura do Firebase **paginada** (`orderBy="$key"`, lotes de 200), gravação na planilha **em bateladas** de 500 linhas, guarda de tempo de 4,5 min por execução. Não existe opção "importar tudo" de propósito.

---

## 3. Fases do projeto

### ✅ FASE 0 — Preparação
- [x] Documento deste plano.
- [x] Backend `apps-script/Code.gs` (API REST sobre a planilha + `setupPortal()` que cria as abas).
- [x] Camada `js/portal-db.js` (configuração única + tradutor de métodos).
- [x] Páginas movidas para `pages/` com caminhos corrigidos.

### ✅ FASE 1 — Cérebro e corpo principal
- [x] `menu.js`, `index.html`, `admin.html`, `perfil.html` via `portal-db.js`.
- [x] `pages/` — páginas movidas (caminhos corrigidos).

### ✅ FASE 1.5 — Planilha colunar + adeus Firebase + importador por partes (esta PR)
- [x] **Formato colunar real** em todas as abas (acabou o `key | json` numa linha só). Ex.: `Usuarios` = `id | usuario | nome | sobrenome | email | telefone | cargo | …`.
- [x] **Codec do Menu**: aba `Menu` editável em colunas (`tipo`, `categoria`, `pai`, `ordem`, `titulo`, `url`, `icone`, permissões…), com remontagem transparente para o JSON que o portal espera.
- [x] **Menu de importação na planilha** (`⚙️ Portal`): cada parte importada separadamente, em lotes, com retomada automática se o tempo esgotar.
- [x] **Portal 100% planilha**: removida toda e qualquer conexão Firebase do front-end (`portal-db.js` sem fallback; 21 páginas de reporte apontadas para a camada única; `js/firebase.config.js` removido; textos da UI atualizados).
- [x] `salvados_procurarv3.html`: suporte no backend a `?orderBy="campo"&limitToLast=N` (usado pela página).

### 🔧 FASE 2 — Cérebro funcionando de verdade (esta PR)
A Fase 1.5 ligou a torneira, mas o portal **não carregava** menu, notícias, status nem usuários. Causas encontradas no `/exec` implantado:

1. **URL sem barra.** `PortalDB.URL` terminava em `/exec` e as páginas fazem `` `${base}menu_global.json` `` → virava `.../execmenu_global.json` (URL inválida).
2. **pathInfo exige login.** Mesmo com barra, `.../exec/menu_global.json` cai no login do Google (limitação do Apps Script em web app "Qualquer pessoa"). Por isso o GET raiz respondia `{error:"Rota inválida"}` e o path autenticava.
3. **Abas `db_*` no cérebro.** `setupPortal()` criava uma aba `db_<nó>` para cada página. **Esta planilha é só portal + config.** O DB de cada página continua na planilha que já existe dela e será ligado depois.

O que esta PR entrega:
- [x] `portal-db.js` reescreve GET para `?path=menu_global.json` (query pública) e devolve a base com `/`.
- [x] `Code.gs` lê `e.parameter.path`. Abrir `/exec` sem path agora devolve um JSON de saúde (`ok:true` + contagem por aba), não mais "Rota inválida".
- [x] Planilha **só cérebro**: Menu, Usuarios, Noticias, Status, Logs, Presenca, Favoritos, Cargos, Funcoes, BigQuery, `_Config`.
- [x] `setupPortal` não cria mais `db_*`. Menu da planilha ganhou **🧹 Remover abas db_***.
- [x] Cabeçalhos de Notícias / Status / BigQuery alinhados aos campos reais do portal (`corpo`, `tag`, `likes`, `likedBy`…).
- [ ] **Você:** colar o `Code.gs` novo + **Nova versão** da implantação (sem isso o `/exec` continua o código velho).
- [ ] Importar o núcleo (Menu, Usuários, Notícias, Status, Logs).

### 🔧 FASE 2.1 — Páginas (planilhas próprias, em andamento)
Cada página lê diretamente a planilha que **já existe** dela. Os dados não entram na planilha central nem em banco intermediário.

- [x] **`avarias-diario.html` — primeira integração:** lê a planilha `1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE` (gid `0`) pelo node `poka_avarias_diario`.
- [x] Adaptador somente leitura em `apps-script/avarias-diario/Code.gs`, com health check e preservação da exibição de datas/moedas.
- [x] Upload CSV, PapaParse e escrita da página removidos; carga inicial e botão de atualização leem a fonte oficial mantendo filtros, KPIs, gráficos, tabela, links e exportação.
- [ ] **Implantação externa:** colar o script na planilha, publicar para “Qualquer pessoa” e cadastrar o `/exec` em Admin → Planilhas por Página → Avarias — Diário.
- [ ] Migrar os demais reportes um por vez seguindo a regra de ouro registrada em `AGENTS.md`.

**Próximas páginas:** definir com o responsável conforme prioridade operacional.

### 🔜 FASE 3 — Melhorias (opcionais, escolha do usuário)
Ver §5.

---

## 4. Como implantar (passo a passo)

### 4.1 Criar a planilha + API
1. Crie um Google Sheets novo (ex.: "Portal — Banco de Dados").
2. Menu **Extensões → Apps Script**.
3. Cole o conteúdo de `apps-script/Code.gs` e **Salve**.
4. Volte à planilha e recarregue: aparece o menu **⚙️ Portal**.
5. Clique **⚙️ Portal → 1️⃣ Preparar planilha** (autorize o script na 1ª vez). Isso cria todas as abas colunares.
6. Importe os dados existentes do cérebro **parte por parte**:
   - **⚙️ Portal → 🧠 Importar — Núcleo do portal → 🔑 Usuários**, depois **🧭 Menu**, **📜 Logs**, etc.
   - Não importe reportes para a planilha central; cada página lê a planilha própria pelo adaptador somente leitura.
   - Se uma importação do núcleo parar no meio (ex.: muitos registros), rode o **mesmo item** de novo — ele continua de onde parou.
7. **Implantar → Nova implantação → Aplicativo da web** → executar como **Eu** → acesso **Qualquer pessoa**.
8. Copie a URL `/exec` gerada.

### 4.2 Ligar o cérebro do portal
1. Abra `js/portal-db.js`.
2. Troque `PortalDB.URL` pela URL `/exec` da planilha central.
3. O menu, login, Admin, notícias, status e logs passam a usar o cérebro central.

### 4.3 Ligar uma página de reporte
0. **Confira se a aba de dados existe na planilha da página** (o script não cria aba). A estrutura da aba (nome, posição/gid, cabeçalho e linha de exemplo) fica documentada no `COMO_IMPLANTAR.md` da página e é **avisada ao usuário na entrega** (regra das abas do `AGENTS.md`).
1. Na planilha da página, cole o adaptador `apps-script/<pagina>/Code.gs` em **Extensões → Apps Script**.
2. Publique como **Aplicativo da Web**, executando como **Eu**, com acesso para **Qualquer pessoa**.
3. Teste a URL `/exec`: o JSON de saúde deve conter `ok:true`.
4. No portal, abra **Admin → Planilhas por Página**, cole o `/exec` no campo daquela página, teste e salve.
5. Use **Versão / Cache** para propagar a URL aos usuários.

Para Avarias — Diário, siga `apps-script/avarias-diario/COMO_IMPLANTAR.md`.

---

## 5. 💡 Ideias de melhoria (avaliar quais usar)

1. ~~**Edição colunar das abas**~~ ✅ **Feito** (todas as abas são colunares; campos novos viram colunas automaticamente).
2. **Cargos e Funções como catálogos** — hoje os cargos são strings fixas (`view`, `view2`, `editor`, `admin`). Migrar para as abas `Cargos`/`Funcoes`, criadas no setup, permitindo novos cargos sem mexer em código.
3. **Autenticação no Apps Script** — validar um token/senha-mestra por requisição para não expor a API a terceiros.
4. **Auditoria de quem editou** — gravar `ultimaEdicao` (usuário + data) em cada registro alterado.
5. **Histórico/versionamento** — aba `_Historico` com cópia de versões anteriores (desfazer alterações).
6. **Cotas e throttling** — limitar tamanho de payload e frequência (páginas com muitos dados devem paginar).
7. ~~**Menu editável por planilha**~~ ✅ **Feito** (aba `Menu` em formato tabular de 3 níveis).
8. ~~**Remover dependências órfãs**~~ ✅ **Parcial** (`js/firebase.config.js` removido; `js/export-csv.js`, `js/mobile.js` e `mobile.css` seguem disponíveis, mas nenhuma página os usa).

---

## 6. Segurança (mantida como hoje)

- Senhas **nunca** em texto puro: hash **SHA-256** no navegador antes de gravar.
- O cargo `admin` continua sendo o único que vê o `admin.html`.
- Permissões por página continuam vindo do menu (`viewRoles`, `uploadRoles`, `allowedUsers`).

---

## 7. Critérios de aceite (Fase 2 — esta PR)

- [x] GET do portal vai para `/exec?path=...` (não mais `/exec/node.json`, que pedia login).
- [x] `/exec` sem path devolve saúde (`ok:true` + contagem por aba), não `"Rota inválida"`.
- [x] `setupPortal` cria só o cérebro. Existe **🧹 Remover abas db_***.
- [x] Cabeçalhos de Notícias/Status/BigQuery batem com o que o portal grava (`corpo`, `tag`, `data`…). O sistema de curtidas foi removido (sem `likes`/`likedBy` no front).
- [ ] Após **Nova versão** da implantação, abrir `/exec` mostra `{ok:true,…}`.
- [ ] Depois de importar o núcleo: menu, notícias, status, login e radar carregam no portal.

### Critérios de aceite — Avarias Diário

- [x] `avarias-diario.html` não oferece nem processa upload CSV.
- [x] A página usa `PortalDB.baseAtiva('pages/avarias-diario.html')` e mantém o node `poka_avarias_diario`.
- [x] O Apps Script dedicado lê a aba de dados (gid=0 → nome `Avarias Diario` → primeira aba) sem escrever na planilha e preserva valores exibidos.
- [x] O endpoint oferece health check validável pelo Admin.
- [x] A estrutura da aba (cabeçalho da linha 1) está documentada em `apps-script/avarias-diario/COMO_IMPLANTAR.md`.
- [ ] **Pendência do usuário:** criar a aba de dados na planilha de Avarias com o cabeçalho documentado.
- [ ] Após a implantação pelo responsável, filtros, KPIs, tabela, gráficos, links e exportação devem ser homologados com dados reais.

### Critérios de aceite — Home modernizada

- [x] Home com mensagem central de boas-vindas (título + usuário + data) e últimas notícias.
- [x] Removidos da Home: radar/logs, usuários logados (presença) e filtro de tags.
- [x] Sistema de curtidas removido do front (Home e Admin) — sem `likes`/`likedBy` no que o portal grava.
- [x] Logs movidos para aba **Admin → Logs** (somente admin).
- [ ] Usuário deve publicar **Nova versão / Cache** no Admin para todos receberem a Home nova.

## 8. Rollback

O front não tem mais fallback para Firebase. Para reverter código, restaure a versão anterior do repositório. A planilha original não é alterada pelo adaptador de Avarias, pois ele é somente leitura.
