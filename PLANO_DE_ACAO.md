# 🧠 Plano de Ação — Portal 100% via Planilha (Google Sheets)

> **Autor:** Equipe de engenharia do Portal de Reportes
> **Objetivo:** Substituir o Firebase Realtime Database por um **Google Sheets (planilha)** como único banco de dados do portal, **sem mudar a experiência do usuário final**, e organizar as páginas dentro de `pages/`.
> **Estratégia:** execução **por fases** (cérebro primeiro, depois página a página), cada fase entregue como um Pull Request separado e testável.

---

## 1. Diagnóstico da arquitetura atual

O portal hoje é um SPA estático (`index.html` + `menu.js` como "corpo") que carrega páginas de reporte dentro de um `<iframe>`. Todo dado vem do **Firebase Realtime Database** via `fetch` REST (`https://reportes-bdb0a-default-rtdb.firebaseio.com/...`).

### 1.1 "Cérebro" e "corpo" (o núcleo que todas as páginas usam)

| Nó (Firebase) | Conteúdo | Quem usa |
|---|---|---|
| `menu_global` | Estrutura do menu (categorias → itens → subitens, com permissões `viewRoles`/`uploadRoles`/`allowedUsers`) | `menu.js`, `admin.html` |
| `users` | Usuários (`usuario`, `email`, `senha`, `cargo`, `solicitacao`, `favorito`, `avatar`, `nome`, `sobrenome`, `telefone`) | `menu.js` (login/registro), `index.html`, `admin.html`, `perfil.html` |
| `logs` | Radar de atividades (auditoria) | `index.html`, `admin.html`, `perfil.html`, todas as páginas |
| `portal_news` | Mural de notícias | `index.html`, `admin.html`, `perfil.html` |
| `portal_status` | Central de status dos reportes (ON/OFF) | `menu.js`, `index.html`, `admin.html` |
| `portal_bigquery` | Biblioteca de queries | `admin.html`, `perfil.html`, `bigquery.html` |
| `presence` | Quem está online agora | `index.html` |
| `user_bookmarks` | Cofre de favoritos (backup `.html`) | `perfil.html` |
| **`cargos`** 🆕 | Níveis de acesso (view / view2 / editor / admin) | *novo — ver §5* |
| **`funcoes`** 🆕 | Funções de trabalho (Inventário, Aduana, Tratativas…) | *novo — ver §5* |

### 1.2 Páginas de reporte (convertidas na Fase 2, página a página)

Cada página de reporte tem o mesmo padrão: lê o seu "nó" do Firebase, permite **subir CSV/XLSX** (parsing via PapaParse), salva no Firebase e baixa CSV. Os nós são, por exemplo:

`equipamentos`, `aderencia`, `devolucao`, `ofensores`, `salvados_aprendizado`, `salvados_encontrados`, `salvados_ia_config`, `salvados_ia_keys`, `emails_tratativas`, `insumos`, `parado_percurso`, `parado_percurso_emails`, `pendencias_cftv_consolidado`, `poka_avarias_diario`, `salvados_recuperados`, e demais.

> 📌 **Ponto-chave:** todas as páginas hoje **mandam CSV/XLSX para o Firebase**. A migração da Fase 2 troca o *destino* desses dados: em vez de "mandar CSV", a página passa a **ler e gravar direto na aba correspondente da planilha**.

---

## 2. Arquitetura alvo (planilha como banco)

```
┌──────────────┐   fetch/JSON   ┌───────────────────────────┐   lê/escreve   ┌──────────────────┐
│  Portal Web   │ ─────────────▶ │ Google Apps Script (API)  │ ─────────────▶ │ Google Sheets     │
│  (HTML/JS)    │ ◀───────────── │  /exec  (REST compatível) │ ◀───────────── │  (planilha = BD)  │
└──────────────┘                └───────────────────────────┘                └──────────────────┘
```

- **Google Sheets** = banco de dados. Cada "nó" do Firebase vira uma **aba** da planilha.
- **Google Apps Script** = a API (middleware) que o portal chama. Ela é **compatível com o formato que o portal já usa** (`users.json`, `users/abc.json`, etc.), então a troca é quase transparente para o código.
- **`js/portal-db.js`** = camada de acesso no front-end ("cérebro centralizado"). Hoje cada arquivo tem o seu `const FIREBASE_URL` duplicado; passamos a ter **um único ponto de configuração**.

### 2.1 Modelo da planilha (abas)

| Aba | Nó equivalente | Conteúdo |
|---|---|---|
| `_Config` | — | Parâmetros (versão, mapa nó→aba, flag de migração) |
| `Usuarios` | `users` | Contas de acesso |
| `Cargos` 🆕 | `cargos` | Níveis de acesso e permissões |
| `Funcoes` 🆕 | `funcoes` | Funções/departamentos |
| `Menu` | `menu_global` | Estrutura completa do menu |
| `Noticias` | `portal_news` | Mural |
| `Status` | `portal_status` | Central de status |
| `BigQuery` | `portal_bigquery` | Biblioteca de queries |
| `Logs` | `logs` | Auditoria/radar |
| `Presenca` | `presence` | Usuários online |
| `Favoritos` | `user_bookmarks` | Cofre de favoritos |
| `db_equipamentos`, `db_aderencia`, … | nós das páginas | Dados de cada reporte (Fase 2) |

> Cada aba usa o layout **`[key | json]`** — coluna A com a chave do registro e coluna B com o objeto JSON completo. Isso **preserva exatamente** a estrutura atual ("tudo funcionando exatamente como é") e é genérico o suficiente para qualquer página sem reescrever o backend. As abas `Usuarios`, `Cargos` e `Funcoes` também ganham colunas legíveis para edição humana (ver §5 — melhoria).

---

## 3. Fases do projeto

### ✅ FASE 0 — Preparação (esta PR já inclui os artefatos)
- [x] Documento deste plano.
- [x] Backend `apps-script/Code.gs` (API REST sobre a planilha + `setup()` que cria as abas + `importarDoFirebase()` para migrar dados).
- [x] Camada `js/portal-db.js` (configuração única + tradutor de métodos).
- [x] Páginas movidas para `pages/` com caminhos corrigidos.

### ✅ FASE 1 — Cérebro e corpo principal (esta PR)
Converte **o núcleo** (o que a página admin e o menu usam) para a planilha:

- [x] `menu.js` — menu, login, registro, favoritos, avatar → via `portal-db.js`.
- [x] `index.html` — radar, mural, equipe, presença, notificações → via `portal-db.js`.
- [x] `admin.html` — gestão de menus, usuários, notícias, status e BigQuery → via `portal-db.js`.
- [x] `perfil.html` — dados, senha, cofre, radar, publicações → via `portal-db.js`.
- [x] `js/portal-db.js` — ponto único de configuração da URL da API.
- [x] `pages/` — todas as páginas movidas (caminhos `style.css`, redirecionamento anti-acesso-direto e links corrigidos).

> **Comportamento:** o portal continua funcionando **idêntico**. A única diferença é *onde* os dados moram (planilha em vez de Firebase). Enquanto a URL da API não for configurada, cai automaticamente no Firebase (fallback) — zero downtime.

### 🔜 FASE 2 — Página a página (1 PR por página)
Para **cada** página de reporte, a mudança é pequena e padronizada:

1. Incluir `<script src="../js/portal-db.js"></script>`.
2. Trocar o `const FIREBASE_URL = "…firebaseio…"` por `const FIREBASE_URL = PortalDB.baseAtiva();` (1 linha).
3. Opcional: substituir o "subir CSV → salvar no Firebase" por "ler/gravar direto na aba da planilha" (mantendo o upload de CSV como **opcional**).
4. Testar leitura, upload, backup diário e exportação.

**Ordem sugerida** (começar pelas mais críticas): `equipamentos.html` → `salvados_procurarv3.html` → `parado_percurso.html` → `pendencias_cftv.html` → `avarias-diario.html` → … até cobrir todas.

### 🔜 FASE 3 — Melhorias (opcionais, escolha do usuário)
Ver §5.

---

## 4. Como implantar (passo a passo)

### 4.1 Criar a planilha + API
1. Crie um Google Sheets novo (ex.: "Portal — Banco de Dados").
2. Menu **Extensões → Apps Script**.
3. Cole o conteúdo de `apps-script/Code.gs` e **Salve**.
4. Execute a função `setupPortal()` **uma vez** (autorize). Isso cria as abas e dados de exemplo.
5. Se quiser migrar o que já existe no Firebase, edite `FIREBASE_URL_ORIGEM` e execute `importarDoFirebase()`.
6. **Implantar → Nova implantação → Aplicativo da web** → executar como **Eu** → acesso **Qualquer pessoa**.
7. Copie a URL `/exec` gerada.

### 4.2 Ligar o portal
1. Abra `js/portal-db.js`.
2. Troque `PortalDB.URL` pela sua URL `/exec` copiada acima.
3. Pronto. (Onde não houver URL, o portal usa o Firebase automaticamente — dá para migrar em paralelo.)

---

## 5. 💡 Ideias de melhoria (avaliar quais usar)

1. **Edição colunar das abas** — além da coluna `json`, gerar colunas legíveis (ex.: `Usuarios` com `usuario | email | cargo | status`), para editar usuários direto na planilha sem tocar em JSON. *(recomendado para `Usuarios`, `Cargos`, `Funcoes` e `Menu`)*
2. **Cargos e Funções como catálogos** — hoje os cargos são strings fixas (`view`, `view2`, `editor`, `admin`). Migrar para tabelas `Cargos` (nível de acesso) e `Funcoes` (área/função), permitindo criar novos cargos/funções sem mexer em código. Os campos `viewRoles`/`uploadRoles` passam a referenciar os catálogos.
3. **Autenticação no Apps Script** — validar um token/senha-mestra por requisição para não expor a API a terceiros.
4. **Auditoria de quem editou** — gravar `ultimaEdicao` (usuário + data) em cada registro alterado.
5. **Histórico/versionamento** — aba `_Historico` com cópia das versões anteriores (desfazer alterações).
6. **Cotas e throttling** — limitar tamanho de payload e frequência (Apps Script tem cotas; páginas com muitos dados devem paginar).
7. **Menu editável por planilha** — representação tabular do menu (linha = item, colunas = categoria/nível/roles) em vez de JSON.
8. **Remover dependências órfãs** — `js/firebase.config.js`, `js/export-csv.js`, `js/mobile.js` e `mobile.css` existem mas não estão sendo usados por nenhuma página; consolidar em `portal-db.js` ou remover.

---

## 6. Segurança (mantida como hoje)

- Senhas **nunca** em texto puro: hash **SHA-256** no navegador antes de gravar (igual ao comportamento atual).
- O cargo `admin` continua sendo o único que vê o `admin.html`.
- Permissões por página continuam vindo do menu (`viewRoles`, `uploadRoles`, `allowedUsers`).

---

## 7. Critérios de aceite (Fase 1)

- [ ] Portal abre, login/registro funcionam.
- [ ] Menu carrega e respeita cargos/permissões.
- [ ] Painel admin (menus, usuários, notícias, status, BigQuery) funciona gravando na planilha.
- [ ] Perfil (dados, senha, cofre, radar, publicações) funciona.
- [ ] Todas as páginas abrem dentro de `pages/` (sem 404 de CSS/redirecionamento).
- [ ] Sem regressão visual ou de fluxo em relação ao estado atual.

## 8. Rollback

Como a camada `portal-db.js` tem **fallback automático para o Firebase**, reverter é só apagar a URL em `js/portal-db.js` (ou trocar `MODE` para `firebase`). Nenhuma página quebra.
