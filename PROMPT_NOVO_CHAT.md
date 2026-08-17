# Prompt curto para iniciar um novo chat

Copie e cole o texto abaixo apenas se o agente não carregar automaticamente o `AGENTS.md` da raiz:

```text
Estamos trabalhando no repositório Portal de Reportes. Antes de agir, leia somente o AGENTS.md da raiz e rode git status; ele contém a arquitetura, a regra de ouro, o fluxo de migração e o estado atual. Não releia todos os HTMLs nem faça uma auditoria geral. Depois, examine apenas os arquivos diretamente relacionados ao pedido que eu fizer.

Regra de ouro: cada página de reporte deve apenas ler a planilha Google própria por meio do Apps Script /exec cadastrado em Admin → Planilhas por Página. Não reintroduza upload CSV, Firebase, banco intermediário ou abas db_*. Preserve exatamente os dashboards, filtros, KPIs, gráficos, tabelas, links e exportações existentes.

Meu pedido neste chat é:
[ESCREVA AQUI A PRÓXIMA TAREFA]
```

O contexto detalhado não é duplicado aqui para evitar divergência. Atualize `AGENTS.md` e `PLANO_DE_ACAO.md` quando uma nova página for migrada.
