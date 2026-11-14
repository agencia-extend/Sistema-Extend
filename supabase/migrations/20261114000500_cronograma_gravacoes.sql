-- Central do cliente (parte B): capa do post para o grid do Instagram e registro de gravação por diária.

-- -----------------------------------------------------------------------------
-- Capa do post (prévia do feed)
-- -----------------------------------------------------------------------------
alter table public.task_content add column cover_path text check (cover_path ~ '^clientes/[0-9a-f-]{36}/capas/' and char_length(cover_path) <= 300);

create or replace function public.set_content_cover(p_task uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  if not private.can_task('tasks.manage', p_task) then
    raise exception 'Você não tem permissão para editar este conteúdo.' using errcode = '42501';
  end if;
  select client_id into v_client from public.tasks where id = p_task and deleted_at is null;
  if v_client is null then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;
  if p_path is not null and p_path not like 'clientes/' || v_client || '/capas/%' then
    raise exception 'Capa inválida para este cliente.' using errcode = 'P0001';
  end if;
  insert into public.task_content (task_id) values (p_task) on conflict do nothing;
  update public.task_content set cover_path = p_path, updated_by = auth.uid(), updated_at = now() where task_id = p_task;
  update public.tasks set updated_at = now() where id = p_task;
end;
$$;
grant execute on function public.set_content_cover(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Gravações: uma diária com quem gravou, onde, o link dos brutos e os conteúdos gravados
-- -----------------------------------------------------------------------------
create table public.recording_sessions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  recorded_on  date not null,
  location     text check (char_length(location) <= 200),
  raw_url      text check (raw_url ~* '^https?://' and char_length(raw_url) <= 1000),
  notes        text check (char_length(notes) <= 2000),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index recording_sessions_client_idx on public.recording_sessions (client_id, recorded_on desc);

create table public.recording_people (
  session_id uuid not null references public.recording_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, profile_id)
);

create table public.recording_contents (
  session_id uuid not null references public.recording_sessions (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  primary key (session_id, task_id)
);
create index recording_contents_task_idx on public.recording_contents (task_id);

alter table public.recording_sessions enable row level security;
alter table public.recording_people enable row level security;
alter table public.recording_contents enable row level security;

create policy recording_sessions_select on public.recording_sessions for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy recording_people_select on public.recording_people for select to authenticated
  using (exists (select 1 from public.recording_sessions s where s.id = session_id and private.can_client('clients.read', s.client_id)));
create policy recording_contents_select on public.recording_contents for select to authenticated
  using (exists (select 1 from public.recording_sessions s where s.id = session_id and private.can_client('clients.read', s.client_id)));
-- Excluir: quem registrou ou quem gerencia o cliente. Criar e editar: pela função save_recording.
create policy recording_sessions_delete on public.recording_sessions for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.can_manage_client(client_id)));

revoke all on public.recording_sessions, public.recording_people, public.recording_contents from authenticated, anon;
grant select on public.recording_sessions, public.recording_people, public.recording_contents to authenticated;
grant delete on public.recording_sessions to authenticated;

create or replace function public.save_recording(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := (p ->> 'client_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_on date := (p ->> 'recorded_on')::date;
  v_raw text := nullif(btrim(p ->> 'raw_url'), '');
  v_people uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'people', '[]')) x), '{}');
  v_tasks uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'tasks', '[]')) x), '{}');
  v_name text;
  v_editors uuid[];
begin
  if not private.can_client('tasks.manage', v_client) then
    raise exception 'Você não tem permissão para registrar gravações deste cliente.' using errcode = '42501';
  end if;
  if v_on is null then raise exception 'Informe a data da gravação.' using errcode = 'P0001'; end if;
  if v_on > private.today_sp() + 60 then raise exception 'A data está muito no futuro. Registre a gravação depois que ela acontecer.' using errcode = 'P0001'; end if;
  if v_raw is not null and v_raw !~* '^https?://' then raise exception 'O link dos brutos precisa começar com https://.' using errcode = 'P0001'; end if;
  if cardinality(v_people) = 0 then raise exception 'Marque quem gravou.' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(v_people) x where not exists (select 1 from public.profiles pr join public.clients c on c.organization_id = pr.organization_id where pr.id = x and c.id = v_client and pr.is_active)) then
    raise exception 'Pessoa não encontrada ou sem acesso ao sistema.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(v_tasks) x where not exists (select 1 from public.tasks t where t.id = x and t.client_id = v_client and t.deleted_at is null)) then
    raise exception 'Um dos conteúdos não é deste cliente.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.recording_sessions (client_id, recorded_on, location, raw_url, notes)
    values (v_client, v_on, nullif(btrim(p ->> 'location'), ''), v_raw, nullif(btrim(p ->> 'notes'), ''))
    returning id into v_id;
  else
    update public.recording_sessions
       set recorded_on = v_on, location = nullif(btrim(p ->> 'location'), ''), raw_url = v_raw, notes = nullif(btrim(p ->> 'notes'), '')
     where id = v_id and client_id = v_client;
    if not found then raise exception 'Gravação não encontrada.' using errcode = 'P0002'; end if;
    delete from public.recording_people where session_id = v_id;
    delete from public.recording_contents where session_id = v_id;
  end if;
  insert into public.recording_people (session_id, profile_id) select v_id, x from unnest(v_people) x on conflict do nothing;
  insert into public.recording_contents (session_id, task_id) select v_id, x from unnest(v_tasks) x on conflict do nothing;

  -- Os conteúdos gravados recebem a data, quem gravou e o link dos brutos (sem apagar o que já tinham).
  insert into public.task_content (task_id) select x from unnest(v_tasks) x on conflict do nothing;
  update public.task_content
     set recording_on = v_on,
         recorder_id = coalesce(recorder_id, v_people[1]),
         raw_url = coalesce(raw_url, v_raw),
         updated_by = auth.uid(), updated_at = now()
   where task_id = any (v_tasks);

  -- Quem edita esses conteúdos é avisado de que os brutos chegaram.
  select name into v_name from public.clients where id = v_client;
  select array_agg(distinct editor_id) into v_editors from public.task_content where task_id = any (v_tasks) and editor_id is not null;
  if v_raw is not null and cardinality(coalesce(v_editors, '{}')) > 0 then
    perform private.notify(v_editors, 'assigned', 'Brutos da gravação de ' || v_name || ' disponíveis',
      to_char(v_on, 'DD/MM/YYYY') || ' · ' || cardinality(v_tasks) || ' conteúdo(s). Abra a gravação para pegar o link.',
      '/clientes/' || v_client || '/gravacoes', 'recording:' || v_id || ':' || coalesce(v_raw, ''));
  end if;
  perform private.timeline(v_client, 'recording', 'Gravação registrada: ' || to_char(v_on, 'DD/MM/YYYY'), jsonb_build_object('session_id', v_id, 'contents', cardinality(v_tasks)));
  return v_id;
end;
$$;
grant execute on function public.save_recording(jsonb) to authenticated;
