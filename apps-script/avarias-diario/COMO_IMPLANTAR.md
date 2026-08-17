# Avarias — Diário: ligar a planilha ao portal

Planilha usada:

- `https://docs.google.com/spreadsheets/d/1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE/edit?gid=0#gid=0`
- Página: `pages/avarias-diario.html`
- Nó esperado pelo portal: `poka_avarias_diario`
- Script para copiar: [`Code.gs`](./Code.gs)

## 1. Colar o Apps Script

1. Abra a planilha de Avarias.
2. Acesse **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Code.gs` aberto pelo Google.
4. Cole todo o conteúdo de `apps-script/avarias-diario/Code.gs`.
5. Clique em **Salvar**.

O script já está configurado para a planilha informada (`planilhaId`) e para a aba `gid=0`. Ele usa a **linha 1 como cabeçalho**. Se o cabeçalho estiver em outra linha, altere apenas `linhaCabecalho` no bloco `CONFIG_AVARIAS`.

## 2. Publicar o `/exec`

1. No Apps Script, clique em **Implantar → Nova implantação**.
2. Em **Selecione o tipo**, escolha **Aplicativo da Web**.
3. Configure:
   - **Executar como:** Eu.
   - **Quem pode acessar:** Qualquer pessoa.
4. Clique em **Implantar** e autorize o acesso à planilha.
5. Copie a URL que termina em `/exec`.

> Quando alterar o código no futuro, use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. Só salvar o arquivo não atualiza o aplicativo publicado.

## 3. Testar antes de ligar

Abra a URL `/exec` no navegador. A resposta esperada começa assim:

```json
{
  "ok": true,
  "service": "portal-avarias-diario",
  "node": "poka_avarias_diario",
  "somenteLeitura": true
}
```

Para testar os dados, abra:

```text
SUA_URL_EXEC?path=poka_avarias_diario.json
```

A resposta deve ser uma lista JSON com uma linha da planilha por objeto.

## 4. Cadastrar no Admin

1. Abra **Admin → Planilhas por Página**.
2. Localize **Avarias — Diário** (`pages/avarias-diario.html`).
3. Cole a URL `/exec` no campo dessa página.
4. Clique em **Testar**.
5. Clique em **Salvar URLs**.
6. Abra **Versão / Cache**, gere uma nova versão e publique-a para propagar a configuração.

A partir daí, `avarias-diario.html` lê a planilha ao abrir e pelo botão **Atualizar dados**. Não há mais upload de CSV nem gravação em banco intermediário.
