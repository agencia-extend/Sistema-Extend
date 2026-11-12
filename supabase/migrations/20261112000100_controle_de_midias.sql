-- =============================================================================
-- Etapa 03B · Controle de Mídias (docs/08-briefing-midias.md, docs/09)
--  1. Mês do cliente pelo dia de início do contrato (14 a 14), não pelo calendário
--  2. Campos de cada conteúdo (formato, roteiro, quem grava, quem edita, links…)
--  3. Quadro do setor: quem edita vê e move o card; "em alteração" conta retrabalho
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ciclo mensal do cliente
-- -----------------------------------------------------------------------------
create table public.client_months (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  number      int not null check (number >= 1),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  unique (client_id, starts_on),
  unique (client_id, number),
  check (ends_on >= starts_on)
);

alter table public.client_months enable row level security;
create policy client_months_select on public.client_months for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
revoke insert, update, delete on public.client_months from authenticated, anon;

-- Mês do cliente que contém p_date. Dia 31 em mês curto cai no último dia do mês.
create or replace function private.cycle_of(p_start date, p_date date)
returns table (number int, starts_on date, ends_on date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n int;
  v_s date;
begin
  if p_start is null or p_date is null or p_date < p_start then return; end if;
  v_n := (extract(year from p_date)::int - extract(year from p_start)::int) * 12
       + (extract(month from p_date)::int - extract(month from p_start)::int);
  v_s := (p_start + make_interval(months => v_n))::date;
  if v_s > p_date then
    v_n := v_n - 1;
    v_s := (p_start + make_interval(months => v_n))::date;
  end if;
  number := v_n + 1;
  starts_on := v_s;
  ends_on := (p_start + make_interval(months => v_n + 1))::date - 1;
  return next;
end;
$$;

-- Data que ancora o ciclo: início do contrato; sem ele, o dia em que o cliente ficou ativo.
create or replace function private.cycle_anchor(p_client public.clients)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(p_client.contract_start,
                  (p_client.onboarding_completed_at at time zone 'America/Sao_Paulo')::date,
                  (p_client.created_at at time zone 'America/Sao_Paulo')::date);
$$;

-- Clientes ativos que já têm demandas: abre o mês atual sem recriar nada.
insert into public.client_months (client_id, number, starts_on, ends_on)
select c.id, cy.number, cy.starts_on, cy.ends_on
  from public.clients c
  cross join lateral private.cycle_of(private.cycle_anchor(c), (now() at time zone 'America/Sao_Paulo')::date) cy
 where c.status = 'ativo' and c.deleted_at is null
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Conteúdo de cada demanda do mês
-- -----------------------------------------------------------------------------
create table public.task_content (
  task_id       uuid primary key references public.tasks (id) on delete cascade,
  format        text check (format in ('video_curto', 'video_premium', 'reels', 'estatico', 'carrossel', 'stories', 'anuncio')),
  objective     text check (char_length(objective) <= 200),
  script        text check (char_length(script) <= 20000),
  caption       text check (char_length(caption) <= 5000),
  recorder_id   uuid references public.profiles (id) on delete set null,
  recording_on  date,
  editor_id     uuid references public.profiles (id) on delete set null,
  final_url     text check (char_length(final_url) <= 1000),
  raw_url       text check (char_length(raw_url) <= 1000),
  post_on       date,
  post_url      text check (char_length(post_url) <= 1000),
  destination   text[] not null default '{}' check (destination <@ array['cronograma', 'trafego', 'drive']),
  rework_count  int not null default 0 check (rework_count >= 0),
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);

create index task_content_editor_idx on public.task_content (editor_id) where editor_id is not null;
create index task_content_recorder_idx on public.task_content (recorder_id) where recorder_id is not null;

-- Fluxo: qual setor produz (quadro do setor) e qual etapa é retrabalho.
alter table public.workflows add column board_sector_id uuid references public.sectors (id) on delete set null;
alter table public.workflow_steps add column is_rework boolean not null default false;

update public.workflows w set board_sector_id = s.id
  from public.sectors s
 where s.organization_id = w.organization_id
   and ((w.task_type = 'video' and s.key = 'edicao') or (w.task_type = 'design' and s.key = 'design'));
update public.workflow_steps set is_rework = true where name = 'Ajustes';

-- Quem edita ou grava o conteúdo vê e move o card, mesmo quando a etapa atual é de outra pessoa.
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
        or exists (select 1 from public.task_content tc
                    where tc.task_id = t.id and (tc.editor_id = auth.uid() or tc.recorder_id = auth.uid()))
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

alter table public.task_content enable row level security;
create policy task_content_select on public.task_content for select to authenticated
  using ((select private.task_visible(task_id)));
revoke insert, update, delete on public.task_content from authenticated, anon;

-- Toda demanda do mês nasce com a linha de conteúdo (formato padrão pelo tipo).
create or replace function private.task_content_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slot_month is not null and new.type in ('video', 'design', 'conteudo') then
    insert into public.task_content (task_id, format)
    values (new.id, case new.type when 'video' then 'video_curto' when 'design' then 'estatico' else null end)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger tasks_content_seed after insert on public.tasks
  for each row execute function private.task_content_seed();

insert into public.task_content (task_id, format)
select t.id, case t.type when 'video' then 'video_curto' when 'design' then 'estatico' else null end
  from public.tasks t
 where t.slot_month is not null and t.type in ('video', 'design', 'conteudo')
on conflict do nothing;

-- Responsável da etapa considerando o conteúdo: etapa do setor que produz → quem edita;
-- etapa de gravação → quem grava. Senão, a regra do cliente (step_assignee).
create or replace function private.content_step_assignee(p_task uuid, p_step uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when tc.editor_id is not null and s.sector_id is not null and s.sector_id = w.board_sector_id then tc.editor_id
    when tc.recorder_id is not null and sec.key = 'gravacao' then tc.recorder_id
  end
  from public.workflow_steps s
  join public.workflows w on w.id = s.workflow_id
  left join public.sectors sec on sec.id = s.sector_id
  join public.task_content tc on tc.task_id = p_task
 where s.id = p_step;
$$;

revoke execute on function private.content_step_assignee(uuid, uuid) from public, anon, authenticated;

-- Mover card: igual à etapa 03, mais o responsável vindo do conteúdo e a contagem de retrabalho.
create or replace function public.move_task(p_task uuid, p_step uuid, p_column uuid, p_position double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_step public.workflow_steps;
  v_col public.board_columns;
  v_new_assignee uuid;
  v_client text;
begin
  if not private.can_task('tasks.manage', p_task) then
    raise exception 'Você não tem permissão para mover esta demanda.' using errcode = '42501';
  end if;
  select * into v_t from public.tasks where id = p_task for update;

  if p_column is not null then
    select * into v_col from public.board_columns where id = p_column and board_id = v_t.board_id;
    if v_col.id is null then raise exception 'Coluna inválida.' using errcode = 'P0001'; end if;
    update public.tasks set board_column_id = p_column, position = coalesce(p_position, position),
      status = case when v_col.is_done then 'concluido' else 'em_andamento' end,
      completed_at = case when v_col.is_done then now() else null end
     where id = p_task;
    if v_t.board_column_id is distinct from p_column then
      insert into public.task_activity (task_id, actor_id, kind, title) values (p_task, auth.uid(), 'move', 'Movido para ' || v_col.name);
    end if;
    return;
  end if;

  if p_step is null or p_step = v_t.workflow_step_id then
    update public.tasks set position = coalesce(p_position, position) where id = p_task;
    return;
  end if;

  select s.* into v_step from public.workflow_steps s join public.workflows w on w.id = s.workflow_id
   where s.id = p_step and w.organization_id = v_t.organization_id;
  if v_step.id is null then raise exception 'Etapa inválida.' using errcode = 'P0001'; end if;

  v_new_assignee := coalesce(
    private.content_step_assignee(p_task, p_step),
    case when v_t.client_id is not null then private.step_assignee(v_t.client_id, p_step) end,
    v_t.assignee_id);

  update public.task_stage_history set left_at = now() where task_id = p_task and left_at is null;
  insert into public.task_stage_history (task_id, step_id, step_name, assignee_id, moved_by)
  values (p_task, p_step, v_step.name, v_new_assignee, auth.uid());

  update public.tasks
     set workflow_step_id = p_step, status = v_step.status, assignee_id = v_new_assignee,
         sector_id = coalesce(v_step.sector_id, sector_id), position = coalesce(p_position, position),
         completed_at = case when v_step.status = 'concluido' then now() else null end
   where id = p_task;

  if v_step.is_rework then
    insert into public.task_content (task_id, rework_count) values (p_task, 1)
    on conflict (task_id) do update set rework_count = public.task_content.rework_count + 1;
  end if;

  insert into public.task_activity (task_id, actor_id, kind, title)
  values (p_task, auth.uid(), 'move', 'Etapa: ' || v_step.name || case when v_step.is_rework then ' (em alteração)' else '' end);

  select name into v_client from public.clients where id = v_t.client_id;
  perform public.notify_users(
    array_remove(array[v_new_assignee, v_t.assignee_id, v_t.created_by], null), 'stage_changed',
    v_t.title || ' → ' || v_step.name,
    case when v_new_assignee is distinct from v_t.assignee_id then 'Agora com ' || coalesce((select full_name from public.profiles where id = v_new_assignee), 'ninguém') else null end
      || coalesce(' · ' || v_client, ''),
    '/tarefas/' || p_task, 'task:' || p_task || ':step:' || p_step || ':' || extract(epoch from now())::bigint, auth.uid());
end;
$$;

-- Salvar os campos do conteúdo. Só as chaves presentes em p são alteradas.
-- Definir quem edita/grava exige tasks.assign; o resto, tasks.manage.
create or replace function public.save_content(p_task uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_old public.task_content;
  v_new public.task_content;
  v_board_sector uuid;
  v_sector_key text;
  v_step_sector uuid;
  v_step_sector_key text;
  v_client text;
  v_url text;
begin
  if not private.can_task('tasks.manage', p_task) then
    raise exception 'Você não tem permissão para editar este conteúdo.' using errcode = '42501';
  end if;
  if (p ? 'editor_id' or p ? 'recorder_id') and not private.can_task('tasks.assign', p_task) then
    raise exception 'Você não tem permissão para definir quem grava ou edita.' using errcode = '42501';
  end if;
  select * into v_t from public.tasks where id = p_task and deleted_at is null for update;
  if v_t.id is null then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;

  foreach v_url in array array[p ->> 'final_url', p ->> 'raw_url', p ->> 'post_url'] loop
    if v_url is not null and v_url <> '' and v_url !~* '^https?://' then
      raise exception 'Os links precisam começar com http:// ou https://.' using errcode = 'P0001';
    end if;
  end loop;
  if exists (
    select 1 from (values (nullif(p ->> 'editor_id', '')::uuid), (nullif(p ->> 'recorder_id', '')::uuid)) v(id)
     where v.id is not null and not exists (
       select 1 from public.profiles pr where pr.id = v.id and pr.organization_id = v_t.organization_id and pr.is_active)
  ) then
    raise exception 'Pessoa não encontrada ou sem acesso ao sistema.' using errcode = 'P0001';
  end if;

  select * into v_old from public.task_content where task_id = p_task;
  insert into public.task_content (task_id) values (p_task) on conflict do nothing;

  update public.task_content set
    format       = case when p ? 'format' then nullif(p ->> 'format', '') else format end,
    objective    = case when p ? 'objective' then nullif(btrim(p ->> 'objective'), '') else objective end,
    script       = case when p ? 'script' then nullif(p ->> 'script', '') else script end,
    caption      = case when p ? 'caption' then nullif(p ->> 'caption', '') else caption end,
    recorder_id  = case when p ? 'recorder_id' then nullif(p ->> 'recorder_id', '')::uuid else recorder_id end,
    recording_on = case when p ? 'recording_on' then nullif(p ->> 'recording_on', '')::date else recording_on end,
    editor_id    = case when p ? 'editor_id' then nullif(p ->> 'editor_id', '')::uuid else editor_id end,
    final_url    = case when p ? 'final_url' then nullif(btrim(p ->> 'final_url'), '') else final_url end,
    raw_url      = case when p ? 'raw_url' then nullif(btrim(p ->> 'raw_url'), '') else raw_url end,
    post_on      = case when p ? 'post_on' then nullif(p ->> 'post_on', '')::date else post_on end,
    post_url     = case when p ? 'post_url' then nullif(btrim(p ->> 'post_url'), '') else post_url end,
    destination  = case when p ? 'destination' then coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'destination') x), '{}') else destination end,
    updated_by   = auth.uid(),
    updated_at   = now()
  where task_id = p_task
  returning * into v_new;

  if p ? 'title' and char_length(btrim(p ->> 'title')) >= 2 then
    update public.tasks set title = left(btrim(p ->> 'title'), 200) where id = p_task and title is distinct from left(btrim(p ->> 'title'), 200);
  end if;
  if p ? 'due_at' then
    update public.tasks set due_at = nullif(p ->> 'due_at', '')::timestamptz where id = p_task and due_at is distinct from nullif(p ->> 'due_at', '')::timestamptz;
  end if;

  select w.board_sector_id, bs.key, s.sector_id, ss.key
    into v_board_sector, v_sector_key, v_step_sector, v_step_sector_key
    from public.workflow_steps s
    join public.workflows w on w.id = s.workflow_id
    left join public.sectors bs on bs.id = w.board_sector_id
    left join public.sectors ss on ss.id = s.sector_id
   where s.id = v_t.workflow_step_id;
  select name into v_client from public.clients where id = v_t.client_id;

  -- Quem edita mudou.
  if v_new.editor_id is distinct from v_old.editor_id and v_new.editor_id is not null then
    if v_step_sector is not null and v_step_sector = v_board_sector then
      -- O card já está na etapa do setor: passa para a pessoa (o gatilho da tarefa avisa).
      update public.tasks set assignee_id = v_new.editor_id where id = p_task and assignee_id is distinct from v_new.editor_id;
    else
      perform public.notify_users(array[v_new.editor_id], 'assigned',
        'Novo conteúdo no seu quadro: ' || v_t.title, v_client,
        case when v_sector_key is not null then '/setores/' || v_sector_key || '?visao=quadro' else '/tarefas/' || p_task end,
        'content:' || p_task || ':editor:' || v_new.editor_id, auth.uid());
    end if;
    insert into public.task_activity (task_id, actor_id, kind, title)
    values (p_task, auth.uid(), 'assignee', 'Edição/criação com ' || (select full_name from public.profiles where id = v_new.editor_id));
  end if;

  -- Quem grava mudou.
  if v_new.recorder_id is distinct from v_old.recorder_id and v_new.recorder_id is not null then
    if v_step_sector_key = 'gravacao' then
      update public.tasks set assignee_id = v_new.recorder_id where id = p_task and assignee_id is distinct from v_new.recorder_id;
    else
      perform public.notify_users(array[v_new.recorder_id], 'assigned',
        'Gravação com você: ' || v_t.title,
        coalesce(v_client, '') || coalesce(' · ' || to_char(v_new.recording_on, 'DD/MM/YYYY'), ''),
        '/tarefas/' || p_task, 'content:' || p_task || ':recorder:' || v_new.recorder_id, auth.uid());
    end if;
    insert into public.task_activity (task_id, actor_id, kind, title)
    values (p_task, auth.uid(), 'assignee', 'Gravação com ' || (select full_name from public.profiles where id = v_new.recorder_id));
  end if;

  -- Toca a tarefa para os quadros abertos atualizarem em tempo real.
  update public.tasks set updated_at = now() where id = p_task;
end;
$$;

grant execute on function public.save_content(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Demandas do mês pelo ciclo do cliente
-- -----------------------------------------------------------------------------
create or replace function private.generate_slots(p_client uuid, p_month date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_cycle record;
  v_days int;
  v_svc record;
  v_count int := 0;
  v_n int;
  v_assignee uuid;
  v_label text;
  v_period text;
  v_new uuid[] := '{}';
  v_id uuid;
  v_got uuid;
begin
  select * into v_client from public.clients where id = p_client and deleted_at is null;
  if v_client.id is null or v_client.status <> 'ativo' then
    return 0;
  end if;
  select * into v_cycle from private.cycle_of(private.cycle_anchor(v_client), p_month);
  if v_cycle.number is null then return 0; end if;
  if v_client.contract_end is not null and v_client.contract_end < v_cycle.starts_on then return 0; end if;

  insert into public.client_months (client_id, number, starts_on, ends_on)
  values (p_client, v_cycle.number, v_cycle.starts_on, v_cycle.ends_on)
  on conflict do nothing;

  v_days := v_cycle.ends_on - v_cycle.starts_on + 1;
  v_period := 'mês ' || v_cycle.number || ' (' || to_char(v_cycle.starts_on, 'DD/MM') || ' a ' || to_char(v_cycle.ends_on + 1, 'DD/MM') || ')';

  for v_svc in
    select cs.id as cs_id, cs.monthly_qty, sc.id as service_id, sc.task_type, sc.sector_id, sc.unit, sc.name
    from public.client_services cs
    join public.service_catalog sc on sc.id = cs.service_id
    where cs.client_id = p_client
      and cs.monthly_qty > 0
      and sc.task_type is not null
      and cs.starts_on <= v_cycle.ends_on
      and (cs.ends_on is null or cs.ends_on >= v_cycle.starts_on)
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
      v_id := null;
      v_got := null;
      insert into public.tasks (organization_id, client_id, service_id, sector_id, type, title, status, assignee_id,
                                due_at, slot_month, slot_index, slot_total)
      values (v_client.organization_id, p_client, v_svc.service_id, v_svc.sector_id, v_svc.task_type,
              v_label || ' ' || v_n || '/' || v_svc.monthly_qty || ' – ' || v_period,
              'pendente', v_assignee,
              ((v_cycle.starts_on + (ceil(v_n::numeric * v_days / v_svc.monthly_qty)::int - 1)) + time '18:00') at time zone 'America/Sao_Paulo',
              v_cycle.starts_on, v_n, v_svc.monthly_qty)
      on conflict (client_id, service_id, slot_month, slot_index) where slot_month is not null do nothing
      returning id, assignee_id into v_id, v_got;
      if v_id is not null then
        v_count := v_count + 1;
        if v_got is not null then v_new := array_append(v_new, v_got); end if;
      end if;
    end loop;
  end loop;

  if v_count > 0 then
    perform private.timeline(p_client, 'slots', v_count || ' demanda(s) do ' || v_period || ' criada(s)',
      jsonb_build_object('month', v_cycle.starts_on, 'number', v_cycle.number, 'count', v_count));
    if array_length(v_new, 1) > 0 then
      perform public.notify_users(
        (select array_agg(distinct x) from unnest(v_new) x), 'assigned',
        'Novas demandas de ' || v_client.name,
        'As demandas do ' || v_period || ' foram criadas e atribuídas a você.',
        '/tarefas', 'slots:' || p_client || ':' || v_cycle.starts_on, auth.uid());
    end if;
  end if;
  return v_count;
end;
$$;

revoke execute on function private.generate_slots(uuid, date) from public, anon, authenticated;

-- Job diário: abre o mês novo de cada cliente no dia de virada dele. Idempotente.
create or replace function private.monthly_slots_tick(p_month date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date);
  v_total int := 0;
  v_c record;
begin
  for v_c in select id from public.clients where status = 'ativo' and deleted_at is null loop
    v_total := v_total + private.generate_slots(v_c.id, v_day);
  end loop;
  return v_total;
end;
$$;

revoke execute on function private.monthly_slots_tick(date) from public, anon, authenticated;

select cron.unschedule('extend-slots-mensais');
select cron.schedule('extend-slots-mensais', '10 3 * * *', $$select private.monthly_slots_tick()$$);

-- Alterar serviço de cliente ativo: vale a partir do próximo mês DO CLIENTE.
create or replace function public.set_client_service(p_client uuid, p_service uuid, p_qty int, p_price_cents bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_cur public.client_services;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_next date;
  v_name text;
begin
  if not private.can_manage_client(p_client) then
    raise exception 'Você não tem permissão para alterar os serviços deste cliente.' using errcode = '42501';
  end if;
  select * into v_client from public.clients where id = p_client;
  select name into v_name from public.service_catalog where id = p_service and organization_id = v_client.organization_id;
  if v_name is null then raise exception 'Serviço não encontrado.' using errcode = 'P0002'; end if;
  if p_qty is not null and (p_qty < 0 or p_qty > 200) then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;

  select cy.ends_on + 1 into v_next from private.cycle_of(private.cycle_anchor(v_client), v_today) cy;
  v_next := coalesce(v_next, v_today);

  select * into v_cur from public.client_services
   where client_id = p_client and service_id = p_service and (ends_on is null or ends_on >= current_date)
   order by starts_on desc limit 1;

  if v_client.status = 'onboarding' then
    if p_qty is null then
      delete from public.client_services where id = v_cur.id;
    elsif v_cur.id is null then
      insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
      values (p_client, p_service, p_qty, p_price_cents, coalesce(v_client.contract_start, current_date));
    else
      update public.client_services set monthly_qty = p_qty, price_cents = p_price_cents where id = v_cur.id;
    end if;
  else
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
    || case when v_client.status = 'onboarding' then '' else ' (a partir de ' || to_char(v_next, 'DD/MM/YYYY') || ')' end,
    jsonb_build_object('service_id', p_service, 'qty', p_qty));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Relatório de produção: coordenação de conteúdo também vê
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'dashboards.read', 'all' from public.roles r where r.key = 'coord_conteudo'
on conflict do nothing;
