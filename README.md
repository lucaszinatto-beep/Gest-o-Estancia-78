# ESTÂNCIA 78 – Gestão Rural

**Dados. Manejo. Resultado.**

Sistema web de gestão rural: bovinos, suínos, galinhas, financeiro, despesas gerais e indicadores gerenciais.

## Etapa 1 (atual)
- Dashboard com indicadores financeiros, de animais e 6 gráficos
- Financeiro: receitas/despesas, contas a pagar e a receber, parcelas, pagamentos parciais, recorrência, fluxo de caixa, contas
- Bovinos: cadastro individual, pesagem (GMD), transferências, categorias, vendas, mortalidade
- Suínos: lotes, plantel individual, desmame, transferências, comercialização (cabeça, kg, lote)
- Galinhas: lotes, produção e venda de ovos
- Despesas Gerais com classificação obrigatória (operacional, geral, investimento, patrimônio, manutenção)
- Auditoria, exclusão lógica, backup JSON, exportação Excel

Próximas etapas: Manejo, Reprodução, Calendário, Estoque (2) · Custos, DRE, Patrimônio, Relatórios PDF (3).

## Estrutura
```
src/shell.html     HTML + CSS (identidade visual)
src/logo.svg       Marca
src/1-core.js      Núcleo: constantes, banco, modal, utilidades
src/2-financeiro.js
src/3-animais.js
src/4-paginas.js   Dashboard, Despesas Gerais, Configurações, rotas
build.py           Gera index.html (arquivo único)
tests/             Testes ponta a ponta (Playwright + banco simulado)
```

## Banco de dados
Hoje o sistema roda como artifact no Claude e usa o banco `db` do próprio Claude
(`claude.use("db")`), com login da conta Claude. Coleções: `lancamentos`, `contas`,
`animais`, `lotes`, `movimentacoes`, `ovos`, `auditoria`, `config/geral`.

Fora do Claude (ex.: Vercel) o `index.html` abre, mas não conecta ao banco — para isso
a camada de dados (`initDB`, `dbSet`, `dbUpd` em `src/1-core.js`) precisa ser trocada
por outro banco (ex.: Supabase).

## Build e testes
```
python3 build.py
pip install playwright && playwright install chromium
npm i chart.js@4.4.1 xlsx@0.18.5   # usados nos testes offline
python3 tests/test.py
```
