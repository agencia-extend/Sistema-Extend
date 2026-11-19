-- Plano de campanha por cliente (RF-PLA-01) com vínculo à campanha real (RF-PLA-02).
-- O plano diz o que vai ao ar: objetivo, orçamento, público, período, plataforma e criativos (da biblioteca ou pedidos).
-- Situação: rascunho → aprovado pelo cliente → no ar → encerrado.
-- Vínculo: quando aparece nas contas do cliente uma campanha com o mesmo nome do plano (o nome padrão, RF-PLA-03),
-- o plano se liga sozinho; também dá para escolher a campanha à mão. Plano aprovado cuja campanha está ativa passa
-- para "no ar" sozinho.

create table public.campaign_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 3 and 200),
  platform        text not null check (platform in ('meta', 'google')),
  objective       text not null check (objective in ('leads', 'mensagens', 'vendas', 'trafego', 'engajamento', 'alcance', 'reconhecimento', 'seguidores', 'video')),
  budget_type     text not null check (budget_type in ('diario', 'total')),
  budget_cents    bigint not null check (budget_cents > 0 and budget_cents <= 100000000000),
  audience        text not null check (char_length(btrim(audience)) between 3 and 1000),
  start_date      date not null,
  end_date        date,
  status          text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'no_ar', 'encerrado')),
  approved_by     text check (char_length(approved_by) between 2 and 120),
  approved_on     date,
  notes           text check (char_length(notes) <= 2000),
  campaign_id     uuid references public.ad_campaigns (id) on delete set null,
  link_source     text check (link_source in ('auto', 'manual')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (budget_type = 'diario' or end_date is not null),
  check (status in ('rascunho') or (approved_by is not null and approved_on is not null)),
  check ((campaign_id is null) = (link_source is null))
);
create index campaign_plans_client on public.campaign_plans (client_id, start_date desc);
create unique index campaign_plans_campaign on public.campaign_plans (campaign_id) where campaign_id is not null;
create trigger campaign_plans_updated_at before update on public.campaign_plans for each row execute function private.set_updated_at();
create trigger audit_campaign_plans after insert or update or delete on public.campaign_plans
  for each row execute function private.audit_row('', 'name,status,budget_cents,budget_type,start_date,end_date,campaign_id');

create table public.campaign_plan_creatives (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.campaign_plans (id) on delete cascade,
  library_id      uuid references public.creative_library (id) on delete cascade,
  request_task_id uuid references public.creative_requests (task_id) on delete cascade,
  check (num_nonnulls(library_id, request_task_id) = 1)
);
create unique index campaign_plan_creatives_lib on public.campaign_plan_creatives (plan_id, library_id) where library_id is not null;
create unique index campaign_plan_creatives_req on public.campaign_plan_creatives (plan_id, request_task_id) where request_task_id is not null;

-- Nome comparável: sem espaços nas pontas e sem diferença de maiúsculas.
create or replace function private.plan_key(p text)
returns text language sql immutable set search_path = '' as $$ select lower(btrim(p)) $$;

-- Campanha das contas do cliente, na plataforma do plano, com o mesmo nome e ainda sem plano.
create or replace function private.plan_campaign_match(p_client uuid, p_platform text, p_name text, p_plan uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.ad_campaigns c
    join public.ad_accounts a on a.id = c.ad_account_id
   where a.client_id = p_client and a.provider = p_platform
     and private.plan_key(c.name) = private.plan_key(p_name)
     and not exists (select 1 from public.campaign_plans o where o.campaign_id = c.id and o.id is distinct from p_plan)
   order by (c.effective_status = 'ACTIVE') desc, c.last_seen_at desc
   limit 1
$$;

-- Organização, autor e cliente vêm do servidor; vínculo automático ou conferência do vínculo manual.
create or replace function private.campaign_plan_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active boolean;
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
    new.client_id := old.client_id;
    new.organization_id := old.organization_id;
  end if;
  new.name := btrim(new.name);
  new.audience := btrim(new.audience);
  if new.status = 'rascunho' then
    new.approved_by := null;
    new.approved_on := null;
  end if;

  if new.campaign_id is not null and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id) then
    -- Escolhido à mão: a campanha precisa ser de uma conta do cliente, na mesma plataforma.
    if not exists (select 1 from public.ad_campaigns c join public.ad_accounts a on a.id = c.ad_account_id
                    where c.id = new.campaign_id and a.client_id = new.client_id and a.provider = new.platform) then
      raise exception 'Esta campanha não é de uma conta deste cliente nesta plataforma.' using errcode = 'P0001';
    end if;
    -- Vindo do gatilho da sincronização é automático; vindo da pessoa, manual.
    new.link_source := case when pg_trigger_depth() > 1 then 'auto' else 'manual' end;
  elsif new.campaign_id is null then
    new.link_source := null;
    -- Sem vínculo: procura a campanha com o mesmo nome (não religa o que a pessoa acabou de soltar).
    if tg_op = 'INSERT' or old.campaign_id is null then
      new.campaign_id := private.plan_campaign_match(new.client_id, new.platform, new.name, new.id);
      if new.campaign_id is not null then new.link_source := 'auto'; end if;
    end if;
  elsif tg_op = 'UPDATE' and new.platform is distinct from old.platform then
    raise exception 'Solte a campanha antes de trocar a plataforma.' using errcode = 'P0001';
  end if;

  -- Aprovado e com a campanha ativa: está no ar.
  if new.status = 'aprovado' and new.campaign_id is not null then
    select c.effective_status = 'ACTIVE' into v_active from public.ad_campaigns c where c.id = new.campaign_id;
    if v_active then new.status := 'no_ar'; end if;
  end if;
  return new;
end;
$$;
create trigger campaign_plans_defaults before insert or update on public.campaign_plans for each row execute function private.campaign_plan_defaults();

-- Linha do tempo e avisos: plano novo avisa a equipe de tráfego do cliente; mudança de situação e vínculo avisam
-- quem criou o plano e a equipe (nunca quem fez a ação; a sincronização não tem pessoa).
create or replace function private.campaign_plan_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client text;
  v_users uuid[];
  v_title text;
  v_body text;
  v_camp text;
  v_label constant jsonb := '{"rascunho":"Rascunho","aprovado":"Aprovado pelo cliente","no_ar":"No ar","encerrado":"Encerrado"}';
begin
  select name into v_client from public.clients where id = new.client_id;
  select array_agg(distinct u) into v_users from (
    select m.profile_id as u from public.client_members m join public.sectors s on s.id = m.sector_id and s.key = 'trafego' where m.client_id = new.client_id
    union select new.created_by where new.created_by is not null
  ) x;

  if tg_op = 'INSERT' then
    perform private.timeline(new.client_id, 'trafego', 'Plano de campanha criado: ' || new.name);
    v_title := 'Plano de campanha: ' || v_client;
    v_body := new.name || ' (' || (v_label ->> new.status) || ').';
  elsif new.status is distinct from old.status then
    perform private.timeline(new.client_id, 'trafego', 'Plano ' || new.name || ': ' || (v_label ->> new.status));
    v_title := 'Plano ' || lower(v_label ->> new.status) || ': ' || v_client;
    v_body := new.name || case when new.status = 'aprovado' then ', aprovado por ' || new.approved_by || '.'
                               when new.status = 'no_ar' and new.campaign_id is not null and auth.uid() is null then ': a campanha ligada está ativa.'
                               else '.' end;
  elsif new.campaign_id is not null and new.campaign_id is distinct from old.campaign_id then
    select name into v_camp from public.ad_campaigns where id = new.campaign_id;
    perform private.timeline(new.client_id, 'trafego', 'Plano ' || new.name || ' ligado à campanha ' || v_camp);
    v_title := 'Plano ligado à campanha: ' || v_client;
    v_body := new.name || ' → ' || v_camp || '.';
  else
    return null;
  end if;

  if v_users is not null then
    perform public.notify_users(v_users, 'ad_alert', v_title, v_body,
      '/clientes/' || new.client_id || '/trafego#planos', 'plano:' || new.id || ':' || new.status || ':' || coalesce(new.campaign_id::text, ''), auth.uid());
  end if;
  return null;
end;
$$;
create trigger campaign_plans_events after insert or update on public.campaign_plans for each row execute function private.campaign_plan_events();

-- A sincronização trouxe ou renomeou uma campanha: liga os planos sem vínculo com o mesmo nome.
-- A campanha ficou ativa: o plano aprovado ligado a ela passa para "no ar".
create or replace function private.campaign_plan_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if not exists (select 1 from public.campaign_plans where campaign_id = new.id) then
      select p.id into v_plan
        from public.campaign_plans p join public.ad_accounts a on a.id = new.ad_account_id
       where p.campaign_id is null and p.client_id = a.client_id and p.platform = a.provider
         and p.status <> 'encerrado' and private.plan_key(p.name) = private.plan_key(new.name)
       order by p.created_at
       limit 1;
      if v_plan is not null then
        update public.campaign_plans set campaign_id = new.id where id = v_plan;
      end if;
    end if;
  end if;
  if new.effective_status = 'ACTIVE' and (tg_op = 'INSERT' or old.effective_status is distinct from 'ACTIVE') then
    update public.campaign_plans set status = 'no_ar' where campaign_id = new.id and status = 'aprovado';
  end if;
  return null;
end;
$$;
create trigger ad_campaigns_plan_sync after insert or update of name, effective_status on public.ad_campaigns
  for each row execute function private.campaign_plan_sync();

-- A conta passou a ser deste cliente: procura vínculo para os planos dele.
create or replace function private.campaign_plan_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null and new.client_id is distinct from old.client_id then
    update public.campaign_plans p set updated_at = now()
     where p.client_id = new.client_id and p.campaign_id is null and p.status <> 'encerrado' and p.platform = new.provider;
  end if;
  return null;
end;
$$;
create trigger ad_accounts_plan_link after update of client_id on public.ad_accounts
  for each row execute function private.campaign_plan_account();

-- Criativos do plano: só do mesmo cliente.
create or replace function private.campaign_plan_creative_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.campaign_plans where id = new.plan_id;
  if new.library_id is not null and not exists (select 1 from public.creative_library where id = new.library_id and client_id = v_client)
     or new.request_task_id is not null and not exists (select 1 from public.creative_requests where task_id = new.request_task_id and client_id = v_client) then
    raise exception 'Este criativo não é deste cliente.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger campaign_plan_creatives_check before insert or update on public.campaign_plan_creatives
  for each row execute function private.campaign_plan_creative_check();

-- RLS: lê quem vê o tráfego do cliente; cria, altera e apaga quem otimiza as contas do cliente.
alter table public.campaign_plans enable row level security;
create policy campaign_plans_select on public.campaign_plans for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id));
create policy campaign_plans_insert on public.campaign_plans for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy campaign_plans_update on public.campaign_plans for update to authenticated
  using (private.can_client('optimization.manage', client_id));
create policy campaign_plans_delete on public.campaign_plans for delete to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke all on public.campaign_plans from anon, authenticated;
grant select, delete on public.campaign_plans to authenticated;
grant insert (client_id, name, platform, objective, budget_type, budget_cents, audience, start_date, end_date, status, approved_by, approved_on, notes, campaign_id)
  on public.campaign_plans to authenticated;
grant update (name, platform, objective, budget_type, budget_cents, audience, start_date, end_date, status, approved_by, approved_on, notes, campaign_id)
  on public.campaign_plans to authenticated;

alter table public.campaign_plan_creatives enable row level security;
create policy campaign_plan_creatives_select on public.campaign_plan_creatives for select to authenticated
  using (exists (select 1 from public.campaign_plans p where p.id = plan_id));
create policy campaign_plan_creatives_insert on public.campaign_plan_creatives for insert to authenticated
  with check (exists (select 1 from public.campaign_plans p where p.id = plan_id and private.can_client('optimization.manage', p.client_id)));
create policy campaign_plan_creatives_delete on public.campaign_plan_creatives for delete to authenticated
  using (exists (select 1 from public.campaign_plans p where p.id = plan_id and private.can_client('optimization.manage', p.client_id)));
revoke all on public.campaign_plan_creatives from anon, authenticated;
grant select, delete on public.campaign_plan_creatives to authenticated;
grant insert (plan_id, library_id, request_task_id) on public.campaign_plan_creatives to authenticated;

revoke all on function private.plan_campaign_match(uuid, text, text, uuid), private.campaign_plan_defaults(), private.campaign_plan_events(),
  private.campaign_plan_sync(), private.campaign_plan_account(), private.campaign_plan_creative_check() from public, anon;
