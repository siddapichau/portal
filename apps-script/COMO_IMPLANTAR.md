# Como implantar o cérebro (obrigatório)

O `/exec` que já está no ar ainda roda o código **antigo**. Sem os 4 passos abaixo o portal continua sem menu, sem notícias e sem login.

## 1. Colar o código novo

1. Abra a planilha do portal → **Extensões → Apps Script**.
2. Apague o conteúdo e cole `Code.gs` deste repositório.
3. **Salvar** (Ctrl+S).

## 2. Limpar a planilha

Na planilha (recarregue a aba se o menu **⚙️ Portal** não aparecer):

1. **⚙️ Portal → 1️⃣ Preparar planilha (só o cérebro)**  
   Cria Menu, Usuarios, Noticias, Status, Logs, Presenca, Favoritos, Cargos, Funcoes, BigQuery, `_Config`.
2. **⚙️ Portal → 🧹 Remover abas db_***  
   Apaga `db_equipamentos`, `db_aderencia`, etc. Esta planilha não guarda DB de página.

## 3. Importar o núcleo (uma parte por vez)

**⚙️ Portal → 🧠 Importar — Núcleo do portal**

Ordem mínima para o portal “acordar”:

1. 🔑 Usuários  
2. 🧭 Menu  
3. 📰 Notícias  
4. 📊 Status dos reportes  
5. 📜 Logs  

Se uma importação parar no meio, rode o **mesmo item** de novo.

## 4. Nova versão da implantação

1. No Apps Script: **Implantar → Gerenciar implantações**.
2. Ícone de lápis da implantação atual.
3. **Versão → Nova versão → Implantar**.

Teste: abra a URL `/exec` no navegador.

- Certo: `{ "ok": true, "service": "portal-cerebro", "nodes": { "menu_global": { "registros": N }, ... } }`
- Errado: `{ "error": "Rota inválida" }` → a versão nova **não** foi implantada. Repita o passo 4.

A URL já está em `js/portal-db.js` (`PortalDB.URL`). Só troque se o ID da implantação mudar.
