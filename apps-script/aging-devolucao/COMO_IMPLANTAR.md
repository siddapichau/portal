# Aging Devolução: ligar a planilha ao portal

- Página: `pages/aging-devolucao.html`
- Nó esperado pelo portal: `devolucao`
- Script para copiar: [`Code.gs`](./Code.gs)

---

## 0. Como criar a aba no DB Central (Cérebro do Portal) para os links `/exec`

Para que **todos os usuários do portal** vejam os dados das planilhas cadastradas no Admin (e não apenas quem salvou), a planilha central do portal precisa ter a aba **`_Config`**:

### Estrutura da aba `_Config` na planilha central do portal:

1. Abra a planilha central do portal (a do "cérebro" onde ficam `Usuarios`, `Menu`, `Noticias`, `Status`...).
2. Crie uma nova aba com o **nome exato**: **`_Config`** (com o sublinhado `_` na frente e `C` maiúsculo).
3. Na **Linha 1 (Cabeçalho)**, preencha exatamente:

| Coluna A | Coluna B |
|---|---|
| **chave** | **valor** |

4. **Exemplo de linhas gravadas na aba `_Config`:**

| chave | valor |
|---|---|
| `versao` | `2.3-cerebro-global-cache` |
| `app_versao` | `1` |
| `requer_aprovacao` | `true` |
| `portal_titulo` | `Portal de Reportes` |
| `url_pages/avarias-diario.html` | `https://script.google.com/macros/s/AKfy.../exec` |
| `url_pages/aging-devolucao.html` | `https://script.google.com/macros/s/AKfy.../exec` |

> 💡 **Por que isso é necessário?**
> Quando você salva uma URL no menu **Admin → Planilhas por Página**, o portal grava a chave `url_pages/<arquivo>.html` na aba `_Config` da planilha central. Ao abrir qualquer página, o portal consulta a aba `_Config` e direciona as consultas para o `/exec` da planilha correspondente.

---

## 1. Criar a aba de dados na Planilha de Aging Devolução

A API de Aging Devolução é somente leitura: **ela não cria abas nem altera células**. A aba com os dados precisa existir na planilha de Aging Devolução, criada manualmente:

1. Abra a planilha de **Aging Devolução**.
2. **A aba de dados deve ser a primeira aba da planilha** (gid=0, a aba que o script procura primeiro). Se preferir outro nome, o script também aceita a aba chamada **`Aging Devolucao`** ou, em último caso, a primeira aba que existir.
3. **Linha 1 = cabeçalho** com exatamente estas colunas (uma por coluna):

| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E | Coluna F | Coluna G | Coluna H |
|---|---|---|---|---|---|---|---|
| ID do envio | Substatus do envio | Aging Sorting | Aging Devolução | Valor declarado | Preparação | Suporte | Análise |

4. **Dados a partir da linha 2**, um envio por linha:

| ID do envio | Substatus do envio | Aging Sorting | Aging Devolução | Valor declarado | Preparação | Suporte | Análise |
|---|---|---|---|---|---|---|---|
| 43981274912 | ready_to_pack | 3 | 5 | 189,90 | Operador 01 | Suporte Logística | Em triagem |
| 43981274913 | packed | 1 | 2 | 450,00 | Operador 02 | Suporte Logística | Liberado |

> 💡 **Dicas para o preenchimento**
> - **ID do envio**: número do pacote/shipment. É o que gera o link de detalhes para o painel de envios.
> - **Substatus do envio**: status do pacote (ex: `ready_to_pack`, `packed`, `waiting_for_carrier`...). Usado para montar o gráfico de barras.
> - **Aging Sorting** e **Aging Devolução**: dias de aging (número inteiro). A tabela ordena automaticamente por Aging Sorting decrescente.
> - **Valor declarado**: valor monetário (ex: `189,90` ou `R$ 189,90`).
> - **Preparação / Suporte / Análise**: textos informativos exibidos no cartão "Diário de Bordo".
> - A página localiza as colunas por palavras-chave (`id`, `substatus`, `sorting`, `devolu`, `valor`, `prep`, `análise` / `suporte`).

---

## 2. Colar o Apps Script na Planilha de Aging Devolução

1. Abra a planilha de Aging Devolução.
2. Acesse **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Code.gs` aberto pelo Google.
4. Cole todo o conteúdo de `apps-script/aging-devolucao/Code.gs`.
5. Clique em **Salvar** (ícone de disquete).

---

## 3. Publicar o `/exec`

1. No Apps Script, clique em **Implantar → Nova implantação**.
2. Em **Selecione o tipo** (ícone de engrenagem), escolha **Aplicativo da Web**.
3. Configure:
   - **Descrição:** `API Aging Devolucao`
   - **Executar como:** `Eu` (sua conta Google).
   - **Quem pode acessar:** `Qualquer pessoa`.
4. Clique em **Implantar** e autorize o acesso se solicitado pelo Google.
5. Copie a URL gerada que termina em `/exec`.

---

## 4. Testar a URL no Navegador

Abra a URL `/exec` no navegador. A resposta esperada deve ser um JSON com `ok: true`:

```json
{
  "ok": true,
  "service": "portal-aging-devolucao",
  "versao": "1.0.0",
  "planilha": "Nome da sua Planilha",
  "aba": "Aging Devolucao",
  "gid": 0,
  "registros": 2,
  "node": "devolucao",
  "somenteLeitura": true,
  "uso": "GET /exec?path=devolucao.json"
}
```

Para visualizar os dados brutos, acerte o path:
```text
SUA_URL_EXEC?path=devolucao.json
```

---

## 5. Cadastrar no Admin do Portal

1. Abra o portal e acesse o menu **Admin**.
2. Clique na aba **🔗 Planilhas por Página**.
3. Localize a linha **Aging de Devolução** (`pages/aging-devolucao.html`).
4. Cole a URL `/exec` no campo correspondente.
5. Clique no botão **🔌 Testar** (deve exibir mensagem de sucesso em verde).
6. Clique no botão **💾 Salvar URLs**.
7. Em seguida, clique na aba **🔄 Versão / Cache**, clique em **⚡ Gerar automática** e depois em **💾 Salvar e limpar cache global**.

Pronto! A página `pages/aging-devolucao.html` passará a ler diretamente da sua planilha Google de Aging Devolução para todos os usuários do portal.
