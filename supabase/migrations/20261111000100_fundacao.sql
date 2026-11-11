-- =============================================================================
-- Etapa 01 · Fundação: organização, setores, perfis, papéis, permissões,
-- convites, auditoria, rate limit e configurações internas.
-- =============================================================================
-- Princípios
--   * Toda tabela de negócio tem organization_id.
--   * Autorização = permissão "modulo.recurso.acao" com escopo
--       own (meu) < clients (clientes em que estou marcado) < sector (meu setor) < all
--     calculada por funções SECURITY DEFINER no schema private (search_path = '').
--   * RLS em todas as tabelas; nenhuma política USING (true).
--   * audit_logs é somente inserção (triggers).
--   * UTF-8 em tudo; textos em português do Brasil.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- anon não acessa nada no schema public (páginas públicas usam RPC com token).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

create type public.permission_scope as enum ('own', 'clients', 'sector', 'all');
create type public.override_effect as enum ('grant', 'deny');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Configurações internas (URL do site, token dos jobs). Sem grant para usuários.
create table private.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create or replace function private.setting(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.app_settings where key = p_key;
$$;

-- -----------------------------------------------------------------------------
-- Organização (única: Agência Extend)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  settings    jsonb not null default jsonb_build_object('timezone', 'America/Sao_Paulo', 'currency', 'BRL'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

insert into public.organizations (name) values ('Agência Extend');

-- -----------------------------------------------------------------------------
-- Setores
-- -----------------------------------------------------------------------------
create table public.sectors (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  key              text not null check (key ~ '^[a-z_]{2,40}$'),
  name             text not null check (char_length(name) between 2 and 60),
  area             text not null check (area in ('gestao', 'trafego', 'criacao')),
  color            text not null default '#1D8AE6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position         int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, name)
);

create trigger sectors_updated_at before update on public.sectors
  for each row execute function private.set_updated_at();

insert into public.sectors (organization_id, key, name, area, color, position)
select o.id, s.key, s.name, s.area, s.color, s.position
from public.organizations o
cross join (values
  ('administrativo', 'Administrativo', 'gestao', '#64748B', 1),
  ('comercial', 'Comercial', 'gestao', '#F7931E', 2),
  ('trafego', 'Tráfego', 'trafego', '#1D8AE6', 3),
  ('conteudo', 'Conteúdo', 'criacao', '#8B5CF6', 4),
  ('gerenciamento', 'Gerenciamento', 'criacao', '#EC4899', 5),
  ('edicao', 'Edição de vídeo', 'criacao', '#EF4444', 6),
  ('design', 'Design', 'criacao', '#14B8A6', 7),
  ('gravacao', 'Gravação', 'criacao', '#F59E0B', 8),
  ('sites', 'Sites', 'criacao', '#0EA5E9', 9)
) as s(key, name, area, color, position);

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  full_name        text not null default '' check (char_length(full_name) <= 120),
  email            text not null,
  phone_e164       text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_path      text,
  job_title        text check (char_length(job_title) <= 80),
  is_active        boolean not null default true,
  deactivated_at   timestamptz,
  preferences      jsonb not null default '{}'::jsonb,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index profiles_org_idx on public.profiles (organization_id);
create index profiles_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.profile_sectors (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  sector_id   uuid not null references public.sectors (id) on delete cascade,
  is_lead     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (profile_id, sector_id)
);

create index profile_sectors_sector_idx on public.profile_sectors (sector_id);

-- -----------------------------------------------------------------------------
-- Catálogo de permissões, papéis e vínculos
-- -----------------------------------------------------------------------------
create table public.permissions (
  key          text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module       text not null,
  label        text not null,
  description  text not null default '',
  scoped       boolean not null default true,
  position     int  not null default 0
);

create table public.roles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  key              text not null check (key ~ '^[a-z_]{2,40}$'),
  name             text not null check (char_length(name) between 2 and 60),
  description      text not null default '' check (char_length(description) <= 300),
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, name)
);

create trigger roles_updated_at before update on public.roles
  for each row execute function private.set_updated_at();

create table public.role_permissions (
  role_id         uuid not null references public.roles (id) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  scope           public.permission_scope not null default 'all',
  primary key (role_id, permission_key)
);

create index role_permissions_key_idx on public.role_permissions (permission_key);

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (user_id, role_id)
);

create index user_roles_role_idx on public.user_roles (role_id);

create table public.user_permission_overrides (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  effect          public.override_effect not null,
  scope           public.permission_scope not null default 'all',
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (user_id, permission_key)
);

create index user_permission_overrides_key_idx on public.user_permission_overrides (permission_key);

-- -----------------------------------------------------------------------------
-- Funções de autorização (usar como "(select private.fn(...))" nas políticas)
-- -----------------------------------------------------------------------------
create or replace function private.org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

-- Escopo efetivo de qualquer usuário: maior escopo entre papéis e exceções
-- "grant"; uma exceção "deny" anula tudo; usuário inativo não tem permissão.
create or replace function private.user_perm_scope(p_user uuid, p_key text)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id from public.profiles p where p.id = p_user and p.is_active
  ),
  ovr as (
    select o.effect, o.scope
    from public.user_permission_overrides o
    where o.user_id = (select id from me) and o.permission_key = p_key
  ),
  candidates as (
    select rp.scope
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select id from me) and rp.permission_key = p_key
    union all
    select scope from ovr where effect = 'grant'
  )
  select case
    when not exists (select 1 from me) then null
    when exists (select 1 from ovr where effect = 'deny') then null
    else (select max(scope) from candidates)
  end;
$$;

create or replace function private.perm_scope(p_key text)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_perm_scope(auth.uid(), p_key);
$$;

create or replace function private.has_perm(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.perm_scope(p_key) is not null;
$$;

-- O usuário atual pertence ao setor?
create or replace function private.in_my_sector(p_sector uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profile_sectors ps where ps.profile_id = auth.uid() and ps.sector_id = p_sector);
$$;

create or replace function private.is_org_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.key = 'admin'
    join public.profiles p on p.id = ur.user_id and p.is_active and p.organization_id = r.organization_id
    where ur.user_id = p_user
  );
$$;

-- O usuário atual pode repassar esta permissão neste escopo?
create or replace function private.can_delegate(p_key text, p_scope public.permission_scope)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_admin(auth.uid()) or coalesce(private.perm_scope(p_key) >= p_scope, false);
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.org_id(), private.user_perm_scope(uuid, text), private.perm_scope(text),
  private.has_perm(text), private.in_my_sector(uuid), private.is_org_admin(uuid),
  private.can_delegate(text, public.permission_scope), private.setting(text) to authenticated, service_role;

-- Permissões efetivas do usuário atual (a interface decide o que mostrar; a RLS garante).
create or replace function public.my_permissions()
returns table (permission_key text, scope public.permission_scope)
language sql
stable
security definer
set search_path = ''
as $$
  select k.key, private.perm_scope(k.key)
  from public.permissions k
  where private.perm_scope(k.key) is not null;
$$;

grant execute on function public.my_permissions() to authenticated;

-- "Ver como": permissões efetivas de outro usuário, só para quem gerencia usuários.
create or replace function public.user_effective_permissions(p_user uuid)
returns table (permission_key text, scope public.permission_scope)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para ver o acesso de outros usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and organization_id = private.org_id()) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  return query
    select k.key, private.user_perm_scope(p_user, k.key)
    from public.permissions k
    where private.user_perm_scope(p_user, k.key) is not null;
end;
$$;

grant execute on function public.user_effective_permissions(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Auditoria (somente inserção)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations (id) on delete cascade,
  actor_id         uuid references auth.users (id) on delete set null,
  action           text not null,
  entity_type      text not null,
  entity_id        text,
  changes          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function private.log_event(
  p_action text, p_entity_type text, p_entity_id text, p_changes jsonb default '{}'::jsonb, p_org uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, changes)
  values (coalesce(p_org, private.org_id(), (select id from public.organizations order by created_at limit 1)),
          auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_changes, '{}'::jsonb));
$$;

-- Trigger genérico. TG_ARGV[0] = colunas sensíveis (só registra que mudou);
-- TG_ARGV[1] = colunas auditadas no UPDATE (vazio = todas).
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_redact text[] := case when tg_nargs > 0 and tg_argv[0] <> '' then string_to_array(tg_argv[0], ',') else '{}' end;
  v_only text[] := case when tg_nargs > 1 and tg_argv[1] <> '' then string_to_array(tg_argv[1], ',') else null end;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_action text := lower(tg_op);
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key in ('updated_at', 'position', 'last_seen_at');
      continue when v_only is not null and not (v_key = any (v_only));
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key,
          case when v_key = any (v_redact) then jsonb_build_object('alterado', true)
               else jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key) end);
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
    if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_action := 'soft_delete';
    elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_action := 'restore';
    end if;
  else
    v_changes := v_row;
    foreach v_key in array v_redact loop
      v_changes := v_changes - v_key;
    end loop;
  end if;

  v_org := coalesce(
    (v_row ->> 'organization_id')::uuid,
    (select p.organization_id from public.profiles p where p.id = coalesce((v_row ->> 'user_id')::uuid, (v_row ->> 'profile_id')::uuid)),
    (select r.organization_id from public.roles r where r.id = (v_row ->> 'role_id')::uuid),
    private.org_id()
  );

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, changes)
  values (v_org, auth.uid(), v_action, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'profile_id'), v_changes);
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- Catálogo de permissões (inclui o que será usado nas próximas etapas)
-- scoped = false → liga/desliga (escopo é sempre "all")
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, label, scoped, position) values
  ('clients.read',                 'Clientes',      'Ver clientes', true, 10),
  ('clients.manage',               'Clientes',      'Cadastrar e editar clientes', true, 11),
  ('clients.onboarding.read',      'Clientes',      'Ver a ficha completa de onboarding', true, 12),
  ('clients.onboarding.manage',    'Clientes',      'Preencher e concluir o onboarding', true, 13),
  ('clients.import',               'Clientes',      'Importar planilha de clientes', false, 14),
  ('commercial.handoff.create',    'Comercial',     'Registrar fechamento comercial', false, 20),
  ('crm.leads.read',               'Comercial',     'Ver leads e negócios', true, 21),
  ('crm.leads.manage',             'Comercial',     'Cadastrar e mover leads e negócios', true, 22),
  ('crm.pipeline.configure',       'Comercial',     'Configurar funis e etapas', false, 23),
  ('prospector.use',               'Comercial',     'Usar o prospectador', false, 24),
  ('proposals.read',               'Comercial',     'Ver propostas', true, 25),
  ('proposals.manage',             'Comercial',     'Criar e enviar propostas', true, 26),
  ('proposals.templates.manage',   'Comercial',     'Editar modelos de proposta', false, 27),
  ('tasks.read',                   'Produção',      'Ver tarefas', true, 30),
  ('tasks.manage',                 'Produção',      'Criar, editar e mover tarefas', true, 31),
  ('tasks.assign',                 'Produção',      'Definir responsáveis', true, 32),
  ('tasks.boards.configure',       'Produção',      'Configurar quadros, colunas e fluxos', false, 33),
  ('sector.dashboard.read',        'Produção',      'Ver a visão do setor', true, 34),
  ('calendar.read',                'Produção',      'Ver agenda', true, 35),
  ('calendar.manage',              'Produção',      'Criar e editar eventos', true, 36),
  ('creatives.request.create',     'Criativos',     'Solicitar criativos', true, 40),
  ('creatives.produce',            'Criativos',     'Produzir e entregar criativos', true, 41),
  ('creatives.review',             'Criativos',     'Aprovar criativos internamente', true, 42),
  ('creatives.performance.read',   'Criativos',     'Ver performance dos criativos', true, 43),
  ('creatives.library.manage',     'Criativos',     'Organizar a biblioteca de criativos', true, 44),
  ('ads.read',                     'Tráfego',       'Ver anúncios e métricas', true, 50),
  ('ads.connect',                  'Tráfego',       'Conectar contas Meta e Google', false, 51),
  ('ads.access.manage',            'Tráfego',       'Liberar contas para outros gestores', false, 52),
  ('ads.manage',                   'Tráfego',       'Pausar, ativar e alterar campanhas', true, 53),
  ('campaigns.plan',               'Tráfego',       'Planejar campanhas e nomenclatura', true, 54),
  ('reports.manage',               'Tráfego',       'Configurar relatórios automáticos', true, 55),
  ('alerts.read',                  'Tráfego',       'Ver alertas de anúncios', true, 56),
  ('optimization.manage',          'Tráfego',       'Checklists e registro de alterações', true, 57),
  ('content.read',                 'Conteúdo',      'Ver cronograma de conteúdo', true, 60),
  ('content.publish',              'Conteúdo',      'Programar e publicar nas redes', true, 61),
  ('inbox.read',                   'Atendimento',   'Ver conversas do WhatsApp', true, 70),
  ('inbox.reply',                  'Atendimento',   'Responder conversas', true, 71),
  ('inbox.manage',                 'Atendimento',   'Conectar números e configurar o atendimento', false, 72),
  ('dashboards.read',              'Análise',       'Ver dashboards gerais', false, 80),
  ('users.manage',                 'Administração', 'Convidar e gerenciar usuários', false, 90),
  ('roles.manage',                 'Administração', 'Gerenciar papéis e permissões', false, 91),
  ('settings.manage',              'Administração', 'Alterar configurações gerais e setores', false, 92),
  ('integrations.manage',          'Administração', 'Gerenciar integrações', false, 93),
  ('tags.manage',                  'Administração', 'Gerenciar etiquetas', false, 94),
  ('audit.read',                   'Administração', 'Ver auditoria', false, 95);

-- Papéis iniciais (docs/03-permissoes.md). o=own c=clients s=sector a=all
create or replace function private.seed_roles(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid;
  v_def record;
begin
  for v_def in
    select * from (values
      ('admin', 'Administrador', 'Acesso total: usuários, papéis, integrações e auditoria.'),
      ('gerente_trafego', 'Gerente de tráfego', 'Todos os clientes com tráfego; anúncios, relatórios, alertas e planejamento; libera contas para outros gestores.'),
      ('gestor_trafego', 'Gestor de tráfego', 'Igual ao gerente, mas só nos clientes em que está marcado.'),
      ('coord_conteudo', 'Coordenação de conteúdo', 'Onboarding completo, todos os clientes e quadros de criação; distribui demandas.'),
      ('social_media', 'Social media', 'Clientes com gerenciamento; cronograma, publicação e aprovações.'),
      ('editor_video', 'Editor de vídeo', 'Só as tarefas atribuídas e os dados operacionais do cliente.'),
      ('designer', 'Designer', 'Só as tarefas atribuídas e os dados operacionais do cliente.'),
      ('gravacao', 'Gravação', 'Agenda de gravação e tarefas atribuídas.'),
      ('sites', 'Sites', 'Tarefas de site e clientes com site.'),
      ('comercial', 'Comercial', 'Funil, leads, prospecção, propostas e fechamento.'),
      ('atendimento', 'Atendimento', 'Conversas do WhatsApp e leads atribuídos.'),
      ('leitura', 'Somente leitura', 'Vê clientes, tarefas e agenda sem alterar nada.')
    ) as t(key, name, description)
  loop
    insert into public.roles (organization_id, key, name, description, is_system)
    values (p_org, v_def.key, v_def.name, v_def.description, true)
    on conflict (organization_id, key) do update set description = excluded.description
    returning id into v_role;

    insert into public.role_permissions (role_id, permission_key, scope)
    select v_role, p.key, case when p.scoped then x.scope::public.permission_scope else 'all' end
    from public.permissions p
    join (values
      ('admin', '%', 'all'),
      -- Gerente de tráfego (Luiz)
      ('gerente_trafego', 'clients.read', 'sector'),
      ('gerente_trafego', 'clients.onboarding.read', 'sector'),
      ('gerente_trafego', 'clients.onboarding.manage', 'sector'),
      ('gerente_trafego', 'tasks.read', 'clients'),
      ('gerente_trafego', 'tasks.manage', 'clients'),
      ('gerente_trafego', 'tasks.assign', 'clients'),
      ('gerente_trafego', 'sector.dashboard.read', 'sector'),
      ('gerente_trafego', 'calendar.read', 'sector'),
      ('gerente_trafego', 'calendar.manage', 'own'),
      ('gerente_trafego', 'creatives.request.create', 'sector'),
      ('gerente_trafego', 'creatives.review', 'sector'),
      ('gerente_trafego', 'creatives.performance.read', 'all'),
      ('gerente_trafego', 'creatives.library.manage', 'sector'),
      ('gerente_trafego', 'ads.%', 'all'),
      ('gerente_trafego', 'campaigns.plan', 'all'),
      ('gerente_trafego', 'reports.manage', 'all'),
      ('gerente_trafego', 'alerts.read', 'all'),
      ('gerente_trafego', 'optimization.manage', 'all'),
      -- Gestor de tráfego
      ('gestor_trafego', 'clients.read', 'clients'),
      ('gestor_trafego', 'clients.onboarding.read', 'clients'),
      ('gestor_trafego', 'tasks.read', 'clients'),
      ('gestor_trafego', 'tasks.manage', 'clients'),
      ('gestor_trafego', 'tasks.assign', 'clients'),
      ('gestor_trafego', 'calendar.read', 'own'),
      ('gestor_trafego', 'calendar.manage', 'own'),
      ('gestor_trafego', 'creatives.request.create', 'clients'),
      ('gestor_trafego', 'creatives.review', 'clients'),
      ('gestor_trafego', 'creatives.performance.read', 'clients'),
      ('gestor_trafego', 'ads.read', 'clients'),
      ('gestor_trafego', 'ads.manage', 'clients'),
      ('gestor_trafego', 'campaigns.plan', 'clients'),
      ('gestor_trafego', 'reports.manage', 'clients'),
      ('gestor_trafego', 'alerts.read', 'clients'),
      ('gestor_trafego', 'optimization.manage', 'clients'),
      -- Coordenação de conteúdo (Jacque, Joana)
      ('coord_conteudo', 'clients.read', 'all'),
      ('coord_conteudo', 'clients.manage', 'all'),
      ('coord_conteudo', 'clients.onboarding.read', 'all'),
      ('coord_conteudo', 'clients.onboarding.manage', 'all'),
      ('coord_conteudo', 'tasks.%', 'all'),
      ('coord_conteudo', 'sector.dashboard.read', 'sector'),
      ('coord_conteudo', 'calendar.read', 'sector'),
      ('coord_conteudo', 'calendar.manage', 'sector'),
      ('coord_conteudo', 'creatives.%', 'all'),
      ('coord_conteudo', 'ads.read', 'clients'),
      ('coord_conteudo', 'content.%', 'all'),
      -- Social media (Madu)
      ('social_media', 'clients.read', 'clients'),
      ('social_media', 'tasks.read', 'clients'),
      ('social_media', 'tasks.manage', 'clients'),
      ('social_media', 'tasks.assign', 'clients'),
      ('social_media', 'sector.dashboard.read', 'sector'),
      ('social_media', 'calendar.read', 'own'),
      ('social_media', 'calendar.manage', 'own'),
      ('social_media', 'creatives.produce', 'clients'),
      ('social_media', 'creatives.performance.read', 'clients'),
      ('social_media', 'content.%', 'clients'),
      -- Editor de vídeo, designer, gravação, sites
      ('editor_video', 'clients.read', 'clients'),
      ('editor_video', 'tasks.read', 'own'),
      ('editor_video', 'tasks.manage', 'own'),
      ('editor_video', 'calendar.read', 'own'),
      ('editor_video', 'calendar.manage', 'own'),
      ('editor_video', 'creatives.produce', 'own'),
      ('editor_video', 'creatives.performance.read', 'own'),
      ('designer', 'clients.read', 'clients'),
      ('designer', 'tasks.read', 'own'),
      ('designer', 'tasks.manage', 'own'),
      ('designer', 'calendar.read', 'own'),
      ('designer', 'calendar.manage', 'own'),
      ('designer', 'creatives.produce', 'own'),
      ('designer', 'creatives.performance.read', 'own'),
      ('gravacao', 'clients.read', 'clients'),
      ('gravacao', 'tasks.read', 'own'),
      ('gravacao', 'tasks.manage', 'own'),
      ('gravacao', 'calendar.read', 'sector'),
      ('gravacao', 'calendar.manage', 'sector'),
      ('gravacao', 'creatives.produce', 'own'),
      ('sites', 'clients.read', 'clients'),
      ('sites', 'tasks.read', 'own'),
      ('sites', 'tasks.manage', 'own'),
      ('sites', 'calendar.read', 'own'),
      ('sites', 'calendar.manage', 'own'),
      -- Comercial
      ('comercial', 'clients.read', 'all'),
      ('comercial', 'clients.onboarding.read', 'all'),
      ('comercial', 'commercial.handoff.create', 'all'),
      ('comercial', 'crm.%', 'all'),
      ('comercial', 'prospector.use', 'all'),
      ('comercial', 'proposals.%', 'all'),
      ('comercial', 'inbox.%', 'all'),
      ('comercial', 'calendar.read', 'own'),
      ('comercial', 'calendar.manage', 'own'),
      -- Atendimento
      ('atendimento', 'inbox.read', 'all'),
      ('atendimento', 'inbox.reply', 'all'),
      ('atendimento', 'crm.leads.read', 'own'),
      ('atendimento', 'crm.leads.manage', 'own'),
      ('atendimento', 'calendar.read', 'own'),
      ('atendimento', 'calendar.manage', 'own'),
      -- Somente leitura
      ('leitura', 'clients.read', 'all'),
      ('leitura', 'tasks.read', 'all'),
      ('leitura', 'calendar.read', 'all'),
      ('leitura', 'creatives.performance.read', 'all'),
      ('leitura', 'dashboards.read', 'all')
    ) as x(role_key, pattern, scope) on x.role_key = v_def.key and p.key like x.pattern
    on conflict (role_id, permission_key) do nothing;
  end loop;
end;
$$;

select private.seed_roles(id) from public.organizations;

-- -----------------------------------------------------------------------------
-- Convites (token só como hash SHA-256, uso único, 7 dias)
-- -----------------------------------------------------------------------------
create type public.invitation_status as enum ('pendente', 'aceito', 'cancelado');

create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name        text not null default '' check (char_length(full_name) <= 120),
  role_id          uuid not null references public.roles (id) on delete restrict,
  sector_ids       uuid[] not null default '{}',
  -- Clientes iniciais (aplicados quando o módulo de clientes existir — etapa 02).
  client_ids       uuid[] not null default '{}',
  token_hash       text not null unique,
  status           public.invitation_status not null default 'pendente',
  expires_at       timestamptz not null default now() + interval '7 days',
  invited_by       uuid references public.profiles (id) on delete set null,
  user_id          uuid references auth.users (id) on delete set null,
  send_count       int not null default 1,
  last_sent_at     timestamptz not null default now(),
  accepted_at      timestamptz,
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create unique index invitations_pending_uq on public.invitations (organization_id, email) where status = 'pendente';
create index invitations_org_idx on public.invitations (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Novo usuário → perfil + papel
-- Cadastro público desligado: contas nascem pelo servidor (convite) ou pelo
-- script de bootstrap. O primeiro usuário vira Administrador e já nasce ativo;
-- quem vem de convite nasce INATIVO até aceitar.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (select id from public.organizations order by created_at limit 1);
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first boolean;
  v_role uuid;
begin
  v_first := not exists (select 1 from public.profiles where organization_id = v_org);

  insert into public.profiles (id, organization_id, full_name, email, is_active)
  values (new.id, v_org, coalesce(v_meta ->> 'full_name', ''), coalesce(new.email, ''),
          v_first or not (v_meta ? 'invitation_id'));

  if v_first then
    select id into v_role from public.roles where organization_id = v_org and key = 'admin';
  else
    select id into v_role from public.roles
     where organization_id = v_org and id = nullif(v_meta ->> 'role_id', '')::uuid;
    if v_role is null then
      select id into v_role from public.roles where organization_id = v_org and key = 'leitura';
    end if;
  end if;

  insert into public.user_roles (user_id, role_id, created_by) values (new.id, v_role, null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.sync_user_email();

-- Aceite do convite (chamado pelo servidor após validar o token e definir a senha).
create or replace function public.finalize_invitation(p_invitation uuid, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation for update;
  if v_inv.id is null or v_inv.status <> 'pendente' or v_inv.expires_at < now() or v_inv.user_id is null then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001', hint = 'invalid_invitation';
  end if;

  update public.profiles
     set is_active = true, deactivated_at = null,
         full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
   where id = v_inv.user_id;

  delete from public.user_roles where user_id = v_inv.user_id and role_id <> v_inv.role_id;
  insert into public.user_roles (user_id, role_id) values (v_inv.user_id, v_inv.role_id) on conflict do nothing;

  insert into public.profile_sectors (profile_id, sector_id)
  select v_inv.user_id, s.id from public.sectors s
   where s.id = any (v_inv.sector_ids) and s.organization_id = v_inv.organization_id
  on conflict do nothing;

  update public.invitations set status = 'aceito', accepted_at = now() where id = v_inv.id;
  perform private.log_event('invitation_accepted', 'invitations', v_inv.id::text,
    jsonb_build_object('email', v_inv.email), v_inv.organization_id);
  return v_inv.user_id;
end;
$$;

revoke execute on function public.finalize_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_invitation(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Salvaguardas de acesso
-- -----------------------------------------------------------------------------
-- Sempre ao menos um administrador ativo.
create or replace function private.ensure_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_table_name = 'user_roles' then
    select organization_id into v_org from public.roles where id = old.role_id;
  else
    v_org := old.organization_id;
  end if;
  if v_org is not null
     and exists (select 1 from public.profiles where organization_id = v_org)
     and not exists (
       select 1 from public.user_roles ur
       join public.roles r on r.id = ur.role_id and r.key = 'admin'
       join public.profiles p on p.id = ur.user_id and p.is_active
       where r.organization_id = v_org) then
    raise exception 'É necessário manter ao menos um administrador ativo.' using errcode = 'P0001', hint = 'last_admin';
  end if;
  return null;
end;
$$;

create constraint trigger user_roles_keep_admin after delete or update on public.user_roles
  deferrable initially deferred for each row execute function private.ensure_admin_remains();
create constraint trigger profiles_keep_admin after update of is_active on public.profiles
  deferrable initially deferred for each row execute function private.ensure_admin_remains();

-- Papel Administrador é fixo; papéis do sistema não são excluídos nem renomeados por chave.
create or replace function private.protect_system_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'role_permissions' then
    if auth.uid() is not null
       and exists (select 1 from public.roles where id = coalesce(new.role_id, old.role_id) and key = 'admin') then
      raise exception 'As permissões do papel Administrador não podem ser alteradas.' using errcode = 'P0001', hint = 'admin_role_locked';
    end if;
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'Papéis padrão do sistema não podem ser excluídos.' using errcode = 'P0001', hint = 'system_role';
  end if;
  if tg_op = 'UPDATE' and old.is_system and new.key <> old.key then
    raise exception 'O identificador de um papel padrão não pode mudar.' using errcode = 'P0001', hint = 'system_role';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger roles_protect before update or delete on public.roles
  for each row execute function private.protect_system_roles();
create trigger role_permissions_protect before insert or update or delete on public.role_permissions
  for each row execute function private.protect_system_roles();

-- Trava contra autoelevação (RF-PER-09). Para quem não é Administrador:
--   * não altera o próprio acesso; não mexe em administradores;
--   * não atribui o papel Administrador; só concede o que tem, no mesmo escopo ou menor.
create or replace function private.guard_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_missing text;
begin
  if v_actor is null or private.is_org_admin(v_actor) then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'role_permissions' then
    if exists (select 1 from public.user_roles where user_id = v_actor and role_id = coalesce(new.role_id, old.role_id)) then
      raise exception 'Você não pode alterar as permissões do seu próprio papel.' using errcode = '42501', hint = 'self_access';
    end if;
    if tg_op <> 'DELETE' and not private.can_delegate(new.permission_key, new.scope) then
      raise exception 'Você só pode conceder permissões que você mesmo tem, no mesmo escopo.' using errcode = '42501', hint = 'delegate_beyond_own';
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'profile_sectors' then
    v_target := coalesce(new.profile_id, old.profile_id);
  else
    v_target := coalesce(new.user_id, old.user_id);
  end if;

  if v_target = v_actor then
    raise exception 'Você não pode alterar o seu próprio acesso. Peça a um administrador.' using errcode = '42501', hint = 'self_access';
  end if;
  if private.is_org_admin(v_target) then
    raise exception 'Somente um administrador altera o acesso de outro administrador.' using errcode = '42501', hint = 'admin_target';
  end if;

  if tg_table_name = 'user_roles' and tg_op <> 'DELETE' then
    if exists (select 1 from public.roles where id = new.role_id and key = 'admin') then
      raise exception 'Somente um administrador atribui o papel Administrador.' using errcode = '42501', hint = 'admin_role';
    end if;
    select rp.permission_key into v_missing
      from public.role_permissions rp
     where rp.role_id = new.role_id and not private.can_delegate(rp.permission_key, rp.scope)
     limit 1;
    if v_missing is not null then
      raise exception 'Este papel tem permissões que você não tem (%). Peça a um administrador.', v_missing
        using errcode = '42501', hint = 'delegate_beyond_own';
    end if;
  end if;

  if tg_table_name = 'user_permission_overrides' and tg_op <> 'DELETE' then
    if new.effect = 'grant' and not private.can_delegate(new.permission_key, new.scope) then
      raise exception 'Você só pode conceder permissões que você mesmo tem, no mesmo escopo.' using errcode = '42501', hint = 'delegate_beyond_own';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function private.guard_access_change();
create trigger user_permission_overrides_guard before insert or update or delete on public.user_permission_overrides
  for each row execute function private.guard_access_change();
create trigger role_permissions_guard before insert or update or delete on public.role_permissions
  for each row execute function private.guard_access_change();
create trigger profile_sectors_guard before insert or update or delete on public.profile_sectors
  for each row execute function private.guard_access_change();

-- -----------------------------------------------------------------------------
-- Auditoria das tabelas de acesso
-- -----------------------------------------------------------------------------
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function private.audit_row();
create trigger audit_user_permission_overrides after insert or update or delete on public.user_permission_overrides
  for each row execute function private.audit_row();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row();
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function private.audit_row();
create trigger audit_profile_sectors after insert or delete on public.profile_sectors
  for each row execute function private.audit_row();
create trigger audit_sectors after insert or update or delete on public.sectors
  for each row execute function private.audit_row();
create trigger audit_profiles after update on public.profiles
  for each row execute function private.audit_row('phone_e164', 'is_active,full_name,email,job_title,phone_e164');
create trigger audit_organizations after update on public.organizations
  for each row execute function private.audit_row();
create trigger audit_invitations after insert or update on public.invitations
  for each row execute function private.audit_row('token_hash', 'status,role_id,expires_at,send_count');

-- -----------------------------------------------------------------------------
-- RPCs administrativas
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para gerenciar usuários.' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not p_active then
    raise exception 'Você não pode desativar a própria conta.' using errcode = 'P0001', hint = 'self_deactivate';
  end if;
  if private.is_org_admin(p_user) and not private.is_org_admin(auth.uid()) then
    raise exception 'Somente um administrador desativa outro administrador.' using errcode = '42501', hint = 'admin_target';
  end if;
  update public.profiles
     set is_active = p_active, deactivated_at = case when p_active then null else now() end
   where id = p_user and organization_id = private.org_id();
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

-- Troca de papel numa transação (a trava do último admin é adiada para o commit).
create or replace function public.admin_set_user_role(p_user uuid, p_role uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para gerenciar usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id = p_role and organization_id = private.org_id()) then
    raise exception 'Papel não encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and organization_id = private.org_id()) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  -- As triggers de user_roles rodam como o usuário atual (auth.uid()) e aplicam a trava.
  delete from public.user_roles where user_id = p_user and role_id <> p_role;
  insert into public.user_roles (user_id, role_id) values (p_user, p_role) on conflict do nothing;
end;
$$;

grant execute on function public.admin_set_user_role(uuid, uuid) to authenticated;

-- Duplicar papel com todas as permissões.
create or replace function public.duplicate_role(p_role uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.roles;
  v_new uuid;
  v_key text;
begin
  if not private.has_perm('roles.manage') then
    raise exception 'Você não tem permissão para gerenciar papéis.' using errcode = '42501';
  end if;
  select * into v_src from public.roles where id = p_role and organization_id = private.org_id();
  if v_src.id is null then
    raise exception 'Papel não encontrado.' using errcode = 'P0002';
  end if;
  v_key := 'papel_' || translate(substr(md5(random()::text || clock_timestamp()::text), 1, 12), '0123456789', 'ghijklmnop');
  insert into public.roles (organization_id, key, name, description, is_system)
  values (v_src.organization_id, v_key, trim(p_name), v_src.description, false)
  returning id into v_new;
  insert into public.role_permissions (role_id, permission_key, scope)
  select v_new, permission_key, scope from public.role_permissions where role_id = p_role;
  return v_new;
end;
$$;

grant execute on function public.duplicate_role(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Rate limit (janela fixa persistida; chamado só pelo servidor)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  bucket        text primary key,
  window_start  timestamptz not null,
  hits          int not null
);

create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into private.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

create or replace function public.rate_limit_reset(p_bucket text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rate_limits where bucket = p_bucket;
$$;

revoke execute on function public.rate_limit_hit(text, int, int), public.rate_limit_reset(text) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int), public.rate_limit_reset(text) to service_role;

-- -----------------------------------------------------------------------------
-- Privilégios de coluna
-- -----------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, phone_e164, avatar_path, job_title, preferences, last_seen_at) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.permissions from authenticated;
revoke insert, delete, update on public.organizations from authenticated;
grant update (name, settings) on public.organizations to authenticated;
revoke insert, update, delete on public.invitations from authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.sectors enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_sectors enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table private.app_settings enable row level security;
alter table private.rate_limits enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (id = (select private.org_id()));
create policy organizations_update on public.organizations for update to authenticated
  using (id = (select private.org_id()) and (select private.has_perm('settings.manage')))
  with check (id = (select private.org_id()));

create policy sectors_select on public.sectors for select to authenticated
  using (organization_id = (select private.org_id()));
create policy sectors_write on public.sectors for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')));

-- Colegas são visíveis (necessário para marcar responsáveis).
create policy profiles_select on public.profiles for select to authenticated
  using (organization_id = (select private.org_id()) or id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy profile_sectors_select on public.profile_sectors for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id())));
create policy profile_sectors_write on public.profile_sectors for all to authenticated
  using ((select private.has_perm('users.manage'))
         and exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id())))
  with check ((select private.has_perm('users.manage'))
         and exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id()))
         and exists (select 1 from public.sectors s where s.id = sector_id and s.organization_id = (select private.org_id())));

create policy permissions_select on public.permissions for select to authenticated
  using ((select private.org_id()) is not null);

create policy roles_select on public.roles for select to authenticated
  using (organization_id = (select private.org_id()));
create policy roles_insert on public.roles for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('roles.manage')) and not is_system);
create policy roles_update on public.roles for update to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('roles.manage')))
  with check (organization_id = (select private.org_id()));
create policy roles_delete on public.roles for delete to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('roles.manage')) and not is_system);

-- A matriz de papéis só é visível para quem gerencia papéis ou usuários.
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (((select private.has_perm('roles.manage')) or (select private.has_perm('users.manage')))
         and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select private.org_id())));
create policy role_permissions_write on public.role_permissions for all to authenticated
  using ((select private.has_perm('roles.manage'))
         and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select private.org_id())))
  with check ((select private.has_perm('roles.manage'))
         and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select private.org_id())));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid())
         or ((select private.has_perm('users.manage'))
             and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id()))));
create policy user_roles_write on public.user_roles for all to authenticated
  using ((select private.has_perm('users.manage'))
         and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id())))
  with check ((select private.has_perm('users.manage'))
         and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id()))
         and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select private.org_id())));

create policy overrides_select on public.user_permission_overrides for select to authenticated
  using (user_id = (select auth.uid())
         or ((select private.has_perm('users.manage'))
             and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id()))));
create policy overrides_write on public.user_permission_overrides for all to authenticated
  using ((select private.has_perm('roles.manage'))
         and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id())))
  with check ((select private.has_perm('roles.manage'))
         and exists (select 1 from public.profiles p where p.id = user_id and p.organization_id = (select private.org_id())));

create policy invitations_select on public.invitations for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('users.manage')));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('audit.read')));
