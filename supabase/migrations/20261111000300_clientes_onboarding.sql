-- =============================================================================
-- Etapa 02 · Clientes, fechamento comercial, onboarding e demandas do mês
-- =============================================================================
-- Visibilidade do cliente (RF-PER-05), pelo escopo da permissão:
--   all     → todos os clientes
--   sector  → clientes com serviço ativo de um setor meu, ou em que alguém do
--             meu setor está marcado
--   clients → clientes em que estou marcado (client_members)
--   own     → idem clients (cliente não tem "dono")
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de serviços
-- -----------------------------------------------------------------------------
create table public.service_catalog (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  key              text not null check (key ~ '^[a-z_]{2,40}$'),
  name             text not null check (char_length(name) between 2 and 80),
  sector_id        uuid references public.sectors (id) on delete set null,
  unit             text not null default 'nenhuma' check (unit in ('videos', 'artes', 'posts', 'gravacoes', 'nenhuma')),
  task_type        text check (task_type in ('video', 'design', 'conteudo', 'gravacao', 'site', 'criativo')),
  tabs             text[] not null default '{}',
  position         int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, name)
);

create trigger service_catalog_updated_at before update on public.service_catalog
  for each row execute function private.set_updated_at();

insert into public.service_catalog (organization_id, key, name, sector_id, unit, task_type, tabs, position)
select o.id, s.key, s.name, (select id from public.sectors x where x.organization_id = o.id and x.key = s.sector), s.unit, s.task_type, s.tabs, s.pos
from public.organizations o
cross join (values
  ('meta_ads', 'Facebook/Instagram Ads', 'trafego', 'nenhuma', null, array['anuncios'], 1),
  ('google_ads', 'Google Ads', 'trafego', 'nenhuma', null, array['anuncios'], 2),
  ('treinamento', 'Treinamento comercial', 'comercial', 'nenhuma', null, array[]::text[], 3),
  ('pacote_videos', 'Pacote de vídeos', 'edicao', 'videos', 'video', array['videos', 'gravacao'], 4),
  ('conteudo_mensal', 'Conteúdo mensal', 'design', 'artes', 'design', array['design', 'conteudo'], 5),
  ('gerenciamento', 'Gerenciamento de redes', 'gerenciamento', 'posts', 'conteudo', array['gerenciamento', 'conteudo'], 6),
  ('site', 'Site', 'sites', 'nenhuma', null, array['site'], 7)
) as s(key, name, sector, unit, task_type, tabs, pos);

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
create table public.client_imports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  file_name        text not null,
  row_count        int not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  undone_at        timestamptz,
  undone_by        uuid references public.profiles (id) on delete set null
);

create table public.clients (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  name                     text not null check (char_length(name) between 2 and 120),
  legal_name               text check (char_length(legal_name) <= 160),
  document                 text check (char_length(document) <= 20),
  segment                  text check (char_length(segment) <= 80),
  status                   text not null default 'onboarding' check (status in ('onboarding', 'ativo', 'pausado', 'encerrado')),
  contract_start           date,
  contract_end             date,
  renewal_date             date,
  media_budget_cents       bigint check (media_budget_cents >= 0),
  monthly_fee_cents        bigint check (monthly_fee_cents >= 0),
  payment_method           text check (char_length(payment_method) <= 80),
  communication_channel    text check (char_length(communication_channel) <= 300),
  notes                    text check (char_length(notes) <= 4000),
  onboarding_legacy        boolean not null default false,
  onboarding_completed_at  timestamptz,
  import_id                uuid references public.client_imports (id) on delete set null,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  check (contract_end is null or contract_start is null or contract_end >= contract_start)
);

create index clients_org_status_idx on public.clients (organization_id, status) where deleted_at is null;
create index clients_name_trgm_idx on public.clients using gin (name extensions.gin_trgm_ops);
create index clients_import_idx on public.clients (import_id) where import_id is not null;

create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create table public.client_services (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  service_id   uuid not null references public.service_catalog (id) on delete restrict,
  monthly_qty  int not null default 0 check (monthly_qty between 0 and 200),
  price_cents  bigint check (price_cents >= 0),
  starts_on    date not null default current_date,
  ends_on      date,
  created_at   timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index client_services_client_idx on public.client_services (client_id);
create index client_services_service_idx on public.client_services (service_id);

create table public.client_members (
  client_id   uuid not null references public.clients (id) on delete cascade,
  sector_id   uuid not null references public.sectors (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  is_default  boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (client_id, sector_id, profile_id)
);

create index client_members_profile_idx on public.client_members (profile_id);

create table public.client_accounts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null check (kind in ('bm', 'ad_account_meta', 'ad_account_google', 'page', 'instagram', 'pixel', 'whatsapp', 'site', 'drive_folder', 'tiktok', 'outro')),
  value       text not null check (char_length(value) between 1 and 300),
  label       text check (char_length(label) <= 80),
  created_at  timestamptz not null default now()
);

create index client_accounts_client_idx on public.client_accounts (client_id);

create table public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  role        text check (char_length(role) <= 80),
  phone       text check (char_length(phone) <= 30),
  email       text check (char_length(email) <= 200),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index client_contacts_client_idx on public.client_contacts (client_id);

-- -----------------------------------------------------------------------------
-- Fechamento comercial e promessas
-- -----------------------------------------------------------------------------
create table public.commercial_handoffs (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  sold_by            uuid references public.profiles (id) on delete set null,
  closed_on          date not null default current_date,
  monthly_fee_cents  bigint check (monthly_fee_cents >= 0),
  setup_fee_cents    bigint check (setup_fee_cents >= 0),
  payment_method     text check (char_length(payment_method) <= 80),
  contract_months    int check (contract_months between 1 and 120),
  notes              text check (char_length(notes) <= 4000),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index commercial_handoffs_client_idx on public.commercial_handoffs (client_id);

create table public.handoff_promises (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  handoff_id   uuid references public.commercial_handoffs (id) on delete cascade,
  description  text not null check (char_length(description) between 2 and 300),
  due_at       timestamptz not null,
  done_at      timestamptz,
  done_by      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index handoff_promises_open_idx on public.handoff_promises (due_at) where done_at is null;
create index handoff_promises_client_idx on public.handoff_promises (client_id);

-- -----------------------------------------------------------------------------
-- Onboarding: modelo da ficha (versionado), respostas e checklist
-- -----------------------------------------------------------------------------
create table public.onboarding_forms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  version          int not null,
  sections         jsonb not null check (jsonb_typeof(sections) = 'array'),
  is_current       boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, version)
);

create unique index onboarding_forms_current_uq on public.onboarding_forms (organization_id) where is_current;

-- visibility: "full" (só quem tem clients.onboarding.read) | "operational" (aparece no resumo para a equipe)
insert into public.onboarding_forms (organization_id, version, sections)
select o.id, 1, $json$[
  {"key":"negocio","title":"Negócio","questions":[
    {"key":"oferta","label":"Oferta principal","type":"textarea","required":true,"visibility":"operational"},
    {"key":"produtos","label":"Produtos e serviços","type":"textarea","required":true,"visibility":"operational"},
    {"key":"diferenciais","label":"Diferenciais","type":"textarea","required":true,"visibility":"operational"},
    {"key":"regiao","label":"Região de atuação","type":"text","required":true,"visibility":"operational"},
    {"key":"ticket","label":"Ticket médio","type":"text","required":false,"visibility":"full"}
  ]},
  {"key":"publico","title":"Público","questions":[
    {"key":"perfil","label":"Perfil do público","type":"textarea","required":true,"visibility":"operational"},
    {"key":"dores","label":"Dores e desejos","type":"textarea","required":true,"visibility":"operational"},
    {"key":"objecoes","label":"Objeções comuns","type":"textarea","required":true,"visibility":"operational"}
  ]},
  {"key":"objetivo","title":"Objetivo de campanha","questions":[
    {"key":"objetivo","label":"Objetivo principal","type":"select","options":["Leads (formulário)","Conversas no WhatsApp","Visitas ao perfil","Vendas no site","Reconhecimento de marca"],"required":true,"visibility":"operational"},
    {"key":"meta_resultados","label":"Meta de resultados (ex.: 100 leads/mês)","type":"text","required":false,"visibility":"full"}
  ]},
  {"key":"restricoes","title":"Restrições da Meta","questions":[
    {"key":"segmento_sensivel","label":"Segmento sensível","type":"select","options":["Nenhum","Estética","Saúde","Finanças","Imobiliário","Outro"],"required":true,"visibility":"operational"},
    {"key":"nao_pode","label":"O que não pode ser dito ou mostrado","type":"textarea","required":true,"visibility":"operational"}
  ]},
  {"key":"marca","title":"Identidade e tom","questions":[
    {"key":"identidade","label":"Identidade visual (cores, fontes, manual)","type":"textarea","required":true,"visibility":"operational"},
    {"key":"tom_voz","label":"Tom de voz","type":"textarea","required":true,"visibility":"operational"},
    {"key":"materiais","label":"Materiais autorizados (fotos, vídeos, depoimentos)","type":"textarea","required":true,"visibility":"operational"},
    {"key":"referencias","label":"Concorrentes e referências","type":"textarea","required":false,"visibility":"operational"}
  ]},
  {"key":"acessos","title":"Acessos","questions":[
    {"key":"acessos_necessarios","label":"Acessos necessários e situação (BM, conta, página, Instagram, Drive)","type":"textarea","required":true,"visibility":"full"},
    {"key":"observacoes","label":"Observações internas","type":"textarea","required":false,"visibility":"full"}
  ]}
]$json$::jsonb
from public.organizations o;

create table public.onboarding_checklist_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 160),
  default_sector_id uuid references public.sectors (id) on delete set null,
  due_days         int not null default 3 check (due_days between 0 and 90),
  position         int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

insert into public.onboarding_checklist_templates (organization_id, title, default_sector_id, due_days, position)
select o.id, t.title, (select id from public.sectors s where s.organization_id = o.id and s.key = t.sector), t.days, t.pos
from public.organizations o
cross join (values
  ('Repasse dos serviços vendidos e da data de início', 'comercial', 0, 1),
  ('Grupo de WhatsApp criado (cliente + equipe)', 'comercial', 0, 2),
  ('Reunião de briefing agendada', 'conteudo', 2, 3),
  ('Reunião de briefing realizada', 'conteudo', 5, 4),
  ('Ficha de onboarding preenchida', 'conteudo', 5, 5),
  ('Acessos recebidos (BM, conta, página, Instagram, Drive)', 'trafego', 7, 6),
  ('Reunião de planejamento realizada', 'conteudo', 10, 7),
  ('Planejamento de mídias aprovado', 'conteudo', 12, 8),
  ('Planejamento de tráfego aprovado', 'trafego', 12, 9),
  ('Gravação agendada', 'gravacao', 14, 10)
) as t(title, sector, days, pos);

create table public.client_onboarding (
  client_id     uuid primary key references public.clients (id) on delete cascade,
  form_id       uuid not null references public.onboarding_forms (id) on delete restrict,
  answers       jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null,
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null
);

create table public.onboarding_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 160),
  assignee_id  uuid references public.profiles (id) on delete set null,
  due_at       timestamptz,
  done_at      timestamptz,
  done_by      uuid references public.profiles (id) on delete set null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index onboarding_checklist_client_idx on public.onboarding_checklist_items (client_id, position);
create index onboarding_checklist_assignee_idx on public.onboarding_checklist_items (assignee_id) where done_at is null;

-- -----------------------------------------------------------------------------
-- Reuniões, ideias, arquivos e linha do tempo
-- -----------------------------------------------------------------------------
create table public.client_meetings (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  held_at          timestamptz not null,
  kind             text not null default 'alinhamento' check (kind in ('briefing', 'planejamento', 'alinhamento', 'resultados', 'outro')),
  title            text not null check (char_length(title) between 2 and 160),
  summary          text check (char_length(summary) <= 8000),
  link             text check (char_length(link) <= 500),
  participant_ids  uuid[] not null default '{}',
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index client_meetings_client_idx on public.client_meetings (client_id, held_at desc);

create trigger client_meetings_updated_at before update on public.client_meetings
  for each row execute function private.set_updated_at();

create table public.client_ideas (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  title              text not null check (char_length(title) between 2 and 160),
  body               text check (char_length(body) <= 4000),
  link               text check (char_length(link) <= 500),
  tags               text[] not null default '{}',
  converted_task_id  uuid,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index client_ideas_client_idx on public.client_ideas (client_id, created_at desc);

create table public.client_files (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  storage_path  text not null unique,
  name          text not null check (char_length(name) between 1 and 200),
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  category      text not null default 'geral' check (category in ('geral', 'fechamento', 'reuniao', 'identidade', 'contrato', 'referencia')),
  meeting_id    uuid references public.client_meetings (id) on delete set null,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index client_files_client_idx on public.client_files (client_id, created_at desc);

create table public.client_timeline (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null,
  title       text not null check (char_length(title) between 1 and 300),
  data        jsonb not null default '{}'::jsonb,
  actor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index client_timeline_client_idx on public.client_timeline (client_id, created_at desc);

create or replace function private.timeline(p_client uuid, p_kind text, p_title text, p_data jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.client_timeline (client_id, kind, title, data, actor_id)
  values (p_client, p_kind, left(p_title, 300), coalesce(p_data, '{}'::jsonb), auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Tarefas (mínimo para as demandas do mês; o Kanban completo vem na etapa 03)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  client_id        uuid references public.clients (id) on delete cascade,
  service_id       uuid references public.service_catalog (id) on delete set null,
  sector_id        uuid references public.sectors (id) on delete set null,
  type             text not null default 'geral' check (type in ('video', 'design', 'conteudo', 'gravacao', 'site', 'criativo', 'roteiro', 'post', 'geral')),
  title            text not null check (char_length(title) between 1 and 200),
  description      text check (char_length(description) <= 10000),
  status           text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'concluido', 'cancelado')),
  priority         text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  assignee_id      uuid references public.profiles (id) on delete set null,
  due_at           timestamptz,
  slot_month       date check (slot_month is null or extract(day from slot_month) = 1),
  slot_index       int check (slot_index between 1 and 200),
  slot_total       int check (slot_total between 1 and 200),
  completed_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index tasks_slot_uq on public.tasks (client_id, service_id, slot_month, slot_index) where slot_month is not null;
create index tasks_client_idx on public.tasks (client_id, slot_month) where deleted_at is null;
create index tasks_assignee_idx on public.tasks (assignee_id, due_at) where deleted_at is null and completed_at is null;
create index tasks_sector_idx on public.tasks (sector_id) where deleted_at is null;

create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funções de acesso ao cliente
-- -----------------------------------------------------------------------------
create or replace function private.is_client_member(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.client_members m where m.client_id = p_client and m.profile_id = auth.uid());
$$;

create or replace function private.client_in_my_sector(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_services cs
    join public.service_catalog sc on sc.id = cs.service_id
    join public.profile_sectors ps on ps.sector_id = sc.sector_id and ps.profile_id = auth.uid()
    where cs.client_id = p_client and (cs.ends_on is null or cs.ends_on >= current_date)
  ) or exists (
    select 1
    from public.client_members m
    join public.profile_sectors ps on ps.sector_id = m.sector_id and ps.profile_id = auth.uid()
    where m.client_id = p_client
  );
$$;

-- Pode agir sobre o cliente com esta permissão (aplica o escopo)?
create or replace function private.can_client(p_key text, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.perm_scope(p_key)
    when 'all' then exists (select 1 from public.clients c where c.id = p_client and c.organization_id = private.org_id())
    when 'sector' then private.client_in_my_sector(p_client) or private.is_client_member(p_client)
    when 'clients' then private.is_client_member(p_client)
    when 'own' then private.is_client_member(p_client)
    else false
  end;
$$;

-- Leitura de tarefa: all; setor (setor da tarefa ou cliente do setor); clientes marcados; ou atribuída a mim.
create or replace function private.can_task(p_key text, p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and t.organization_id = private.org_id()
      and (
        t.assignee_id = auth.uid()
        or case private.perm_scope(p_key)
          when 'all' then true
          when 'sector' then private.in_my_sector(t.sector_id) or (t.client_id is not null and private.can_client(p_key, t.client_id))
          when 'clients' then t.client_id is not null and private.is_client_member(t.client_id)
          when 'own' then t.assignee_id = auth.uid() or t.created_by = auth.uid()
          else false
        end
      )
  );
$$;

revoke execute on function private.is_client_member(uuid), private.client_in_my_sector(uuid),
  private.can_client(text, uuid), private.can_task(text, uuid), private.timeline(uuid, text, text, jsonb) from public, anon;
grant execute on function private.is_client_member(uuid), private.client_in_my_sector(uuid),
  private.can_client(text, uuid), private.can_task(text, uuid) to authenticated, service_role;

-- Pode gerenciar o cliente (dados, serviços, membros)? Gerenciar ou onboarding.
create or replace function private.can_manage_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_client('clients.manage', p_client) or private.can_client('clients.onboarding.manage', p_client);
$$;

grant execute on function private.can_manage_client(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Destinatários do aviso de cliente novo (configurável em organizations.settings)
-- -----------------------------------------------------------------------------
create or replace function private.onboarding_recipients(p_org uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(o.settings -> 'onboarding_recipient_ids') x
      where exists (select 1 from public.profiles p where p.id = x::uuid and p.is_active)),
    (select array_agg(distinct ur.user_id)
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id and r.key in ('coord_conteudo', 'gerente_trafego')
       join public.profiles p on p.id = ur.user_id and p.is_active
      where r.organization_id = p_org),
    '{}'
  )
  from public.organizations o where o.id = p_org;
$$;

-- -----------------------------------------------------------------------------
-- Geração das demandas do mês (slots) — idempotente
-- -----------------------------------------------------------------------------
create or replace function private.month_label(p_month date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[extract(month from p_month)::int]
         || '/' || extract(year from p_month)::int;
$$;

create or replace function private.generate_slots(p_client uuid, p_month date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_month date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_days int;
  v_svc record;
  v_count int := 0;
  v_n int;
  v_assignee uuid;
  v_label text;
  v_new uuid[] := '{}';
  v_id uuid;
begin
  select * into v_client from public.clients where id = p_client and deleted_at is null;
  if v_client.id is null or v_client.status <> 'ativo' then
    return 0;
  end if;
  if v_client.contract_start is not null and v_client.contract_start > v_last then return 0; end if;
  if v_client.contract_end is not null and v_client.contract_end < v_month then return 0; end if;

  v_days := extract(day from v_last)::int;

  for v_svc in
    select cs.id as cs_id, cs.monthly_qty, sc.id as service_id, sc.task_type, sc.sector_id, sc.unit, sc.name
    from public.client_services cs
    join public.service_catalog sc on sc.id = cs.service_id
    where cs.client_id = p_client
      and cs.monthly_qty > 0
      and sc.task_type is not null
      and cs.starts_on <= v_last
      and (cs.ends_on is null or cs.ends_on >= v_month)
  loop
    select m.profile_id into v_assignee
      from public.client_members m
      join public.profiles p on p.id = m.profile_id and p.is_active
     where m.client_id = p_client and m.sector_id = v_svc.sector_id
     order by m.is_default desc, m.created_at
     limit 1;

    v_label := case v_svc.task_type
      when 'video' then 'Vídeo' when 'design' then 'Arte' when 'conteudo' then 'Post'
      when 'gravacao' then 'Gravação' when 'site' then 'Site' else 'Criativo' end;

    for v_n in 1 .. v_svc.monthly_qty loop
      insert into public.tasks (organization_id, client_id, service_id, sector_id, type, title, status, assignee_id,
                                due_at, slot_month, slot_index, slot_total)
      values (v_client.organization_id, p_client, v_svc.service_id, v_svc.sector_id, v_svc.task_type,
              v_label || ' ' || v_n || '/' || v_svc.monthly_qty || ' – ' || private.month_label(v_month),
              'pendente', v_assignee,
              -- Prazos distribuídos pelo mês, às 18h de São Paulo.
              ((v_month + (ceil(v_n::numeric * v_days / v_svc.monthly_qty)::int - 1)) + time '18:00') at time zone 'America/Sao_Paulo',
              v_month, v_n, v_svc.monthly_qty)
      on conflict (client_id, service_id, slot_month, slot_index) where slot_month is not null do nothing
      returning id into v_id;
      if v_id is not null then
        v_count := v_count + 1;
        if v_assignee is not null then v_new := array_append(v_new, v_assignee); end if;
        v_id := null;
      end if;
    end loop;
  end loop;

  if v_count > 0 then
    perform private.timeline(p_client, 'slots', v_count || ' demanda(s) de ' || private.month_label(v_month) || ' criada(s)',
      jsonb_build_object('month', v_month, 'count', v_count));
    if array_length(v_new, 1) > 0 then
      perform public.notify_users(
        (select array_agg(distinct x) from unnest(v_new) x), 'assigned',
        'Novas demandas de ' || v_client.name,
        'As demandas de ' || private.month_label(v_month) || ' foram criadas e atribuídas a você.',
        '/clientes/' || p_client || '/demanda', 'slots:' || p_client || ':' || v_month, auth.uid());
    end if;
  end if;
  return v_count;
end;
$$;

revoke execute on function private.generate_slots(uuid, date) from public, anon, authenticated;

-- Job diário: no dia 1º gera o mês para todos os ativos. Idempotente.
create or replace function private.monthly_slots_tick(p_month date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := coalesce(p_month, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date);
  v_total int := 0;
  v_c record;
begin
  for v_c in select id from public.clients where status = 'ativo' and deleted_at is null loop
    v_total := v_total + private.generate_slots(v_c.id, v_month);
  end loop;
  return v_total;
end;
$$;

-- Promessas comerciais: avisa 24 h antes e quando atrasa (deduplicado).
create or replace function private.promises_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p record;
  v_count int := 0;
  v_to uuid[];
begin
  for v_p in
    select hp.*, c.name as client_name, c.organization_id, h.created_by as seller
    from public.handoff_promises hp
    join public.clients c on c.id = hp.client_id and c.deleted_at is null
    left join public.commercial_handoffs h on h.id = hp.handoff_id
    where hp.done_at is null and hp.due_at < now() + interval '24 hours'
  loop
    v_to := private.onboarding_recipients(v_p.organization_id)
            || coalesce((select array_agg(profile_id) from public.client_members where client_id = v_p.client_id), '{}')
            || case when v_p.seller is not null then array[v_p.seller] else '{}'::uuid[] end;
    v_count := v_count + public.notify_users(
      (select array_agg(distinct x) from unnest(v_to) x),
      case when v_p.due_at < now() then 'overdue' else 'due_soon' end,
      case when v_p.due_at < now() then 'Promessa atrasada: ' else 'Promessa vence em 24 h: ' end || v_p.client_name,
      v_p.description,
      '/clientes/' || v_p.client_id,
      'promessa:' || v_p.id || ':' || case when v_p.due_at < now() then 'atraso' else 'aviso' end,
      null);
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.monthly_slots_tick(date), private.promises_tick() from public, anon, authenticated;

-- 00:10 em São Paulo (03:10 UTC): slots no dia 1º; promessas a cada hora.
select cron.schedule('extend-slots-mensais', '10 3 * * *',
  $$select private.monthly_slots_tick() where extract(day from (now() at time zone 'America/Sao_Paulo')) = 1$$);
select cron.schedule('extend-promessas', '5 * * * *', $$select private.promises_tick()$$);

-- -----------------------------------------------------------------------------
-- RPC: fechamento comercial → cliente em onboarding (RF-FEC-01/02)
-- p jsonb: {name, legal_name, document, segment, contact:{name,phone,email,role},
--   services:[{service_id, monthly_qty, price_cents}], monthly_fee_cents, setup_fee_cents,
--   payment_method, contract_start, contract_months, media_budget_cents, notes,
--   communication_channel, promises:[{description, due_at}]}
-- -----------------------------------------------------------------------------
create or replace function public.create_handoff(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_client uuid;
  v_handoff uuid;
  v_start date := coalesce(nullif(p ->> 'contract_start', '')::date, current_date);
  v_months int := nullif(p ->> 'contract_months', '')::int;
  v_s jsonb;
  v_t record;
  v_assignee uuid;
  v_recipients uuid[];
begin
  if not private.has_perm('commercial.handoff.create') then
    raise exception 'Você não tem permissão para registrar fechamentos.' using errcode = '42501';
  end if;
  if coalesce(trim(p ->> 'name'), '') = '' then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'services', '[]')) = 0 then
    raise exception 'Escolha ao menos um serviço vendido.' using errcode = 'P0001';
  end if;

  insert into public.clients (organization_id, name, legal_name, document, segment, status, contract_start, contract_end,
                              renewal_date, media_budget_cents, monthly_fee_cents, payment_method, communication_channel, created_by)
  values (v_org, trim(p ->> 'name'), nullif(trim(p ->> 'legal_name'), ''), nullif(trim(p ->> 'document'), ''),
          nullif(trim(p ->> 'segment'), ''), 'onboarding', v_start,
          case when v_months is not null then (v_start + make_interval(months => v_months) - interval '1 day')::date end,
          case when v_months is not null then (v_start + make_interval(months => v_months) - interval '30 days')::date end,
          nullif(p ->> 'media_budget_cents', '')::bigint, nullif(p ->> 'monthly_fee_cents', '')::bigint,
          nullif(trim(p ->> 'payment_method'), ''), nullif(trim(p ->> 'communication_channel'), ''), auth.uid())
  returning id into v_client;

  for v_s in select * from jsonb_array_elements(p -> 'services') loop
    insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
    select v_client, sc.id, coalesce((v_s ->> 'monthly_qty')::int, 0), nullif(v_s ->> 'price_cents', '')::bigint, v_start
    from public.service_catalog sc where sc.id = (v_s ->> 'service_id')::uuid and sc.organization_id = v_org;
  end loop;

  if coalesce(trim(p -> 'contact' ->> 'name'), '') <> '' then
    insert into public.client_contacts (client_id, name, role, phone, email, is_primary)
    values (v_client, trim(p -> 'contact' ->> 'name'), nullif(trim(p -> 'contact' ->> 'role'), ''),
            nullif(trim(p -> 'contact' ->> 'phone'), ''), nullif(lower(trim(p -> 'contact' ->> 'email')), ''), true);
  end if;

  insert into public.commercial_handoffs (client_id, sold_by, closed_on, monthly_fee_cents, setup_fee_cents, payment_method,
                                          contract_months, notes, created_by)
  values (v_client, auth.uid(), current_date, nullif(p ->> 'monthly_fee_cents', '')::bigint, nullif(p ->> 'setup_fee_cents', '')::bigint,
          nullif(trim(p ->> 'payment_method'), ''), v_months, nullif(trim(p ->> 'notes'), ''), auth.uid())
  returning id into v_handoff;

  insert into public.handoff_promises (client_id, handoff_id, description, due_at)
  select v_client, v_handoff, trim(x ->> 'description'), (x ->> 'due_at')::timestamptz
  from jsonb_array_elements(coalesce(p -> 'promises', '[]')) x
  where coalesce(trim(x ->> 'description'), '') <> '' and nullif(x ->> 'due_at', '') is not null;

  insert into public.client_onboarding (client_id, form_id)
  select v_client, f.id from public.onboarding_forms f where f.organization_id = v_org and f.is_current;

  v_recipients := private.onboarding_recipients(v_org);
  for v_t in select * from public.onboarding_checklist_templates where organization_id = v_org and is_active order by position loop
    -- Responsável padrão: alguém do setor do item que recebe o aviso de onboarding; senão, primeiro do setor.
    select ps.profile_id into v_assignee
      from public.profile_sectors ps join public.profiles pr on pr.id = ps.profile_id and pr.is_active
     where ps.sector_id = v_t.default_sector_id
     order by (ps.profile_id = any (v_recipients)) desc, ps.is_lead desc, ps.created_at
     limit 1;
    insert into public.onboarding_checklist_items (client_id, title, assignee_id, due_at, position)
    values (v_client, v_t.title, v_assignee, now() + make_interval(days => v_t.due_days), v_t.position);
    v_assignee := null;
  end loop;

  perform private.timeline(v_client, 'handoff', 'Fechamento comercial registrado', jsonb_build_object('handoff_id', v_handoff));
  perform private.log_event('handoff_created', 'clients', v_client::text, jsonb_build_object('name', p ->> 'name'));
  perform public.notify_users(v_recipients, 'client_onboarding', 'Cliente novo em onboarding: ' || trim(p ->> 'name'),
    'O comercial registrou o fechamento. Abra a ficha e o checklist de onboarding.', '/clientes/' || v_client,
    'onboarding:' || v_client, auth.uid());
  return v_client;
end;
$$;

grant execute on function public.create_handoff(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: concluir onboarding (RF-ONB-03/04)
-- -----------------------------------------------------------------------------
create or replace function public.onboarding_missing(p_client uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
  v_ob public.client_onboarding;
  v_q jsonb;
  v_sec jsonb;
  v_ans text;
begin
  if not private.can_client('clients.read', p_client) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  select * into v_ob from public.client_onboarding where client_id = p_client;
  if v_ob.client_id is null then return array['Ficha de onboarding não criada']; end if;
  for v_sec in select * from jsonb_array_elements((select sections from public.onboarding_forms where id = v_ob.form_id)) loop
    for v_q in select * from jsonb_array_elements(v_sec -> 'questions') loop
      if coalesce((v_q ->> 'required')::boolean, false) then
        v_ans := v_ob.answers ->> (v_q ->> 'key');
        if v_ans is null or trim(v_ans) = '' or v_ans = '[]' then
          v_missing := array_append(v_missing, 'Ficha: ' || (v_q ->> 'label'));
        end if;
      end if;
    end loop;
  end loop;
  select v_missing || coalesce(array_agg('Checklist: ' || title order by position), '{}') into v_missing
    from public.onboarding_checklist_items where client_id = p_client and done_at is null;
  if not exists (select 1 from public.client_members where client_id = p_client) then
    v_missing := array_append(v_missing, 'Responsáveis: marque ao menos uma pessoa da equipe');
  end if;
  return v_missing;
end;
$$;

grant execute on function public.onboarding_missing(uuid) to authenticated;

create or replace function public.complete_onboarding(p_client uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text[];
  v_slots int;
  v_client public.clients;
  v_members uuid[];
begin
  if not private.can_client('clients.onboarding.manage', p_client) then
    raise exception 'Você não tem permissão para concluir este onboarding.' using errcode = '42501';
  end if;
  select * into v_client from public.clients where id = p_client for update;
  if v_client.status <> 'onboarding' then
    raise exception 'Este cliente não está em onboarding.' using errcode = 'P0001';
  end if;
  v_missing := public.onboarding_missing(p_client);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Falta concluir: %', array_to_string(v_missing, '; ') using errcode = 'P0001', hint = 'onboarding_incomplete';
  end if;

  update public.clients set status = 'ativo', onboarding_completed_at = now() where id = p_client;
  update public.client_onboarding set completed_at = now(), completed_by = auth.uid() where client_id = p_client;
  perform private.timeline(p_client, 'onboarding', 'Onboarding concluído: cliente ativo');
  perform private.log_event('onboarding_completed', 'clients', p_client::text);
  v_slots := private.generate_slots(p_client, (now() at time zone 'America/Sao_Paulo')::date);

  select array_agg(distinct profile_id) into v_members from public.client_members where client_id = p_client;
  perform public.notify_users(v_members, 'client_onboarding', v_client.name || ' está ativo',
    'O onboarding foi concluído. Você foi marcado na equipe deste cliente.', '/clientes/' || p_client,
    'ativo:' || p_client, auth.uid());
  return v_slots;
end;
$$;

grant execute on function public.complete_onboarding(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: alterar serviço depois do onboarding (RF-ONB-07): vale do mês seguinte
-- -----------------------------------------------------------------------------
create or replace function public.set_client_service(p_client uuid, p_service uuid, p_qty int, p_price_cents bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_cur public.client_services;
  v_next date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month')::date;
  v_name text;
begin
  if not private.can_manage_client(p_client) then
    raise exception 'Você não tem permissão para alterar os serviços deste cliente.' using errcode = '42501';
  end if;
  select * into v_client from public.clients where id = p_client;
  select name into v_name from public.service_catalog where id = p_service and organization_id = v_client.organization_id;
  if v_name is null then raise exception 'Serviço não encontrado.' using errcode = 'P0002'; end if;
  if p_qty is not null and (p_qty < 0 or p_qty > 200) then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;

  select * into v_cur from public.client_services
   where client_id = p_client and service_id = p_service and (ends_on is null or ends_on >= current_date)
   order by starts_on desc limit 1;

  if v_client.status = 'onboarding' then
    -- Antes de ativar: altera direto.
    if p_qty is null then
      delete from public.client_services where id = v_cur.id;
    elsif v_cur.id is null then
      insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
      values (p_client, p_service, p_qty, p_price_cents, coalesce(v_client.contract_start, current_date));
    else
      update public.client_services set monthly_qty = p_qty, price_cents = p_price_cents where id = v_cur.id;
    end if;
  else
    -- Cliente ativo: o mês atual fica como está; a mudança vale a partir do mês seguinte.
    if v_cur.id is not null then
      if v_cur.starts_on >= v_next then
        delete from public.client_services where id = v_cur.id;
      else
        update public.client_services set ends_on = v_next - 1 where id = v_cur.id;
      end if;
    end if;
    if p_qty is not null then
      insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
      values (p_client, p_service, p_qty, p_price_cents, v_next);
    end if;
  end if;

  perform private.timeline(p_client, 'service',
    case when p_qty is null then 'Serviço removido: ' || v_name
         else 'Serviço ' || v_name || ': ' || p_qty || ' por mês' end
    || case when v_client.status = 'onboarding' then '' else ' (a partir de ' || private.month_label(v_next) || ')' end,
    jsonb_build_object('service_id', p_service, 'qty', p_qty));
end;
$$;

grant execute on function public.set_client_service(uuid, uuid, int, bigint) to authenticated;

-- Resumo operacional da ficha para quem não vê a ficha completa (RF-ONB-06).
create or replace function public.client_operational_summary(p_client uuid)
returns table (section text, label text, answer text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_client('clients.read', p_client) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  return query
    select s ->> 'title', q ->> 'label', o.answers ->> (q ->> 'key')
    from public.client_onboarding o
    join public.onboarding_forms f on f.id = o.form_id
    cross join lateral jsonb_array_elements(f.sections) s
    cross join lateral jsonb_array_elements(s -> 'questions') q
    where o.client_id = p_client and q ->> 'visibility' = 'operational'
      and coalesce(trim(o.answers ->> (q ->> 'key')), '') <> '';
end;
$$;

grant execute on function public.client_operational_summary(uuid) to authenticated;

-- Membro marcado: entra na linha do tempo e é avisado.
create or replace function private.on_client_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_client text;
  v_sector text;
begin
  select full_name into v_name from public.profiles where id = coalesce(new.profile_id, old.profile_id);
  select name into v_client from public.clients where id = coalesce(new.client_id, old.client_id);
  select name into v_sector from public.sectors where id = coalesce(new.sector_id, old.sector_id);
  if tg_op = 'INSERT' then
    perform private.timeline(new.client_id, 'member', v_name || ' marcado(a) em ' || v_sector);
    perform public.notify_users(array[new.profile_id], 'assigned', 'Você foi marcado(a) no cliente ' || v_client,
      'Setor: ' || v_sector, '/clientes/' || new.client_id, 'membro:' || new.client_id || ':' || new.sector_id, auth.uid());
  elsif tg_op = 'DELETE' then
    perform private.timeline(old.client_id, 'member', v_name || ' removido(a) de ' || v_sector);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger client_members_events after insert or delete on public.client_members
  for each row execute function private.on_client_member();

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------
create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function private.audit_row('', 'name,status,segment,contract_start,contract_end,renewal_date,media_budget_cents,monthly_fee_cents,payment_method,deleted_at');
create trigger audit_client_services after insert or update or delete on public.client_services
  for each row execute function private.audit_row();
create trigger audit_client_members after insert or delete on public.client_members
  for each row execute function private.audit_row();
create trigger audit_service_catalog after insert or update or delete on public.service_catalog
  for each row execute function private.audit_row();
create trigger audit_onboarding_forms after insert on public.onboarding_forms
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.service_catalog enable row level security;
alter table public.client_imports enable row level security;
alter table public.clients enable row level security;
alter table public.client_services enable row level security;
alter table public.client_members enable row level security;
alter table public.client_accounts enable row level security;
alter table public.client_contacts enable row level security;
alter table public.commercial_handoffs enable row level security;
alter table public.handoff_promises enable row level security;
alter table public.onboarding_forms enable row level security;
alter table public.onboarding_checklist_templates enable row level security;
alter table public.client_onboarding enable row level security;
alter table public.onboarding_checklist_items enable row level security;
alter table public.client_meetings enable row level security;
alter table public.client_ideas enable row level security;
alter table public.client_files enable row level security;
alter table public.client_timeline enable row level security;
alter table public.tasks enable row level security;

create policy service_catalog_select on public.service_catalog for select to authenticated
  using (organization_id = (select private.org_id()));
create policy service_catalog_write on public.service_catalog for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')));

create policy client_imports_select on public.client_imports for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('clients.import')));
revoke insert, update, delete on public.client_imports from authenticated;

create policy clients_select on public.clients for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('clients.read', id)));
create policy clients_update on public.clients for update to authenticated
  using ((select private.can_manage_client(id)))
  with check (organization_id = (select private.org_id()));
-- Cliente nasce pelo fechamento (create_handoff) ou importação; status muda por RPC.
revoke insert, delete on public.clients from authenticated;
revoke update on public.clients from authenticated;
grant update (name, legal_name, document, segment, contract_start, contract_end, renewal_date, media_budget_cents,
  monthly_fee_cents, payment_method, communication_channel, notes) on public.clients to authenticated;

-- Tabelas filhas: leitura de quem lê o cliente; escrita de quem gerencia.
create policy client_services_select on public.client_services for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
revoke insert, update, delete on public.client_services from authenticated;

create policy client_members_select on public.client_members for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_members_write on public.client_members for all to authenticated
  using ((select private.can_manage_client(client_id)))
  with check ((select private.can_manage_client(client_id))
              and exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id())));

create policy client_accounts_select on public.client_accounts for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_accounts_write on public.client_accounts for all to authenticated
  using ((select private.can_manage_client(client_id))) with check ((select private.can_manage_client(client_id)));

create policy client_contacts_select on public.client_contacts for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_contacts_write on public.client_contacts for all to authenticated
  using ((select private.can_manage_client(client_id))) with check ((select private.can_manage_client(client_id)));

-- Valores do fechamento: quem vê a ficha completa.
create policy commercial_handoffs_select on public.commercial_handoffs for select to authenticated
  using ((select private.can_client('clients.onboarding.read', client_id)));
create policy commercial_handoffs_update on public.commercial_handoffs for update to authenticated
  using ((select private.has_perm('commercial.handoff.create')) and (select private.can_client('clients.onboarding.read', client_id)));
revoke insert, delete on public.commercial_handoffs from authenticated;

create policy handoff_promises_select on public.handoff_promises for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy handoff_promises_write on public.handoff_promises for all to authenticated
  using ((select private.can_manage_client(client_id)) or (select private.has_perm('commercial.handoff.create')) and (select private.can_client('clients.read', client_id)))
  with check ((select private.can_manage_client(client_id)) or (select private.has_perm('commercial.handoff.create')) and (select private.can_client('clients.read', client_id)));

create policy onboarding_forms_select on public.onboarding_forms for select to authenticated
  using (organization_id = (select private.org_id()));
create policy onboarding_forms_insert on public.onboarding_forms for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')));
revoke update, delete on public.onboarding_forms from authenticated;

create policy onboarding_checklist_templates_select on public.onboarding_checklist_templates for select to authenticated
  using (organization_id = (select private.org_id()));
create policy onboarding_checklist_templates_write on public.onboarding_checklist_templates for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('settings.manage')));

create policy client_onboarding_select on public.client_onboarding for select to authenticated
  using ((select private.can_client('clients.onboarding.read', client_id)));
create policy client_onboarding_update on public.client_onboarding for update to authenticated
  using ((select private.can_client('clients.onboarding.manage', client_id)) and completed_at is null)
  with check ((select private.can_client('clients.onboarding.manage', client_id)));
revoke insert, delete on public.client_onboarding from authenticated;
revoke update on public.client_onboarding from authenticated;
grant update (answers, updated_at, updated_by) on public.client_onboarding to authenticated;

create policy onboarding_checklist_select on public.onboarding_checklist_items for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy onboarding_checklist_write on public.onboarding_checklist_items for all to authenticated
  using ((select private.can_client('clients.onboarding.manage', client_id)) or assignee_id = (select auth.uid()))
  with check ((select private.can_client('clients.onboarding.manage', client_id)) or assignee_id = (select auth.uid()));

create policy client_meetings_select on public.client_meetings for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_meetings_insert on public.client_meetings for insert to authenticated
  with check ((select private.can_client('clients.read', client_id)) and created_by = (select auth.uid()));
create policy client_meetings_update on public.client_meetings for update to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));
create policy client_meetings_delete on public.client_meetings for delete to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));

create policy client_ideas_select on public.client_ideas for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_ideas_insert on public.client_ideas for insert to authenticated
  with check ((select private.can_client('clients.read', client_id)) and created_by = (select auth.uid()));
create policy client_ideas_update on public.client_ideas for update to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));
create policy client_ideas_delete on public.client_ideas for delete to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));

create policy client_files_select on public.client_files for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_files_insert on public.client_files for insert to authenticated
  with check ((select private.can_client('clients.read', client_id)) and uploaded_by = (select auth.uid()));
create policy client_files_delete on public.client_files for delete to authenticated
  using ((select private.can_manage_client(client_id)) or uploaded_by = (select auth.uid()));

create policy client_timeline_select on public.client_timeline for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
revoke insert, update, delete on public.client_timeline from authenticated;

create policy tasks_select on public.tasks for select to authenticated
  using (organization_id = (select private.org_id()) and deleted_at is null and (select private.can_task('tasks.read', id)));
create policy tasks_update on public.tasks for update to authenticated
  using ((select private.can_task('tasks.manage', id)))
  with check (organization_id = (select private.org_id()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.manage'))
              and (client_id is null or (select private.can_client('tasks.manage', client_id)) or (select private.perm_scope('tasks.manage')) = 'all'));

-- -----------------------------------------------------------------------------
-- Storage: bucket privado "anexos" — caminho clientes/<client_id>/...
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create or replace function private.storage_client(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) = 'clientes'
              and split_part(p_name, '/', 2) ~ '^[0-9a-f-]{36}$'
         then split_part(p_name, '/', 2)::uuid end;
$$;

grant execute on function private.storage_client(text) to authenticated;

create policy anexos_select on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (select private.can_client('clients.read', private.storage_client(name))));
create policy anexos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (select private.can_client('clients.read', private.storage_client(name))));
create policy anexos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and ((select private.can_manage_client(private.storage_client(name))) or owner_id = (select auth.uid())::text));
