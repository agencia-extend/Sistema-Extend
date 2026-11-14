-- Onboarding do fluxograma do Miro: passos com prazo em dias úteis (sem fins de semana e
-- feriados nacionais), orientação por passo, marcos na linha do tempo e avisos para
-- quem é responsável por cada passo e quando algo atrasa.

-- -----------------------------------------------------------------------------
-- Dias úteis
-- -----------------------------------------------------------------------------
-- Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
create or replace function private.easter(p_year int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a int := p_year % 19; b int := p_year / 100; c int := p_year % 100;
  d int := b / 4; e int := b % 4; f int := (b + 8) / 25; g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30; i int := c / 4; k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7; m int := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- Feriados nacionais (Lei 662/1949, 6.802/1980, 14.759/2023) e Sexta-feira Santa.
create or replace function private.is_br_holiday(p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select to_char(p_day, 'MM-DD') in ('01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25')
      or p_day = private.easter(extract(year from p_day)::int) - 2;
$$;

create or replace function private.is_business_day(p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$ select extract(isodow from p_day) < 6 and not private.is_br_holiday(p_day) $$;

-- N dias úteis depois de p_start (0 = o próprio dia: "imediato").
create or replace function private.add_business_days(p_start date, p_days int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := p_start;
  v_left int := greatest(p_days, 0);
begin
  while v_left > 0 loop
    v_day := v_day + 1;
    if private.is_business_day(v_day) then v_left := v_left - 1; end if;
  end loop;
  return v_day;
end;
$$;

grant execute on function private.add_business_days(date, int) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Modelo do checklist: tipo de prazo, marco e orientação
-- -----------------------------------------------------------------------------
alter table public.onboarding_checklist_templates
  add column day_kind text not null default 'uteis' check (day_kind in ('uteis', 'corridos')),
  add column milestone text check (milestone in ('abertura', 'briefing', 'combinados')),
  add column guidance text check (char_length(guidance) <= 1000);

alter table public.onboarding_checklist_items
  add column milestone text check (milestone in ('abertura', 'briefing', 'combinados')),
  add column guidance text check (char_length(guidance) <= 1000);

-- Troca o checklist padrão (ainda o inicial em todas as organizações) pelos passos do Miro.
delete from public.onboarding_checklist_templates;
insert into public.onboarding_checklist_templates (organization_id, title, default_sector_id, due_days, day_kind, milestone, guidance, position)
select o.id, t.title, (select id from public.sectors s where s.organization_id = o.id and s.key = t.sector), t.days, 'uteis', t.milestone, t.guidance, t.pos
from public.organizations o
cross join (values
  (1, 'Repasse da data de início e dos serviços vendidos para a coordenação', 'comercial', 0, 'abertura',
      'Logo depois do fechamento, pelo WhatsApp. O cadastro do cliente no sistema já foi feito pelo fechamento comercial.'),
  (2, 'Grupo de WhatsApp criado (cliente + equipe)', 'comercial', 0, 'abertura',
      'Será o canal principal de comunicação com o cliente.'),
  (3, 'Reunião de briefing agendada', 'conteudo', 2, 'briefing',
      'Agendar o mais rápido possível, pelo Google Agenda, em até 2 dias úteis.'),
  (4, 'Reunião de briefing realizada', 'conteudo', 4, 'briefing',
      'Pelo Google Meet, com a coordenação de mídias e o gestor de tráfego. Objetivo: captar o máximo de informações usando a ficha de onboarding como base.'),
  (5, 'Mídias: metodologia de produção definida e próxima reunião marcada', 'conteudo', 4, 'briefing',
      'Preencher a ficha de onboarding durante a reunião e agendar a próxima reunião para 7 dias depois.'),
  (6, 'Tráfego: orçamento definido, acessos recebidos e criativos de teste organizados', 'trafego', 5, 'briefing',
      'Acessos: Business Manager, conta de anúncios, página, Instagram e pasta do Drive.'),
  (7, 'Obrigações do cliente combinadas e registradas na ficha', 'conteudo', 5, 'combinados',
      'Porta-voz do projeto; prazo de feedback dos leads; prazo de resposta; prazo de aprovação; cliente sem produção entrega no mínimo 5 criativos por mês, no começo do mês; responder os relatórios semanais.')
) as t(pos, title, sector, days, milestone, guidance);

-- -----------------------------------------------------------------------------
-- Ficha: seção "Obrigações do cliente" (nova versão; onboardings abertos passam a usá-la)
-- -----------------------------------------------------------------------------
with cur as (
  select f.organization_id, f.version, f.sections from public.onboarding_forms f where f.is_current
)
insert into public.onboarding_forms (organization_id, version, sections, is_current)
select cur.organization_id, cur.version + 1,
  cur.sections || jsonb_build_array(jsonb_build_object(
    'key', 'obrigacoes', 'title', 'Obrigações do cliente', 'questions', jsonb_build_array(
      jsonb_build_object('key', 'porta_voz', 'type', 'text', 'label', 'Porta-voz do projeto (quem decide e aprova)', 'required', false, 'visibility', 'operational'),
      jsonb_build_object('key', 'prazo_feedback_leads', 'type', 'text', 'label', 'Prazo para dar retorno sobre os leads', 'required', false, 'visibility', 'operational'),
      jsonb_build_object('key', 'prazo_resposta', 'type', 'text', 'label', 'Prazo para responder a equipe', 'required', false, 'visibility', 'operational'),
      jsonb_build_object('key', 'prazo_aprovacao', 'type', 'text', 'label', 'Prazo para aprovar conteúdos e campanhas', 'required', false, 'visibility', 'operational'),
      jsonb_build_object('key', 'criativos_cliente', 'type', 'textarea', 'label', 'Criativos que o cliente entrega (sem produção: no mínimo 5 por mês, no começo do mês)', 'required', false, 'visibility', 'operational'),
      jsonb_build_object('key', 'relatorios_semanais', 'type', 'text', 'label', 'Como o cliente responde aos relatórios semanais', 'required', false, 'visibility', 'operational')
    ))),
  false
from cur
where not exists (select 1 from jsonb_array_elements(cur.sections) s where s ->> 'key' = 'obrigacoes');

-- Troca a versão atual em dois passos (o índice único de versão atual não aceita duas ao mesmo tempo).
update public.onboarding_forms f set is_current = false
 where f.is_current and exists (select 1 from public.onboarding_forms n where n.organization_id = f.organization_id and n.version > f.version);
update public.onboarding_forms f set is_current = true
 where not f.is_current
   and f.version = (select max(n.version) from public.onboarding_forms n where n.organization_id = f.organization_id)
   and not exists (select 1 from public.onboarding_forms c where c.organization_id = f.organization_id and c.is_current);

update public.client_onboarding o
   set form_id = f.id
  from public.onboarding_forms f, public.clients c
 where o.completed_at is null and c.id = o.client_id and f.organization_id = c.organization_id and f.is_current;

-- -----------------------------------------------------------------------------
-- Marcos do onboarding
-- -----------------------------------------------------------------------------
create table public.client_milestones (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  key        text not null check (key in ('abertura', 'briefing', 'combinados', 'conclusao')),
  title      text not null check (char_length(title) between 2 and 80),
  position   int not null,
  due_on     date,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, key)
);
alter table public.client_milestones enable row level security;
create policy client_milestones_select on public.client_milestones for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
grant select on public.client_milestones to authenticated;

create or replace function private.milestone_title(p_key text)
returns text
language sql
immutable
as $$
  select case p_key when 'abertura' then 'Abertura' when 'briefing' then 'Briefing' when 'combinados' then 'Combinados com o cliente' else 'Onboarding concluído' end;
$$;

-- Recalcula prazo e conclusão de um marco a partir dos passos dele.
create or replace function private.sync_milestone(p_client uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int; v_open int; v_due timestamptz; v_was timestamptz;
begin
  if p_key is null then return; end if;
  select count(*), count(*) filter (where done_at is null), max(due_at)
    into v_total, v_open, v_due
    from public.onboarding_checklist_items where client_id = p_client and milestone = p_key;
  select done_at into v_was from public.client_milestones where client_id = p_client and key = p_key;
  update public.client_milestones
     set due_on = (v_due at time zone 'America/Sao_Paulo')::date,
         done_at = case when v_total > 0 and v_open = 0 then coalesce(done_at, now()) else null end
   where client_id = p_client and key = p_key;
  if v_was is null and v_total > 0 and v_open = 0 then
    perform private.timeline(p_client, 'milestone', 'Marco concluído: ' || private.milestone_title(p_key), jsonb_build_object('key', p_key));
  end if;
  -- O marco final acompanha o prazo do último passo.
  update public.client_milestones
     set due_on = (select (max(due_at) at time zone 'America/Sao_Paulo')::date from public.onboarding_checklist_items where client_id = p_client)
   where client_id = p_client and key = 'conclusao' and done_at is null;
end;
$$;

-- Cria passos, marcos e avisos de um cliente novo (chamado no fechamento comercial).
create or replace function private.seed_onboarding(p_client uuid, p_org uuid, p_recipients uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_assignee uuid;
  v_today date := private.today_sp();
  v_due date;
  v_name text;
  v_item uuid;
begin
  select name into v_name from public.clients where id = p_client;
  for v_t in select * from public.onboarding_checklist_templates where organization_id = p_org and is_active order by position loop
    -- Responsável padrão: alguém do setor que recebe o aviso de onboarding; senão, o líder ou o primeiro do setor.
    select ps.profile_id into v_assignee
      from public.profile_sectors ps join public.profiles pr on pr.id = ps.profile_id and pr.is_active
     where ps.sector_id = v_t.default_sector_id
     order by (ps.profile_id = any (p_recipients)) desc, ps.is_lead desc, ps.created_at
     limit 1;
    v_due := case when v_t.day_kind = 'uteis' then private.add_business_days(v_today, v_t.due_days) else v_today + v_t.due_days end;
    insert into public.onboarding_checklist_items (client_id, title, assignee_id, due_at, position, milestone, guidance)
    values (p_client, v_t.title, v_assignee, (v_due + time '23:59') at time zone 'America/Sao_Paulo', v_t.position, v_t.milestone, v_t.guidance)
    returning id into v_item;
    if v_assignee is not null then
      perform private.notify(array[v_assignee], 'client_onboarding', 'Passo de onboarding para você: ' || v_t.title,
        v_name || ' · até ' || to_char(v_due, 'DD/MM'), '/clientes/' || p_client || '/ficha', 'onb_item:' || v_item);
    end if;
    v_assignee := null;
  end loop;

  insert into public.client_milestones (client_id, key, title, position)
  select p_client, k, private.milestone_title(k), n
  from unnest(array['abertura', 'briefing', 'combinados', 'conclusao']) with ordinality as m(k, n)
  where k = 'conclusao' or exists (select 1 from public.onboarding_checklist_items i where i.client_id = p_client and i.milestone = k);

  perform private.sync_milestone(p_client, k) from unnest(array['abertura', 'briefing', 'combinados']) k;
end;
$$;

-- Passo marcado, desmarcado, movido de marco, com prazo ou responsável novo.
create or replace function private.checklist_item_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    perform private.sync_milestone(old.client_id, old.milestone);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.milestone is distinct from new.milestone then
    perform private.sync_milestone(old.client_id, old.milestone);
  end if;
  perform private.sync_milestone(new.client_id, new.milestone);

  -- Passo passou para outra pessoa: ela é avisada.
  if tg_op = 'UPDATE' and new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id and new.done_at is null then
    select name into v_name from public.clients where id = new.client_id;
    perform private.notify(array[new.assignee_id], 'client_onboarding', 'Passo de onboarding para você: ' || new.title,
      v_name || coalesce(' · até ' || to_char(new.due_at at time zone 'America/Sao_Paulo', 'DD/MM'), ''),
      '/clientes/' || new.client_id || '/ficha', 'onb_item:' || new.id || ':' || new.assignee_id);
  end if;
  return new;
end;
$$;

create trigger checklist_item_changed
  after insert or delete or update of done_at, due_at, milestone, assignee_id on public.onboarding_checklist_items
  for each row execute function private.checklist_item_changed();

-- Onboarding concluído fecha o último marco.
create or replace function private.onboarding_completed_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    update public.client_milestones set done_at = new.completed_at where client_id = new.client_id and key = 'conclusao' and done_at is null;
  end if;
  return new;
end;
$$;

create trigger onboarding_completed_milestone after update of completed_at on public.client_onboarding
  for each row execute function private.onboarding_completed_milestone();

-- Avisos diários (dias úteis): passo atrasado para o responsável; marco atrasado para a coordenação e a equipe do cliente.
create or replace function private.onboarding_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(array[i.assignee_id], 'client_onboarding', 'Passo de onboarding atrasado: ' || i.title,
    c.name || ' · era até ' || to_char(i.due_at at time zone 'America/Sao_Paulo', 'DD/MM'), '/clientes/' || c.id || '/ficha', 'onb_late:' || i.id)
  from public.onboarding_checklist_items i
  join public.clients c on c.id = i.client_id
  where c.status = 'onboarding' and i.done_at is null and i.assignee_id is not null and i.due_at < now();

  perform private.notify(
    private.onboarding_recipients(c.organization_id) || coalesce((select array_agg(cm.profile_id) from public.client_members cm where cm.client_id = c.id), '{}'),
    'client_onboarding', 'Marco atrasado: ' || m.title || ' · ' || c.name,
    'Era até ' || to_char(m.due_on, 'DD/MM') || '. Veja os passos que faltam.', '/clientes/' || c.id || '/ficha', 'milestone_late:' || m.id)
  from public.client_milestones m
  join public.clients c on c.id = m.client_id
  where c.status = 'onboarding' and m.done_at is null and m.due_on < private.today_sp();
end;
$$;

select cron.schedule('extend-onboarding', '30 9 * * 1-5', $$select private.onboarding_tick()$$);

-- -----------------------------------------------------------------------------
-- Fechamento comercial passa a criar o onboarding pelos passos do Miro
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
  v_start date := coalesce(nullif(p ->> 'contract_start', '')::date, private.today_sp());
  v_months int := nullif(p ->> 'contract_months', '')::int;
  v_s jsonb;
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
  values (v_client, auth.uid(), private.today_sp(), nullif(p ->> 'monthly_fee_cents', '')::bigint, nullif(p ->> 'setup_fee_cents', '')::bigint,
          nullif(trim(p ->> 'payment_method'), ''), v_months, nullif(trim(p ->> 'notes'), ''), auth.uid())
  returning id into v_handoff;

  insert into public.handoff_promises (client_id, handoff_id, description, due_at)
  select v_client, v_handoff, trim(x ->> 'description'), (x ->> 'due_at')::timestamptz
  from jsonb_array_elements(coalesce(p -> 'promises', '[]')) x
  where coalesce(trim(x ->> 'description'), '') <> '' and nullif(x ->> 'due_at', '') is not null;

  insert into public.client_onboarding (client_id, form_id)
  select v_client, f.id from public.onboarding_forms f where f.organization_id = v_org and f.is_current;

  v_recipients := private.onboarding_recipients(v_org);
  perform private.seed_onboarding(v_client, v_org, v_recipients);

  perform private.timeline(v_client, 'handoff', 'Fechamento comercial registrado', jsonb_build_object('handoff_id', v_handoff));
  perform private.log_event('handoff_created', 'clients', v_client::text, jsonb_build_object('name', p ->> 'name'));
  perform public.notify_users(v_recipients, 'client_onboarding', 'Cliente novo em onboarding: ' || trim(p ->> 'name'),
    'O comercial registrou o fechamento. Abra a ficha e os passos do onboarding.', '/clientes/' || v_client,
    'onboarding:' || v_client, auth.uid());
  return v_client;
end;
$$;
