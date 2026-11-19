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
src/0-supabase.js  Adaptador Supabase + login
src/1-core.js      Núcleo: constantes, banco, modal, utilidades
src/2-financeiro.js
src/3-animais.js
src/4-paginas.js   Dashboard, Despesas Gerais, Configurações, rotas
build.py           Gera index.html (arquivo único)
config.js          URL e chave pública do Supabase
supabase/schema.sql  Tabelas, segurança (RLS) e tempo real
tests/             Testes ponta a ponta (Playwright + banco simulado)
```

## Banco de dados — dois modos
O mesmo `index.html` funciona de duas formas:

1. **Site próprio (Vercel + Supabase)** — quando `config.js` tem a URL e a chave *anon* do
   Supabase. Login por e-mail e senha; só e-mails cadastrados na tabela `membros` acessam.
   Dados na tabela `public.docs` (colecao, id, data jsonb), com RLS e tempo real.
2. **Dentro do Claude** (artifact) — quando `config.js` não está preenchido.

Coleções: `lancamentos`, `contas`, `animais`, `lotes`, `movimentacoes`, `ovos`,
`auditoria`, `config/geral`. Backup/importação em JSON em Configurações.

### Publicar
1. Supabase › SQL Editor: rode `supabase/schema.sql` (troque `SEU_EMAIL_AQUI`).
2. Supabase › Project Settings › API: copie *Project URL* e *anon public* para `config.js`.
3. Vercel › Add New › Project › importe este repositório › Framework *Other* › Deploy.
4. Supabase › Authentication › URL Configuration: *Site URL* = endereço do Vercel.

## Build e testes
```
python3 build.py
pip install playwright && playwright install chromium
npm i chart.js@4.4.1 xlsx@0.18.5   # usados nos testes offline
python3 tests/test.py      # modo Claude
python3 tests/test_sb.py   # modo Supabase
```
