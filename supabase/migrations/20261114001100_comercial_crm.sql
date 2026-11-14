-- Etapa 08 — Comercial (parte sem dependências externas): funis com etapas e prazo de parada,
-- leads (negócios) sem duplicar telefone/e-mail, atividades e próximas ações com lembrete,
-- importação com desfazer, perda com motivo obrigatório e Ganho → fechamento comercial.
-- Cadências por WhatsApp e prospectador (Google Places) dependem de contas da Extend: depois.

create table public.pipelines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 80),
  is_default      boolean not null default false,
  position        int not null default 0,
  created_at      timestamptz not null default now()
);
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  position    int not null,
  color       text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind        text not null default 'aberta' check (kind in ('aberta', 'ganho', 'perdido')),
  sla_days    int check (sla_days between 1 and 180)
);
create index pipeline_stages_idx on public.pipeline_stages (pipeline_id, position);

create table public.lead_imports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  file_name       text not null check (char_length(file_name) <= 200),
  row_count       int not null default 0,
  duplicates      int not null default 0,
  undone_at       timestamptz,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  pipeline_id      uuid not null references public.pipelines (id) on delete restrict,
  stage_id         uuid not null references public.pipeline_stages (id) on delete restrict,
  name             text not null check (char_length(name) between 2 and 120),
  company          text check (char_length(company) <= 160),
  phone            text check (phone ~ '^[0-9]{10,15}$'),
  email            text check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source           text not null default 'outro' check (source in ('anuncio', 'whatsapp', 'indicacao', 'prospeccao', 'organico', 'site', 'outro')),
  utm_source       text check (char_length(utm_source) <= 200),
  utm_medium       text check (char_length(utm_medium) <= 200),
  utm_campaign     text check (char_length(utm_campaign) <= 200),
  utm_content      text check (char_length(utm_content) <= 200),
  utm_term         text check (char_length(utm_term) <= 200),
  value_cents      bigint check (value_cents >= 0),
  owner_id         uuid references public.profiles (id) on delete set null,
  notes            text check (char_length(notes) <= 4000),
  lost_reason      text check (char_length(lost_reason) <= 500),
  won_client_id    uuid references public.clients (id) on delete set null,
  won_at           timestamptz,
  lost_at          timestamptz,
  stage_changed_at timestamptz not null default now(),
  import_id        uuid references public.lead_imports (id) on delete set null,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index leads_phone_uq on public.leads (organization_id, phone) where phone is not null;
create unique index leads_email_uq on public.leads (organization_id, lower(email)) where email is not null;
create index leads_stage_idx on public.leads (pipeline_id, stage_id);
create index leads_owner_idx on public.leads (owner_id);
create trigger leads_updated_at before update on public.leads for each row execute function private.set_updated_at();

create table public.lead_activities (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  kind       text not null check (kind in ('ligacao', 'mensagem', 'reuniao', 'nota', 'etapa', 'sistema')),
  body       text not null check (char_length(body) between 1 and 2000),
  due_at     timestamptz, -- próxima ação (lembrete)
  done_at    timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_due_idx on public.lead_activities (due_at) where due_at is not null and done_at is null;

-- Telefone só com dígitos e DDI 55 quando vier com DDD (10 ou 11 dígitos).
create or replace function private.normalize_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) in (10, 11) then '55' || regexp_replace(p, '\D', '', 'g')
    when length(regexp_replace(p, '\D', '', 'g')) between 12 and 15 then regexp_replace(p, '\D', '', 'g')
    else null end;
$$;

create or replace function private.lead_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  if new.phone is not null then new.phone := private.normalize_phone(new.phone); end if;
  return new;
end;
$$;
create trigger leads_normalize before insert or update of phone, email on public.leads for each row execute function private.lead_normalize();

-- Visibilidade: "todos" vê o comercial inteiro; "só os meus" vê os leads que tem ou criou.
create or replace function private.can_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leads l
     where l.id = p_lead and l.organization_id = private.org_id()
       and (private.perm_scope('crm.leads.read') = 'all' or l.owner_id = auth.uid() or l.created_by = auth.uid()));
$$;

alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_imports enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

create policy pipelines_select on public.pipelines for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('crm.leads.read')));
create policy pipelines_write on public.pipelines for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('crm.pipeline.configure')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('crm.pipeline.configure')));
create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id));
create policy pipeline_stages_write on public.pipeline_stages for all to authenticated
  using ((select private.has_perm('crm.pipeline.configure')) and exists (select 1 from public.pipelines p where p.id = pipeline_id and p.organization_id = (select private.org_id())))
  with check ((select private.has_perm('crm.pipeline.configure')) and exists (select 1 from public.pipelines p where p.id = pipeline_id and p.organization_id = (select private.org_id())));

create policy lead_imports_select on public.lead_imports for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('crm.leads.manage')));

create policy leads_select on public.leads for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('crm.leads.read'))
         and ((select private.perm_scope('crm.leads.read')) = 'all' or owner_id = (select auth.uid()) or created_by = (select auth.uid())));
create policy leads_insert on public.leads for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('crm.leads.manage')) and created_by = (select auth.uid()));
create policy leads_update on public.leads for update to authenticated
  using ((select private.has_perm('crm.leads.manage')) and (select private.can_lead(id)))
  with check (organization_id = (select private.org_id()));
create policy leads_delete on public.leads for delete to authenticated
  using ((select private.has_perm('crm.leads.manage')) and (select private.can_lead(id)) and won_client_id is null);

create policy lead_activities_select on public.lead_activities for select to authenticated using ((select private.can_lead(lead_id)));
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check ((select private.has_perm('crm.leads.manage')) and (select private.can_lead(lead_id)) and created_by = (select auth.uid()) and kind in ('ligacao', 'mensagem', 'reuniao', 'nota'));
create policy lead_activities_update on public.lead_activities for update to authenticated
  using ((select private.can_lead(lead_id)) and (select private.has_perm('crm.leads.manage')));

revoke all on public.pipelines, public.pipeline_stages, public.lead_imports, public.leads, public.lead_activities from authenticated, anon;
grant select, insert, update, delete on public.pipelines, public.pipeline_stages to authenticated;
grant select on public.lead_imports to authenticated;
grant select, delete on public.leads to authenticated;
grant insert (pipeline_id, stage_id, name, company, phone, email, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, value_cents, owner_id, notes) on public.leads to authenticated;
grant update (name, company, phone, email, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, value_cents, owner_id, notes) on public.leads to authenticated;
grant select, insert on public.lead_activities to authenticated;
grant update (done_at) on public.lead_activities to authenticated;

-- Funil padrão (RF-CRM-02).
insert into public.pipelines (organization_id, name, is_default)
select o.id, 'Funil de vendas', true from public.organizations o
 where not exists (select 1 from public.pipelines p where p.organization_id = o.id);
insert into public.pipeline_stages (pipeline_id, name, position, color, kind, sla_days)
select p.id, s.name, s.pos, s.color, s.kind, s.sla
  from public.pipelines p
 cross join (values
   ('Lead de anúncio / início de conversa', 1, '#2563EB', 'aberta', 1),
   ('Qualificação', 2, '#0891B2', 'aberta', 2),
   ('Reunião marcada', 3, '#7C3AED', 'aberta', 5),
   ('Proposta enviada', 4, '#D97706', 'aberta', 5),
   ('Negociação', 5, '#EA580C', 'aberta', 7),
   ('Ganho', 6, '#16A34A', 'ganho', null::int),
   ('Perdido', 7, '#DC2626', 'perdido', null::int)
 ) s(name, pos, color, kind, sla)
 where p.is_default and not exists (select 1 from public.pipeline_stages x where x.pipeline_id = p.id);

-- Novo lead: etapa precisa ser do funil; responsável padrão é quem cadastrou.
create or replace function private.lead_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.pipeline_stages s where s.id = new.stage_id and s.pipeline_id = new.pipeline_id) then
    raise exception 'Etapa não pertence a este funil.' using errcode = 'P0001';
  end if;
  new.owner_id := coalesce(new.owner_id, new.created_by);
  new.stage_changed_at := now();
  return new;
end;
$$;
create trigger leads_before_insert before insert on public.leads for each row execute function private.lead_before_insert();

-- Mover de etapa: perda exige motivo; tudo vai para o histórico do lead.
create or replace function public.move_lead(p_lead uuid, p_stage uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.leads;
  v_from text;
  v_to public.pipeline_stages;
begin
  if not (private.has_perm('crm.leads.manage') and private.can_lead(p_lead)) then
    raise exception 'Você não tem permissão para mover este lead.' using errcode = '42501';
  end if;
  select * into v_l from public.leads where id = p_lead for update;
  select * into v_to from public.pipeline_stages where id = p_stage and pipeline_id = v_l.pipeline_id;
  if v_to.id is null then raise exception 'Etapa não pertence a este funil.' using errcode = 'P0001'; end if;
  if v_to.id = v_l.stage_id then return; end if;
  if v_to.kind = 'perdido' and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da perda.' using errcode = 'P0001';
  end if;
  select name into v_from from public.pipeline_stages where id = v_l.stage_id;
  update public.leads
     set stage_id = v_to.id, stage_changed_at = now(),
         lost_reason = case when v_to.kind = 'perdido' then btrim(p_reason) else null end,
         lost_at = case when v_to.kind = 'perdido' then now() end,
         won_at = case when v_to.kind = 'ganho' then coalesce(won_at, now()) else null end
   where id = p_lead;
  insert into public.lead_activities (lead_id, kind, body)
  values (p_lead, 'etapa', 'De “' || v_from || '” para “' || v_to.name || '”' || case when v_to.kind = 'perdido' then ': ' || btrim(p_reason) else '' end);
end;
$$;
grant execute on function public.move_lead(uuid, uuid, text) to authenticated;

-- Importação com deduplicação (no banco e dentro da própria planilha).
create or replace function public.import_leads(p_file text, p_pipeline uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_import uuid;
  v_stage uuid;
  v_r jsonb;
  v_phone text;
  v_email text;
  v_seen_phone text[] := '{}';
  v_seen_email text[] := '{}';
  v_ok int := 0;
  v_dup int := 0;
begin
  if not private.has_perm('crm.leads.manage') then raise exception 'Você não tem permissão para importar leads.' using errcode = '42501'; end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 2000 then raise exception 'A planilha precisa ter entre 1 e 2.000 leads.' using errcode = 'P0001'; end if;
  select s.id into v_stage from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
   where p.id = p_pipeline and p.organization_id = v_org and s.kind = 'aberta' order by s.position limit 1;
  if v_stage is null then raise exception 'Funil não encontrado.' using errcode = 'P0002'; end if;

  insert into public.lead_imports (organization_id, file_name) values (v_org, left(p_file, 200)) returning id into v_import;
  for v_r in select * from jsonb_array_elements(p_rows) loop
    continue when char_length(btrim(coalesce(v_r ->> 'name', ''))) < 2;
    v_phone := private.normalize_phone(v_r ->> 'phone');
    v_email := nullif(lower(btrim(coalesce(v_r ->> 'email', ''))), '');
    if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    if (v_phone is not null and (v_phone = any (v_seen_phone) or exists (select 1 from public.leads where organization_id = v_org and phone = v_phone)))
       or (v_email is not null and (v_email = any (v_seen_email) or exists (select 1 from public.leads where organization_id = v_org and lower(email) = v_email))) then
      v_dup := v_dup + 1;
      continue;
    end if;
    insert into public.leads (organization_id, pipeline_id, stage_id, name, company, phone, email, source, value_cents, notes, import_id, created_by)
    values (v_org, p_pipeline, v_stage, left(btrim(v_r ->> 'name'), 120), nullif(left(btrim(coalesce(v_r ->> 'company', '')), 160), ''), v_phone, v_email,
            case when v_r ->> 'source' in ('anuncio', 'whatsapp', 'indicacao', 'prospeccao', 'organico', 'site') then v_r ->> 'source' else 'outro' end,
            nullif(v_r ->> 'value_cents', '')::bigint, nullif(left(btrim(coalesce(v_r ->> 'notes', '')), 4000), ''), v_import, auth.uid());
    if v_phone is not null then v_seen_phone := array_append(v_seen_phone, v_phone); end if;
    if v_email is not null then v_seen_email := array_append(v_seen_email, v_email); end if;
    v_ok := v_ok + 1;
  end loop;
  update public.lead_imports set row_count = v_ok, duplicates = v_dup where id = v_import;
  perform private.log_event('leads_imported', 'lead_imports', v_import::text, jsonb_build_object('rows', v_ok, 'duplicates', v_dup, 'file', p_file));
  return jsonb_build_object('import_id', v_import, 'imported', v_ok, 'duplicates', v_dup);
end;
$$;
grant execute on function public.import_leads(text, uuid, jsonb) to authenticated;

create or replace function public.undo_lead_import(p_import uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not private.has_perm('crm.leads.manage') then raise exception 'Você não tem permissão.' using errcode = '42501'; end if;
  if not exists (select 1 from public.lead_imports where id = p_import and organization_id = private.org_id() and undone_at is null) then
    raise exception 'Importação não encontrada ou já desfeita.' using errcode = 'P0002';
  end if;
  delete from public.leads where import_id = p_import and won_client_id is null;
  get diagnostics v_n = row_count;
  update public.lead_imports set undone_at = now() where id = p_import;
  return v_n;
end;
$$;
grant execute on function public.undo_lead_import(uuid) to authenticated;

-- Ganho: o fechamento comercial criado a partir do lead marca o lead como ganho e liga ao cliente.
create or replace function private.lead_won(p_lead uuid, p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_won uuid;
begin
  if p_lead is null or not private.can_lead(p_lead) then return; end if;
  select s.id into v_won from public.pipeline_stages s join public.leads l on l.pipeline_id = s.pipeline_id where l.id = p_lead and s.kind = 'ganho' order by s.position limit 1;
  update public.leads set won_client_id = p_client, won_at = coalesce(won_at, now()), stage_id = coalesce(v_won, stage_id), stage_changed_at = now(), lost_reason = null, lost_at = null where id = p_lead;
  insert into public.lead_activities (lead_id, kind, body) values (p_lead, 'sistema', 'Fechamento registrado: cliente criado e em onboarding.');
end;
$$;

do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.create_handoff(jsonb)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$  return v_client;
end;$q$, $q$  perform private.lead_won(nullif(p ->> 'lead_id', '')::uuid, v_client);
  return v_client;
end;$q$);
  execute v_src;
end;
$$;

-- Lembretes: próxima ação vencendo (para quem é dono do lead) e lead parado além do prazo da etapa.
create or replace function private.crm_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(array[l.owner_id], 'crm', 'Próxima ação: ' || l.name, left(a.body, 300), '/comercial/leads/' || l.id, 'lead_action:' || a.id)
  from public.lead_activities a join public.leads l on l.id = a.lead_id
  where a.done_at is null and a.due_at is not null and a.due_at <= now() + interval '30 minutes' and l.owner_id is not null;

  perform private.notify(array[l.owner_id], 'crm', 'Lead parado: ' || l.name,
    'Está em “' || s.name || '” há mais de ' || s.sla_days || ' dia(s).', '/comercial/leads/' || l.id,
    'lead_sla:' || l.id || ':' || l.stage_id || ':' || extract(epoch from l.stage_changed_at)::bigint)
  from public.leads l join public.pipeline_stages s on s.id = l.stage_id
  where s.kind = 'aberta' and s.sla_days is not null and l.owner_id is not null
    and l.stage_changed_at < now() - make_interval(days => s.sla_days);
end;
$$;
select cron.schedule('extend-comercial', '*/30 8-19 * * 1-6', $$select private.crm_tick()$$);
