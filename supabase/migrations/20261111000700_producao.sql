-- =============================================================================
-- Etapa 03 · Produção: fluxos, quadros, cards, comentários, tempo, agenda
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fluxos por tipo de demanda (RF-TAR-03)
-- -----------------------------------------------------------------------------
create table public.workflows (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  task_type        text not null check (task_type in ('video', 'design', 'conteudo', 'gravacao', 'site', 'criativo', 'roteiro', 'post', 'geral')),
  name             text not null check (char_length(name) between 2 and 80),
  created_at       timestamptz not null default now(),
  unique (organization_id, task_type)
);

create table public.workflow_steps (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references public.workflows (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  position      int not null,
  sector_id     uuid references public.sectors (id) on delete set null,
  status        text not null default 'em_andamento' check (status in ('pendente', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'concluido')),
  waits_client  boolean not null default false,
  color         text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index workflow_steps_wf_idx on public.workflow_steps (workflow_id, position);

do $$
declare
  v_org uuid;
  v_wf uuid;
  v_def record;
  v_step record;
  v_pos int;
begin
  for v_org in select id from public.organizations loop
    for v_def in select * from (values
      ('video', 'Vídeo', array[
        'Briefing|conteudo|pendente|f|#64748B', 'Roteiro|conteudo|em_andamento|f|#8B5CF6', 'Aprovação do roteiro|conteudo|aguardando_aprovacao|t|#F59E0B',
        'Gravação|gravacao|em_andamento|f|#F97316', 'Edição|edicao|em_andamento|f|#EF4444', 'Revisão interna|conteudo|aguardando_aprovacao|f|#EAB308',
        'Aprovação do cliente|conteudo|aguardando_aprovacao|t|#F59E0B', 'Ajustes|edicao|em_andamento|f|#EC4899', 'Programado|gerenciamento|aprovado|f|#14B8A6',
        'Publicado|gerenciamento|concluido|f|#22C55E']),
      ('design', 'Design', array[
        'Briefing|conteudo|pendente|f|#64748B', 'Criação|design|em_andamento|f|#8B5CF6', 'Revisão interna|conteudo|aguardando_aprovacao|f|#EAB308',
        'Aprovação do cliente|conteudo|aguardando_aprovacao|t|#F59E0B', 'Ajustes|design|em_andamento|f|#EC4899', 'Programado|gerenciamento|aprovado|f|#14B8A6',
        'Publicado|gerenciamento|concluido|f|#22C55E']),
      ('conteudo', 'Post', array[
        'Pauta|conteudo|pendente|f|#64748B', 'Criação|design|em_andamento|f|#8B5CF6', 'Revisão interna|conteudo|aguardando_aprovacao|f|#EAB308',
        'Aprovação do cliente|gerenciamento|aguardando_aprovacao|t|#F59E0B', 'Programado|gerenciamento|aprovado|f|#14B8A6', 'Publicado|gerenciamento|concluido|f|#22C55E']),
      ('gravacao', 'Gravação', array['A agendar|gravacao|pendente|f|#64748B', 'Agendada|gravacao|em_andamento|f|#F97316', 'Gravada|gravacao|concluido|f|#22C55E']),
      ('site', 'Site', array[
        'Briefing|sites|pendente|f|#64748B', 'Desenvolvimento|sites|em_andamento|f|#0EA5E9', 'Revisão interna|sites|aguardando_aprovacao|f|#EAB308',
        'Aprovação do cliente|sites|aguardando_aprovacao|t|#F59E0B', 'Publicado|sites|concluido|f|#22C55E']),
      ('geral', 'Geral', array['A fazer||pendente|f|#64748B', 'Fazendo||em_andamento|f|#1D8AE6', 'Feito||concluido|f|#22C55E'])
    ) as d(task_type, name, steps) loop
      insert into public.workflows (organization_id, task_type, name) values (v_org, v_def.task_type, v_def.name) returning id into v_wf;
      v_pos := 0;
      for v_step in select split_part(s, '|', 1) as n, split_part(s, '|', 2) as sec, split_part(s, '|', 3) as st,
                           split_part(s, '|', 4) = 't' as wc, split_part(s, '|', 5) as color
                    from unnest(v_def.steps) s loop
        v_pos := v_pos + 1;
        insert into public.workflow_steps (workflow_id, name, position, sector_id, status, waits_client, color)
        values (v_wf, v_step.n, v_pos, (select id from public.sectors where organization_id = v_org and key = nullif(v_step.sec, '')),
                v_step.st, v_step.wc, v_step.color);
      end loop;
    end loop;
  end loop;
end $$;

-- Responsável padrão por etapa, por cliente (sobrepõe o "responsável do setor").
create table public.client_step_defaults (
  client_id   uuid not null references public.clients (id) on delete cascade,
  step_id     uuid not null references public.workflow_steps (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (client_id, step_id)
);

-- -----------------------------------------------------------------------------
-- Quadros livres (colunas próprias); quadros de cliente/setor usam as etapas
-- -----------------------------------------------------------------------------
create table public.boards (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 80),
  sector_id        uuid references public.sectors (id) on delete set null,
  client_id        uuid references public.clients (id) on delete cascade,
  created_by       uuid references public.profiles (id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  position    int not null default 0,
  color       text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_done     boolean not null default false
);

create index board_columns_board_idx on public.board_columns (board_id, position);

-- -----------------------------------------------------------------------------
-- Tarefas: campos de produção
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column workflow_step_id  uuid references public.workflow_steps (id) on delete set null,
  add column board_id          uuid references public.boards (id) on delete set null,
  add column board_column_id   uuid references public.board_columns (id) on delete set null,
  add column position          double precision not null default 0,
  add column blocked_by_task_id uuid references public.tasks (id) on delete set null,
  add column waiting_note      text check (char_length(waiting_note) <= 300),
  add column start_at          timestamptz;

create index tasks_step_idx on public.tasks (workflow_step_id) where deleted_at is null;
create index tasks_board_idx on public.tasks (board_id) where deleted_at is null;

create table public.task_participants (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, profile_id)
);

create index task_participants_profile_idx on public.task_participants (profile_id);

create table public.tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 40),
  color            text not null default '#1D8AE6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at       timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.task_tags (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create table public.task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  done_at     timestamptz,
  done_by     uuid references public.profiles (id) on delete set null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index task_checklist_task_idx on public.task_checklist_items (task_id, position);

create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  kind          text not null check (kind in ('arquivo', 'link')),
  name          text not null check (char_length(name) between 1 and 200),
  storage_path  text unique,
  url           text check (char_length(url) <= 1000),
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check ((kind = 'arquivo' and storage_path is not null) or (kind = 'link' and url is not null))
);

create index task_attachments_task_idx on public.task_attachments (task_id);

create table public.task_stage_history (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  step_id      uuid references public.workflow_steps (id) on delete set null,
  step_name    text not null,
  assignee_id  uuid references public.profiles (id) on delete set null,
  entered_at   timestamptz not null default now(),
  left_at      timestamptz,
  moved_by     uuid references public.profiles (id) on delete set null
);

create index task_stage_history_task_idx on public.task_stage_history (task_id, entered_at);

create table public.task_time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  profile_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

create unique index task_time_running_uq on public.task_time_entries (profile_id) where ended_at is null;
create index task_time_task_idx on public.task_time_entries (task_id);
create index task_time_profile_idx on public.task_time_entries (profile_id, started_at desc);

-- Atividade do card (histórico de alterações legível).
create table public.task_activity (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null,
  title       text not null check (char_length(title) <= 300),
  created_at  timestamptz not null default now()
);

create index task_activity_task_idx on public.task_activity (task_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Agenda (RF-AGE)
-- -----------------------------------------------------------------------------
create table public.calendar_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 160),
  kind             text not null default 'evento' check (kind in ('gravacao', 'reuniao', 'evento', 'bloqueio')),
  sector_id        uuid references public.sectors (id) on delete set null,
  client_id        uuid references public.clients (id) on delete cascade,
  task_id          uuid references public.tasks (id) on delete set null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  location         text check (char_length(location) <= 300),
  link             text check (char_length(link) <= 500),
  notes            text check (char_length(notes) <= 4000),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index calendar_events_range_idx on public.calendar_events (organization_id, starts_at);
create index calendar_events_task_idx on public.calendar_events (task_id) where task_id is not null;

create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function private.set_updated_at();

create table public.calendar_attendees (
  event_id    uuid not null references public.calendar_events (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, profile_id)
);

create index calendar_attendees_profile_idx on public.calendar_attendees (profile_id);

-- -----------------------------------------------------------------------------
-- Regras de fluxo
-- -----------------------------------------------------------------------------
create or replace function private.first_step(p_org uuid, p_type text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id
   where w.organization_id = p_org and w.task_type = p_type and s.archived_at is null
   order by s.position limit 1;
$$;

-- Responsável da etapa no cliente: padrão do cliente para a etapa → pessoa marcada no setor da etapa.
create or replace function private.step_assignee(p_client uuid, p_step uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select d.profile_id from public.client_step_defaults d join public.profiles p on p.id = d.profile_id and p.is_active
      where d.client_id = p_client and d.step_id = p_step),
    (select m.profile_id from public.client_members m
       join public.workflow_steps s on s.id = p_step and s.sector_id = m.sector_id
       join public.profiles p on p.id = m.profile_id and p.is_active
      where m.client_id = p_client order by m.is_default desc, m.created_at limit 1)
  );
$$;

-- Novo card com tipo que tem fluxo: entra na primeira etapa e abre o histórico.
create or replace function private.task_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step public.workflow_steps;
begin
  if new.workflow_step_id is null and new.board_id is null then
    new.workflow_step_id := private.first_step(new.organization_id, new.type);
  end if;
  if new.workflow_step_id is not null then
    select * into v_step from public.workflow_steps where id = new.workflow_step_id;
    new.status := v_step.status;
    if new.assignee_id is null and new.client_id is not null then
      new.assignee_id := private.step_assignee(new.client_id, new.workflow_step_id);
    end if;
    if new.sector_id is null then new.sector_id := v_step.sector_id; end if;
  end if;
  if new.position = 0 then new.position := extract(epoch from now()); end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger tasks_before_insert before insert on public.tasks
  for each row execute function private.task_before_insert();

create or replace function private.task_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workflow_step_id is not null then
    insert into public.task_stage_history (task_id, step_id, step_name, assignee_id, moved_by)
    select new.id, s.id, s.name, new.assignee_id, auth.uid() from public.workflow_steps s where s.id = new.workflow_step_id;
  end if;
  insert into public.task_activity (task_id, actor_id, kind, title) values (new.id, auth.uid(), 'created', 'Card criado');
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid() and new.slot_month is null then
    perform public.notify_users(array[new.assignee_id], 'assigned', 'Nova demanda: ' || new.title, null,
      '/tarefas/' || new.id, 'task:' || new.id || ':assigned:' || new.assignee_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger tasks_after_insert after insert on public.tasks
  for each row execute function private.task_after_insert();

-- Troca de responsável (fora da troca de etapa) avisa a pessoa nova.
create or replace function private.task_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is distinct from old.assignee_id and new.workflow_step_id is not distinct from old.workflow_step_id then
    insert into public.task_activity (task_id, actor_id, kind, title)
    values (new.id, auth.uid(), 'assignee', 'Responsável alterado para ' || coalesce((select full_name from public.profiles where id = new.assignee_id), 'ninguém'));
    if new.assignee_id is not null then
      perform public.notify_users(array[new.assignee_id], 'assigned', 'Demanda atribuída a você: ' || new.title, null,
        '/tarefas/' || new.id, 'task:' || new.id || ':assigned:' || new.assignee_id || ':' || extract(epoch from now())::bigint, auth.uid());
    end if;
    update public.task_stage_history set assignee_id = new.assignee_id where task_id = new.id and left_at is null;
  end if;
  if new.due_at is distinct from old.due_at then
    insert into public.task_activity (task_id, actor_id, kind, title)
    values (new.id, auth.uid(), 'due', case when new.due_at is null then 'Prazo removido'
      else 'Prazo: ' || to_char(new.due_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') end);
  end if;
  if new.status is distinct from old.status and new.workflow_step_id is not distinct from old.workflow_step_id then
    insert into public.task_activity (task_id, actor_id, kind, title) values (new.id, auth.uid(), 'status', 'Status: ' || new.status);
  end if;
  return new;
end;
$$;

create trigger tasks_after_update after update on public.tasks
  for each row execute function private.task_after_update();

-- Mover card: etapa (fluxo) ou coluna (quadro livre). Troca o responsável e avisa (RF-TAR-03/04).
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

  v_new_assignee := case when v_t.client_id is not null then private.step_assignee(v_t.client_id, p_step) end;
  v_new_assignee := coalesce(v_new_assignee, v_t.assignee_id);

  update public.task_stage_history set left_at = now() where task_id = p_task and left_at is null;
  insert into public.task_stage_history (task_id, step_id, step_name, assignee_id, moved_by)
  values (p_task, p_step, v_step.name, v_new_assignee, auth.uid());

  update public.tasks
     set workflow_step_id = p_step, status = v_step.status, assignee_id = v_new_assignee,
         sector_id = coalesce(v_step.sector_id, sector_id), position = coalesce(p_position, position),
         completed_at = case when v_step.status = 'concluido' then now() else null end
   where id = p_task;

  insert into public.task_activity (task_id, actor_id, kind, title) values (p_task, auth.uid(), 'move', 'Etapa: ' || v_step.name);

  select name into v_client from public.clients where id = v_t.client_id;
  perform public.notify_users(
    array_remove(array[v_new_assignee, v_t.assignee_id, v_t.created_by], null), 'stage_changed',
    v_t.title || ' → ' || v_step.name,
    case when v_new_assignee is distinct from v_t.assignee_id then 'Agora com ' || coalesce((select full_name from public.profiles where id = v_new_assignee), 'ninguém') else null end
      || coalesce(' · ' || v_client, ''),
    '/tarefas/' || p_task, 'task:' || p_task || ':step:' || p_step || ':' || extract(epoch from now())::bigint, auth.uid());
end;
$$;

grant execute on function public.move_task(uuid, uuid, uuid, double precision) to authenticated;

-- Tempo: iniciar/pausar (um cronômetro por pessoa).
create or replace function public.start_timer(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_task('tasks.read', p_task) then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  update public.task_time_entries set ended_at = now() where profile_id = auth.uid() and ended_at is null;
  insert into public.task_time_entries (task_id, profile_id) values (p_task, auth.uid());
  update public.tasks set start_at = coalesce(start_at, now()), status = case when status = 'pendente' then 'em_andamento' else status end where id = p_task;
end;
$$;

create or replace function public.stop_timer()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.task_time_entries set ended_at = now() where profile_id = auth.uid() and ended_at is null;
$$;

grant execute on function public.start_timer(uuid), public.stop_timer() to authenticated;

-- Comentário com @menção: avisa mencionados, responsável e participantes.
create or replace function private.on_task_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_author text;
begin
  select * into v_t from public.tasks where id = new.task_id;
  select full_name into v_author from public.profiles where id = new.author_id;
  if array_length(new.mentions, 1) > 0 then
    perform public.notify_users(new.mentions, 'comment', v_author || ' mencionou você em ' || v_t.title, left(new.body, 200),
      '/tarefas/' || new.task_id, 'comment:' || new.id || ':mention', new.author_id);
  end if;
  perform public.notify_users(
    array(select x from unnest(array_remove(array[v_t.assignee_id, v_t.created_by], null)
          || coalesce((select array_agg(profile_id) from public.task_participants where task_id = new.task_id), '{}')) x
          where not (x = any (new.mentions))),
    'comment', v_author || ' comentou em ' || v_t.title, left(new.body, 200),
    '/tarefas/' || new.task_id, 'comment:' || new.id, new.author_id);
  insert into public.task_activity (task_id, actor_id, kind, title) values (new.task_id, new.author_id, 'comment', 'Comentou');
  return new;
end;
$$;

create trigger task_comments_notify after insert on public.task_comments
  for each row execute function private.on_task_comment();

-- Evento da agenda: avisa os participantes.
create or replace function private.on_attendee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.calendar_events;
begin
  select * into v_e from public.calendar_events where id = new.event_id;
  perform public.notify_users(array[new.profile_id], 'assigned',
    case v_e.kind when 'gravacao' then 'Gravação agendada: ' when 'reuniao' then 'Reunião: ' else 'Evento: ' end || v_e.title,
    to_char(v_e.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || coalesce(' · ' || v_e.location, ''),
    '/agenda?data=' || to_char(v_e.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'event:' || v_e.id || ':' || new.profile_id, auth.uid());
  return new;
end;
$$;

create trigger calendar_attendees_notify after insert on public.calendar_attendees
  for each row execute function private.on_attendee();

-- Prazos: 24 h antes e atraso (deduplicado por card).
create or replace function private.tasks_due_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_count int := 0;
  v_coord uuid[];
begin
  for v_t in
    select t.*, c.name as client_name
      from public.tasks t left join public.clients c on c.id = t.client_id
     where t.deleted_at is null and t.due_at is not null and t.assignee_id is not null
       and t.status not in ('concluido', 'aprovado', 'cancelado')
       and t.due_at < now() + interval '24 hours'
  loop
    if v_t.due_at >= now() then
      v_count := v_count + public.notify_users(array[v_t.assignee_id], 'due_soon', 'Prazo em menos de 24 h: ' || v_t.title,
        coalesce(v_t.client_name, ''), '/tarefas/' || v_t.id, 'task:' || v_t.id || ':soon', null);
    else
      -- Atrasou: avisa o responsável e a coordenação do setor (líderes do setor).
      select array_agg(ps.profile_id) into v_coord from public.profile_sectors ps where ps.sector_id = v_t.sector_id and ps.is_lead;
      v_count := v_count + public.notify_users(array[v_t.assignee_id] || coalesce(v_coord, '{}'), 'overdue', 'Atrasada: ' || v_t.title,
        coalesce(v_t.client_name, ''), '/tarefas/' || v_t.id, 'task:' || v_t.id || ':late', null);
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.tasks_due_tick(), private.first_step(uuid, text), private.step_assignee(uuid, uuid) from public, anon, authenticated;

select cron.schedule('extend-prazos-tarefas', '*/15 * * * *', $$select private.tasks_due_tick()$$);

-- Slots já criados (etapa 02) entram no fluxo.
update public.tasks t
   set workflow_step_id = private.first_step(t.organization_id, t.type)
 where t.workflow_step_id is null and t.board_id is null and t.deleted_at is null;
insert into public.task_stage_history (task_id, step_id, step_name, assignee_id)
select t.id, s.id, s.name, t.assignee_id from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id
 where not exists (select 1 from public.task_stage_history h where h.task_id = t.id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.workflows enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.client_step_defaults enable row level security;
alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.task_participants enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_stage_history enable row level security;
alter table public.task_time_entries enable row level security;
alter table public.task_activity enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_attendees enable row level security;

create policy workflows_select on public.workflows for select to authenticated using (organization_id = (select private.org_id()));
create policy workflows_write on public.workflows for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')));
create policy workflow_steps_select on public.workflow_steps for select to authenticated
  using (exists (select 1 from public.workflows w where w.id = workflow_id and w.organization_id = (select private.org_id())));
create policy workflow_steps_write on public.workflow_steps for all to authenticated
  using ((select private.has_perm('tasks.boards.configure')) and exists (select 1 from public.workflows w where w.id = workflow_id and w.organization_id = (select private.org_id())))
  with check ((select private.has_perm('tasks.boards.configure')) and exists (select 1 from public.workflows w where w.id = workflow_id and w.organization_id = (select private.org_id())));

create policy client_step_defaults_select on public.client_step_defaults for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_step_defaults_write on public.client_step_defaults for all to authenticated
  using ((select private.can_manage_client(client_id)) or (select private.can_client('tasks.assign', client_id)))
  with check ((select private.can_manage_client(client_id)) or (select private.can_client('tasks.assign', client_id)));

create policy boards_select on public.boards for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tasks.read'))
         and (client_id is null or (select private.can_client('clients.read', client_id))));
create policy boards_write on public.boards for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')));
create policy board_columns_select on public.board_columns for select to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id));
create policy board_columns_write on public.board_columns for all to authenticated
  using ((select private.has_perm('tasks.boards.configure')) and exists (select 1 from public.boards b where b.id = board_id))
  with check ((select private.has_perm('tasks.boards.configure')) and exists (select 1 from public.boards b where b.id = board_id));

-- Tarefa: participante também vê.
drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (organization_id = (select private.org_id()) and deleted_at is null
         and ((select private.can_task('tasks.read', id))
              or exists (select 1 from public.task_participants tp where tp.task_id = id and tp.profile_id = (select auth.uid()))));

-- Filhas da tarefa: herdam a leitura da tarefa.
create or replace function private.task_visible(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_task('tasks.read', p_task)
      or exists (select 1 from public.task_participants tp where tp.task_id = p_task and tp.profile_id = auth.uid());
$$;

grant execute on function private.task_visible(uuid) to authenticated;

create policy task_participants_select on public.task_participants for select to authenticated using ((select private.task_visible(task_id)));
create policy task_participants_write on public.task_participants for all to authenticated
  using ((select private.can_task('tasks.manage', task_id))) with check ((select private.can_task('tasks.manage', task_id)));

create policy tags_select on public.tags for select to authenticated using (organization_id = (select private.org_id()));
create policy tags_insert on public.tags for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.manage')));
create policy tags_write on public.tags for update to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tags.manage')));
create policy tags_delete on public.tags for delete to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tags.manage')));

create policy task_tags_select on public.task_tags for select to authenticated using ((select private.task_visible(task_id)));
create policy task_tags_write on public.task_tags for all to authenticated
  using ((select private.can_task('tasks.manage', task_id))) with check ((select private.can_task('tasks.manage', task_id)));

create policy task_checklist_select on public.task_checklist_items for select to authenticated using ((select private.task_visible(task_id)));
create policy task_checklist_write on public.task_checklist_items for all to authenticated
  using ((select private.can_task('tasks.manage', task_id))) with check ((select private.can_task('tasks.manage', task_id)));

create policy task_comments_select on public.task_comments for select to authenticated using ((select private.task_visible(task_id)));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check ((select private.task_visible(task_id)) and author_id = (select auth.uid()));
create policy task_comments_update on public.task_comments for update to authenticated using (author_id = (select auth.uid()));
create policy task_comments_delete on public.task_comments for delete to authenticated using (author_id = (select auth.uid()));

create policy task_attachments_select on public.task_attachments for select to authenticated using ((select private.task_visible(task_id)));
create policy task_attachments_insert on public.task_attachments for insert to authenticated
  with check ((select private.task_visible(task_id)) and uploaded_by = (select auth.uid()));
create policy task_attachments_delete on public.task_attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.can_task('tasks.manage', task_id)));

create policy task_stage_history_select on public.task_stage_history for select to authenticated using ((select private.task_visible(task_id)));
revoke insert, update, delete on public.task_stage_history from authenticated;

create policy task_time_select on public.task_time_entries for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.task_visible(task_id)));
create policy task_time_update on public.task_time_entries for update to authenticated using (profile_id = (select auth.uid()));
create policy task_time_delete on public.task_time_entries for delete to authenticated using (profile_id = (select auth.uid()));
revoke insert on public.task_time_entries from authenticated;

create policy task_activity_select on public.task_activity for select to authenticated using ((select private.task_visible(task_id)));
revoke insert, update, delete on public.task_activity from authenticated;

-- Agenda: participante, criador, ou permissão de agenda (setor/todos).
create or replace function private.can_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_events e
     where e.id = p_event and e.organization_id = private.org_id()
       and (e.created_by = auth.uid()
            or exists (select 1 from public.calendar_attendees a where a.event_id = e.id and a.profile_id = auth.uid())
            or case private.perm_scope('calendar.read')
                 when 'all' then true
                 when 'sector' then e.sector_id is not null and private.in_my_sector(e.sector_id)
                 when 'clients' then e.client_id is not null and private.is_client_member(e.client_id)
                 else false end)
  );
$$;

grant execute on function private.can_event(uuid) to authenticated;

create policy calendar_events_select on public.calendar_events for select to authenticated using ((select private.can_event(id)));
create policy calendar_events_insert on public.calendar_events for insert to authenticated
  with check (organization_id = (select private.org_id()) and (select private.has_perm('calendar.manage')) and created_by = (select auth.uid()));
create policy calendar_events_update on public.calendar_events for update to authenticated
  using (created_by = (select auth.uid()) or (select private.perm_scope('calendar.manage')) = 'all'
         or ((select private.perm_scope('calendar.manage')) = 'sector' and sector_id is not null and (select private.in_my_sector(sector_id))));
create policy calendar_events_delete on public.calendar_events for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.perm_scope('calendar.manage')) = 'all');

create policy calendar_attendees_select on public.calendar_attendees for select to authenticated using ((select private.can_event(event_id)));
create policy calendar_attendees_write on public.calendar_attendees for all to authenticated
  using (exists (select 1 from public.calendar_events e where e.id = event_id and (e.created_by = (select auth.uid()) or (select private.perm_scope('calendar.manage')) in ('all', 'sector'))))
  with check (exists (select 1 from public.calendar_events e where e.id = event_id and (e.created_by = (select auth.uid()) or (select private.perm_scope('calendar.manage')) in ('all', 'sector'))));

-- Storage: anexos de tarefa em tarefas/<task_id>/...
create or replace function private.storage_task(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) = 'tarefas' and split_part(p_name, '/', 2) ~ '^[0-9a-f-]{36}$'
         then split_part(p_name, '/', 2)::uuid end;
$$;

grant execute on function private.storage_task(text) to authenticated;

create policy anexos_tarefas_select on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (select private.task_visible(private.storage_task(name))));
create policy anexos_tarefas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (select private.task_visible(private.storage_task(name))));
create policy anexos_tarefas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and private.storage_task(name) is not null and owner_id = (select auth.uid())::text);

-- Tempo real nos quadros.
alter publication supabase_realtime add table public.tasks;

-- Auditoria
create trigger audit_workflow_steps after insert or update or delete on public.workflow_steps
  for each row execute function private.audit_row();
create trigger audit_tasks after insert or delete on public.tasks
  for each row execute function private.audit_row();
