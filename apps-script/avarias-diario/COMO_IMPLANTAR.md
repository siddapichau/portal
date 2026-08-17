# Avarias — Diário: ligar a planilha ao portal

Planilha usada:

- `https://docs.google.com/spreadsheets/d/1gpWUaprT7Av1eamHljBB8gfsdawYKoGA0wpmPOtZzbE/edit?gid=0#gid=0`
- Página: `pages/avarias-diario.html`
- Nó esperado pelo portal: `poka_avarias_diario`
- Script para copiar: [`Code.gs`](./Code.gs)

## 0. Criar a aba de dados na planilha (passo que faltou)

A API é somente leitura: **ela não cria aba**. A aba com os dados precisa existir na planilha de Avarias, criada manualmente:

1. Abra a planilha de Avarias.
2. **A aba de dados deve ser a primeira aba da planilha** (gid=0, a aba que o script procura primeiro). Se preferir outro nome, tudo bem — o script também aceita a aba chamada **`Avarias Diario`** ou, em último caso, a primeira aba que existir.
3. **Linha 1 = cabeçalho** com exatamente estas colunas (uma por coluna):

| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E | Coluna F | Coluna G | Coluna H | Coluna I | Coluna J |
|---|---|---|---|---|---|---|---|---|---|
| ID do pacote | ID da avaria | Data | Semana | Lançado Por | Descrição | Valor | Origem de dano | Resolução | Status de resolução |

4. **Dados a partir da linha 2**, um pacote por linha:

| ID do pacote | ID da avaria | Data | Semana | Lançado Por | Descrição | Valor | Origem de dano | Resolução | Status de resolução |
|---|---|---|---|---|---|---|---|---|---|
| ML1234567890 | AV-98765 | 15/08/2026 | Semana 33 | joao.silva | Vidro trincado no transporte | 250,00 | Transporte | Em análise | Pendente |

> 💡 **Dicas**
> - **Data**: use `dd/mm/aaaa` (ou formato de data do Google Sheets). A página mostra e filtra por dia.
> - **Semana**: preencha com algo como `Semana 33` para o gráfico "Avarias por Semana".
> - **Valor**: pode ser número puro (`250`) ou com `R$` (`R$ 250,00`) — a página entende os dois.
> - **ID da avaria**: é o que gera o link "Ver Avaria". Se não tiver, deixe vazio.
> - A página localiza as colunas por **palavras-chave** (`data`, `valor`, `origem`, `resolução`, `lançado`…), então nomes parecidos funcionam, mas use os nomes acima para garantir.
> - **Não crie abas `db_*`** nem outras abas de controle — o script lê somente essa aba.

## 1. Colar o Apps Script

1. Abra a planilha de Avarias.
2. Acesse **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Code.gs` aberto pelo Google.
4. Cole todo o conteúdo de `apps-script/avarias-diario/Code.gs`.
5. Clique em **Salvar**.

O script já está configurado para a planilha informada (`planilhaId`), procura a aba `gid=0` (ou `Avarias Diario`, ou a primeira aba) e usa a **linha 1 como cabeçalho**. Se o cabeçalho estiver em outra linha, altere apenas `linhaCabecalho` no bloco `CONFIG_AVARIAS`.

> ⚠️ **Já colou o script antes?** Substitua o conteúdo do `Code.gs` pelo novo (que aceita a aba por nome/primeira aba) e depois publique uma **Nova versão** (passo 2) — salvar sozinho não atualiza o `/exec`.

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
