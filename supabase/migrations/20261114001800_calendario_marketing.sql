-- Calendário de marketing (RF-PLA-04/05): datas comemorativas nacionais calculadas + datas de cada cliente.
-- Uma data do cliente pode trazer o briefing de um criativo; N dias antes (padrão 15) o pedido é criado
-- sozinho, em nome de quem cadastrou a data, e vai para a fila de Criativos.

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, label, description, scoped, position) values
  ('marketing_calendar.read', 'Produção', 'Ver o calendário de marketing',
   'Datas comemorativas nacionais e as datas dos clientes (lançamentos, promoções, eventos).', true, 37),
  ('marketing_calendar.manage', 'Produção', 'Cadastrar datas no calendário de marketing',
   'Cadastrar, alterar e excluir datas dos clientes. Para agendar um pedido de criativo, também é preciso poder pedir criativos.', true, 38)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'marketing_calendar.read',
       case when r.key in ('admin', 'gerente_trafego', 'coord_conteudo', 'leitura') then 'all' else 'clients' end::public.permission_scope
  from public.roles r
 where r.key in ('admin', 'gerente_trafego', 'gestor_trafego', 'coord_conteudo', 'social_media', 'editor_video', 'designer', 'gravacao', 'leitura')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'marketing_calendar.manage',
       case when r.key in ('admin', 'gerente_trafego', 'coord_conteudo') then 'all' else 'clients' end::public.permission_scope
  from public.roles r
 where r.key in ('admin', 'gerente_trafego', 'gestor_trafego', 'coord_conteudo', 'social_media')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Datas nacionais (calculadas; não há o que manter ano a ano)
-- -----------------------------------------------------------------------------
create or replace function private.nth_weekday(p_year int, p_month int, p_isodow int, p_n int)
returns date
language sql
immutable
set search_path = ''
as $$
  select d + ((p_isodow - extract(isodow from d)::int + 7) % 7) + 7 * (p_n - 1)
    from (select make_date(p_year, p_month, 1) as d) x;
$$;

create or replace function public.national_marketing_dates(p_start date, p_end date)
returns table (on_date date, title text)
language sql
stable
set search_path = ''
as $$
  select d.on_date, d.title
    from generate_series(extract(year from p_start)::int, extract(year from p_end)::int) y
    cross join lateral (values
      (make_date(y, 1, 1), 'Ano Novo'),
      (private.easter(y) - 47, 'Carnaval'),
      (make_date(y, 3, 8), 'Dia Internacional da Mulher'),
      (make_date(y, 3, 15), 'Dia do Consumidor'),
      (private.easter(y), 'Páscoa'),
      (make_date(y, 5, 1), 'Dia do Trabalhador'),
      (private.nth_weekday(y, 5, 7, 2), 'Dia das Mães'),
      (make_date(y, 6, 12), 'Dia dos Namorados'),
      (make_date(y, 6, 24), 'São João (festas juninas)'),
      (private.nth_weekday(y, 8, 7, 2), 'Dia dos Pais'),
      (make_date(y, 9, 7), 'Independência do Brasil'),
      (make_date(y, 9, 15), 'Dia do Cliente'),
      (make_date(y, 10, 12), 'Dia das Crianças'),
      (make_date(y, 10, 31), 'Halloween'),
      (private.nth_weekday(y, 11, 4, 4) + 1, 'Black Friday'),
      (private.nth_weekday(y, 11, 4, 4) + 4, 'Cyber Monday'),
      (make_date(y, 12, 25), 'Natal'),
      (make_date(y, 12, 31), 'Réveillon')
    ) as d(on_date, title)
   where d.on_date between p_start and p_end
   order by d.on_date;
$$;
grant execute on function public.national_marketing_dates(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Datas dos clientes
-- -----------------------------------------------------------------------------
create table public.marketing_dates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  title           text not null check (char_length(title) between 2 and 120),
  on_date         date not null,
  kind            text not null default 'outro' check (kind in ('lancamento', 'promocao', 'evento', 'sazonal', 'outro')),
  notes           text check (char_length(notes) <= 2000),
  lead_days       int not null default 15 check (lead_days between 1 and 90),
  brief           jsonb,                                   -- briefing do criativo; nulo = só a data
  request_task_id uuid references public.tasks (id) on delete set null,
  requested_at    timestamptz,
  request_error   text,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index marketing_dates_client_idx on public.marketing_dates (client_id, on_date);
create index marketing_dates_pending_idx on public.marketing_dates (on_date) where brief is not null and requested_at is null;

alter table public.marketing_dates enable row level security;
create policy marketing_dates_select on public.marketing_dates for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('marketing_calendar.read', client_id)));
grant select on public.marketing_dates to authenticated;
-- Escrita só pelas funções abaixo.

-- Cria o pedido de criativo da data com o usuário atual (auth.uid()). Usada ao salvar e pelo job.
create or replace function private.marketing_request(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.marketing_dates;
  v_task uuid;
  v_due date;
begin
  select * into v_d from public.marketing_dates where id = p_id for update;
  if v_d.id is null or v_d.brief is null or v_d.requested_at is not null then return null; end if;
  v_due := greatest(private.today_sp() + 2, v_d.on_date - 5);
  v_task := public.create_creative_request(v_d.brief || jsonb_build_object(
    'client_id', v_d.client_id,
    'campaign', coalesce(nullif(btrim(v_d.brief ->> 'campaign'), ''), v_d.title),
    'due_at', (v_due::timestamp + time '18:00') at time zone 'America/Sao_Paulo',
    'notes', btrim(concat_ws(E'\n', nullif(btrim(v_d.brief ->> 'notes'), ''),
                            'Para a data “' || v_d.title || '” (' || to_char(v_d.on_date, 'DD/MM/YYYY') || '), do calendário de marketing.'))));
  update public.marketing_dates set request_task_id = v_task, requested_at = now(), request_error = null, updated_at = now() where id = p_id;
  return v_task;
end;
$$;
revoke all on function private.marketing_request(uuid) from public, anon, authenticated;

create or replace function public.save_marketing_date(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_old public.marketing_dates;
  v_client uuid := (p ->> 'client_id')::uuid;
  v_brief jsonb := nullif(p -> 'brief', 'null'::jsonb);
  v_org uuid;
begin
  if v_id is not null then
    select * into v_old from public.marketing_dates where id = v_id for update;
    if v_old.id is null then raise exception 'Data não encontrada.' using errcode = 'P0002'; end if;
    if not private.can_client('marketing_calendar.manage', v_old.client_id) then
      raise exception 'Você não tem permissão para alterar esta data.' using errcode = '42501';
    end if;
    v_client := v_old.client_id;
  end if;
  select organization_id into v_org from public.clients where id = v_client and deleted_at is null;
  if v_org is null or not private.can_client('marketing_calendar.manage', v_client) then
    raise exception 'Você não tem permissão para cadastrar datas deste cliente.' using errcode = '42501';
  end if;
  if (p ->> 'on_date')::date < private.today_sp() and (v_old.id is null or v_old.on_date <> (p ->> 'on_date')::date) then
    raise exception 'A data já passou. Escolha uma data a partir de hoje.' using errcode = 'P0001';
  end if;

  -- Pedido já criado: o briefing não muda mais (o pedido segue em Criativos).
  if v_old.requested_at is not null then
    v_brief := v_old.brief;
  elsif v_brief is not null then
    if not private.can_client('creatives.request.create', v_client) then
      raise exception 'Para agendar um pedido de criativo, é preciso poder pedir criativos para este cliente.' using errcode = '42501';
    end if;
    if exists (select 1 from unnest(array['format', 'objective', 'angle', 'audience', 'cta', 'priority']) k
                where char_length(btrim(coalesce(v_brief ->> k, ''))) = 0) then
      raise exception 'Preencha o briefing do criativo: formato, objetivo, ângulo, público, chamada e prioridade.' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.marketing_dates (organization_id, client_id, title, on_date, kind, notes, lead_days, brief)
    values (v_org, v_client, btrim(p ->> 'title'), (p ->> 'on_date')::date, p ->> 'kind', nullif(btrim(p ->> 'notes'), ''),
            coalesce((p ->> 'lead_days')::int, 15), v_brief)
    returning id into v_id;
  else
    update public.marketing_dates
       set title = btrim(p ->> 'title'), on_date = (p ->> 'on_date')::date, kind = p ->> 'kind', notes = nullif(btrim(p ->> 'notes'), ''),
           lead_days = coalesce((p ->> 'lead_days')::int, 15), brief = v_brief, request_error = null, updated_at = now()
     where id = v_id;
  end if;

  -- Já dentro da antecedência: o pedido sai agora, em nome de quem salvou.
  if v_brief is not null and (p ->> 'on_date')::date - coalesce((p ->> 'lead_days')::int, 15) <= private.today_sp() then
    perform private.marketing_request(v_id);
  end if;
  return v_id;
end;
$$;
grant execute on function public.save_marketing_date(jsonb) to authenticated;

create or replace function public.delete_marketing_date(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.marketing_dates where id = p_id;
  if v_client is null then raise exception 'Data não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_client('marketing_calendar.manage', v_client) then
    raise exception 'Você não tem permissão para excluir esta data.' using errcode = '42501';
  end if;
  delete from public.marketing_dates where id = p_id;
end;
$$;
grant execute on function public.delete_marketing_date(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Job diário: cria os pedidos que entraram na antecedência
-- -----------------------------------------------------------------------------
create or replace function private.marketing_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_task uuid;
begin
  for r in
    select d.id, d.title, d.created_by, c.owner_id, c.name as client_name
      from public.marketing_dates d
      join public.clients c on c.id = d.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where d.brief is not null and d.requested_at is null and d.request_error is null
       and d.on_date >= private.today_sp() and d.on_date - d.lead_days <= private.today_sp()
  loop
    begin
      if r.created_by is null then raise exception 'Quem cadastrou a data não está mais no sistema.'; end if;
      -- O pedido é feito em nome de quem cadastrou a data (as permissões dela valem).
      perform set_config('request.jwt.claims', json_build_object('sub', r.created_by, 'role', 'authenticated')::text, true);
      v_task := private.marketing_request(r.id);
      perform set_config('request.jwt.claims', '', true);
      perform public.notify_users(array[r.created_by], 'marketing',
        'Pedido de criativo criado: ' || r.title, r.client_name || '. O pedido foi para a fila de Criativos.',
        '/criativos/' || v_task, 'marketing_request:' || r.id, null);
    exception when others then
      perform set_config('request.jwt.claims', '', true);
      update public.marketing_dates set request_error = left(sqlerrm, 300), updated_at = now() where id = r.id;
      perform public.notify_users(array_remove(array[r.created_by, r.owner_id], null), 'marketing',
        'Pedido de criativo não criado: ' || r.title,
        r.client_name || ': ' || left(sqlerrm, 300) || ' Ajuste a data no calendário de marketing para tentar de novo.',
        '/calendario-marketing', 'marketing_request_error:' || r.id, null);
    end;
  end loop;
end;
$$;
revoke all on function private.marketing_tick() from public, anon, authenticated;

-- Todo dia às 8h (Brasília = UTC-3)
select cron.schedule('extend-calendario-marketing', '0 11 * * *', $$select private.marketing_tick()$$);

-- Clientes em que a pessoa cadastra datas e se pode agendar pedido de criativo (para o formulário).
create or replace function public.marketing_calendar_clients()
returns table (id uuid, name text, can_request boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, private.can_client('creatives.request.create', c.id)
    from public.clients c
   where c.organization_id = private.org_id() and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     and private.can_client('marketing_calendar.manage', c.id)
   order by c.name;
$$;
grant execute on function public.marketing_calendar_clients() to authenticated;
