# 🧠 Plano de Ação — Portal 100% via Planilha (Google Sheets)

> **Autor:** Equipe de engenharia do Portal de Reportes
> **Objetivo:** Substituir o Firebase Realtime Database por um **Google Sheets (planilha)** como único banco de dados do portal, **sem mudar a experiência do usuário final**, e organizar as páginas dentro de `pages/`.
> **Estratégia:** execução **por fases** (cérebro primeiro, depois página a página), cada fase entregue como um Pull Request separado e testável.

---

## 1. Diagnóstico da arquitetura atual

O portal hoje é um SPA estático (`index.html` + `menu.js` como "corpo") que carrega páginas de reporte dentro de um `<iframe>`. Todo dado vem do **Firebase Realtime Database** via `fetch` REST.

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
- **Google Apps Script** (`apps-script/Code.gs`) = a API. Contrato **idêntico** ao Firebase REST, então nenhuma página precisou mudar de lógica — só a URL base.
- **`js/portal-db.js`** = ponto único de configuração (URL da API + tradutor de métodos).
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

### 🔜 FASE 2.1 — Páginas (planilhas próprias, futuro)
Cada página puxa o DB da planilha que **já existe** dela. Não entra nesta planilha do portal.

**Ordem sugerida quando formos ligar:** `equipamentos.html` → `salvados_procurarv3.html` → `parado_percurso.html` → `pendencias_cftv.html` → `avarias-diario.html` → … até cobrir todas.

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
6. Importe os dados existentes **parte por parte**:
   - **⚙️ Portal → 🧠 Importar — Núcleo do portal → 🔑 Usuários**, depois **🧭 Menu**, **📜 Logs**, etc.
   - Depois **📄 Importar — Páginas (reportes)**, um item por página, conforme a Fase 2 for avançando.
   - Se uma importação parar no meio (ex.: muitos registros), rode o **mesmo item** de novo — ele continua de onde parou.
7. **Implantar → Nova implantação → Aplicativo da web** → executar como **Eu** → acesso **Qualquer pessoa**.
8. Copie a URL `/exec` gerada.

### 4.2 Ligar o portal
1. Abra `js/portal-db.js`.
2. Troque `PortalDB.URL` pela sua URL `/exec` copiada acima.
3. Pronto — o portal inteiro já nasce apontado para a planilha (não há mais Firebase para cair).

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
- [x] Cabeçalhos de Notícias/Status/BigQuery batem com o que o portal grava (`corpo`, `tag`, `likes`…).
- [ ] Após **Nova versão** da implantação, abrir `/exec` mostra `{ok:true,…}`.
- [ ] Depois de importar o núcleo: menu, notícias, status, login e radar carregam no portal.

## 8. Rollback

O front não tem mais fallback para Firebase. Para reverter, restore a versão anterior do repositório (o Firebase de origem **não é alterado** pelas importações — elas só leem). A planilha pode ser reconstruída a qualquer momento refazendo o setup + importações.
