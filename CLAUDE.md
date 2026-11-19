# ESTÂNCIA 78 – Gestão Rural

Sistema web estático (HTML + JS puro) publicado pelo **Vercel** a partir da branch `main`
(https://estancia-78.vercel.app). Dados no **Supabase** (tabela `public.docs`, RLS por `membros`).

## Fluxo de alteração (o proprietário quer publicação automática)
1. Editar os módulos em `src/` (`0-supabase.js` … `6-etapa3.js`, `9-boot.js`, `shell.html` = HTML/CSS).
2. Rodar `python3 build.py` → gera `index.html` (site, carrega `src/*.js?v=` com versão nova)
   e `dist/estancia78.html` (arquivo único usado no artifact do Claude; não versionado).
3. Testar (`tests/`, Playwright com Supabase simulado) e fazer commit + push em `main`.
   O Vercel publica sozinho em ~1 minuto.

## Regras
- Não alterar `config.js` (URL + chave pública do Supabase do projeto).
- Mudança de estrutura de dados: tudo fica em `docs` (colecao, id, data jsonb); não precisa SQL novo.
- Exclusões são lógicas (`excluido: true`) + auditoria. Não misturar investimentos com custos operacionais.
- Interface e textos em português do Brasil.
