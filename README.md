# ESTÂNCIA 78 – Gestão Rural

**Dados. Manejo. Resultado.**

Sistema web de gestão rural: bovinos, suínos, galinhas, financeiro, despesas gerais e indicadores gerenciais.

## Módulos
- Dashboard com indicadores financeiros, de animais e 6 gráficos
- Financeiro: receitas/despesas, contas a pagar e a receber, parcelas, pagamentos parciais, recorrência, fluxo de caixa, contas
- Bovinos: cadastro individual, pesagem (GMD), transferências, categorias, vendas, mortalidade
- Suínos: lotes, plantel individual, desmame, transferências, comercialização (cabeça, kg, lote)
- Galinhas: lotes, produção e venda de ovos
- Despesas Gerais com classificação obrigatória (operacional, geral, investimento, patrimônio, manutenção)
- Auditoria, exclusão lógica, backup JSON, exportação Excel

- Estoque: insumos, entradas (com despesa), consumo, ajuste, preço médio, alertas de mínimo e validade
- Manejo: vacinação, vermifugação, medicamentos, alimentação; baixa automática no estoque; carência; próxima dose no calendário
- Reprodução: coberturas, diagnóstico, partos (cria bezerro/leitegada), desmame, abortos
- Calendário: mês/semana/dia, clique na data para incluir/concluir/excluir, repetição, lembretes
- Custos: por cabeça, lote/pastagem, matriz, leitegada, leitão nascido/desmamado, suíno terminado, kg, ave, dúzia
- Patrimônio: bens, melhorias, vínculo com investimentos, rebanho por categoria, evolução mensal
- Relatórios: 21 relatórios (incl. DRE gerencial consolidada/mensal/por atividade) em PDF e Excel
- Ícone do app (PWA): no celular, "Adicionar à tela inicial"

## Estrutura
```
src/shell.html     HTML + CSS (identidade visual)
src/logo.svg       Marca
src/0-supabase.js  Adaptador Supabase + login
src/1-core.js      Núcleo: constantes, banco, modal, utilidades
src/2-financeiro.js
src/3-animais.js
src/4-paginas.js   Dashboard, Despesas Gerais, Configurações, rotas
build.py           Gera index.html (site, carrega src/*.js) e dist/estancia78.html (arquivo único p/ Claude)
config.js          URL e chave pública do Supabase
icons/, manifest.webmanifest  Ícones do site e do app
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
npm i chart.js@4.4.1 xlsx@0.18.5 jspdf@2.5.1 jspdf-autotable@3.8.2   # usados nos testes offline
python3 tests/test.py      # modo Claude
python3 tests/test_sb.py   # modo Supabase
python3 tests/test_e23.py  # estoque, manejo, reprodução, calendário, custos, patrimônio, relatórios
```
