-- =====================================================================
-- ESTÂNCIA 78 – GESTÃO RURAL · estrutura do banco no Supabase
-- Como usar: Supabase › SQL Editor › New query › cole tudo › Run.
-- ANTES de rodar, troque SEU_EMAIL_AQUI (última linha) pelo e-mail que
-- você vai usar para entrar no sistema.
-- =====================================================================

-- Pessoas autorizadas a acessar os dados da Estância 78
create table if not exists public.membros (
  email      text primary key,
  nome       text,
  criado_em  timestamptz not null default now()
);

-- Todos os registros do sistema (lançamentos, animais, lotes,
-- movimentações, ovos, contas, auditoria, configurações)
create table if not exists public.docs (
  colecao        text        not null,
  id             text        not null,
  data           jsonb       not null,
  user_id        uuid        default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (colecao, id)
);
create index if not exists docs_colecao_idx on public.docs (colecao);

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

-- Quem está logado é membro?
create or replace function public.eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros m
                 where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Segurança (RLS): só membros leem e gravam. Não há exclusão física:
-- o sistema usa exclusão lógica + auditoria.
alter table public.docs    enable row level security;
alter table public.membros enable row level security;

drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
create policy docs_select on public.docs for select to authenticated using (public.eh_membro());
create policy docs_insert on public.docs for insert to authenticated with check (public.eh_membro());
create policy docs_update on public.docs for update to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists membros_select on public.membros;
create policy membros_select on public.membros for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Acesso pela API (necessário quando o projeto não libera tabelas novas automaticamente)
grant usage on schema public to authenticated;
grant select, insert, update on public.docs to authenticated;
grant select on public.membros to authenticated;
grant execute on function public.eh_membro() to authenticated;

-- Tempo real (sincronizar celular e notebook)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- >>> TROQUE PELO SEU E-MAIL <<<
insert into public.membros (email, nome) values ('SEU_EMAIL_AQUI', 'Proprietário')
on conflict (email) do nothing;

-- Para liberar outra pessoa depois:
-- insert into public.membros (email, nome) values ('outra@pessoa.com', 'Nome');
