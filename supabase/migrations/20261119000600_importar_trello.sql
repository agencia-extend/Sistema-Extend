-- Importação do Trello (RF-TAR-11, decisão D7: só os quadros ativos). O arquivo JSON exportado do Trello é lido no
-- navegador e chega aqui já resumido: colunas abertas, cards não arquivados, etiquetas, checklists, comentários,
-- anexos como links e os membros já associados às pessoas da equipe. Tudo entra de uma vez, num quadro novo do
-- cliente; o mesmo quadro do Trello não entra duas vezes no mesmo cliente; "desfazer" tira o que foi importado.

-- Avisos em silêncio durante a importação: cada card criado e cada comentário avisariam alguém. No fim vai um aviso
-- só por pessoa. A chave vale só dentro da transação (set_config(..., true)).
create or replace function public.notify_users(p_users uuid[], p_kind text, p_title text, p_body text, p_href text, p_dedupe_key text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if coalesce(current_setting('extend.quiet', true), '') = 'on' then return 0; end if;
  insert into public.notifications (organization_id, user_id, actor_id, kind, title, body, href, dedupe_key, push_status)
  select p.organization_id, p.id, p_actor, p_kind, left(p_title, 200), left(p_body, 1000), p_href, p_dedupe_key,
         case when coalesce(np.push, true) then 'pending' else 'skipped' end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id and np.kind = p_kind
  where p.id = any (p_users)
    and p.is_active
    and p.id is distinct from p_actor
    and coalesce(np.in_app, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create table public.trello_imports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  board_id        uuid not null references public.boards (id) on delete cascade,
  source_id       text not null check (source_id ~ '^[0-9a-f]{24}$'),
  source_name     text not null check (char_length(source_name) between 1 and 200),
  cards           integer not null check (cards >= 0),
  comments        integer not null check (comments >= 0),
  imported_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  undone_at       timestamptz,
  undone_by       uuid references public.profiles (id) on delete set null
);
create unique index trello_imports_once on public.trello_imports (client_id, source_id) where undone_at is null;
create index trello_imports_client_idx on public.trello_imports (client_id, created_at desc);

alter table public.trello_imports enable row level security;
create policy trello_imports_select on public.trello_imports for select to authenticated
  using (organization_id = (select private.org_id()) and private.can_client('tasks.read', client_id));
revoke insert, update, delete on public.trello_imports from authenticated, anon;

create or replace function private.can_import_trello(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clients c where c.id = p_client and c.organization_id = private.org_id())
     and (private.has_perm('tasks.boards.configure') or private.can_client('tasks.assign', p_client));
$$;

-- p_board: {sourceId, name, columns:[{name, color, done}], cards:[{col, title, desc, due, start, created, closedAt, pos,
--   labels:[{name, color}], assignee, participants:[uuid], checklist:[{title, done}], comments:[{author, at, text}],
--   links:[{name, url}]}]}
create or replace function public.import_trello_board(p_client uuid, p_board jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_me uuid := auth.uid();
  v_source text := p_board ->> 'sourceId';
  v_name text := left(btrim(coalesce(p_board ->> 'name', '')), 60);
  v_board uuid;
  v_cols uuid[] := '{}';
  v_board_col_tmp uuid;
  v_col jsonb;
  v_card jsonb;
  v_task uuid;
  v_assignee uuid;
  v_done boolean;
  v_tag uuid;
  v_item jsonb;
  v_n int := 0;
  v_comments int := 0;
  v_import uuid;
  v_prev public.trello_imports;
  v_client text;
  v_team uuid[];
  r record;
begin
  if v_me is null or not private.can_import_trello(p_client) then
    raise exception 'Você não cria quadros para este cliente.' using errcode = '42501';
  end if;
  if v_source is null or v_source !~ '^[0-9a-f]{24}$' or v_name = '' then
    raise exception 'Arquivo do Trello inválido.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_board -> 'columns', '[]')) not between 1 and 50 then
    raise exception 'O quadro precisa ter de 1 a 50 listas abertas.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_board -> 'cards', '[]')) > 1000 then
    raise exception 'O quadro tem mais de 1.000 cards. Arquive os antigos no Trello e exporte de novo.' using errcode = 'P0001';
  end if;
  select * into v_prev from public.trello_imports where client_id = p_client and source_id = v_source and undone_at is null;
  if v_prev.id is not null then
    raise exception 'Este quadro do Trello já foi importado para este cliente em %. Desfaça aquela importação para importar de novo.',
      to_char(v_prev.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') using errcode = '23505';
  end if;

  -- Só pessoas ativas da equipe (não do portal do cliente) recebem cards.
  select coalesce(array_agg(id), '{}') into v_team from public.profiles
   where organization_id = v_org and is_active and portal_client_id is null;

  perform set_config('extend.quiet', 'on', true);

  insert into public.boards (organization_id, name, client_id, created_by)
  values (v_org, v_name, p_client, v_me) returning id into v_board;

  for v_col in select value from jsonb_array_elements(p_board -> 'columns') loop
    insert into public.board_columns (board_id, name, color, is_done, position)
    values (v_board, left(btrim(v_col ->> 'name'), 60),
            case when v_col ->> 'color' ~ '^#[0-9A-Fa-f]{6}$' then v_col ->> 'color' else '#64748B' end,
            coalesce((v_col ->> 'done')::boolean, false), coalesce(array_length(v_cols, 1), 0) + 1)
    returning id into v_board_col_tmp;
    v_cols := v_cols || v_board_col_tmp;
  end loop;

  for v_card in select value from jsonb_array_elements(coalesce(p_board -> 'cards', '[]')) loop
    if (v_card ->> 'col')::int not between 0 and array_length(v_cols, 1) - 1 then continue; end if;
    select is_done into v_done from public.board_columns where id = v_cols[(v_card ->> 'col')::int + 1];
    v_assignee := nullif(v_card ->> 'assignee', '')::uuid;
    if v_assignee is not null and not (v_assignee = any (v_team)) then v_assignee := null; end if;

    insert into public.tasks (organization_id, client_id, type, title, description, status, priority, assignee_id,
                              due_at, start_at, board_id, board_column_id, position, created_by, created_at, completed_at)
    values (v_org, p_client, 'geral', left(btrim(v_card ->> 'title'), 200), nullif(left(v_card ->> 'desc', 10000), ''),
            case when v_done then 'concluido' else 'pendente' end, 'media', v_assignee,
            nullif(v_card ->> 'due', '')::timestamptz, nullif(v_card ->> 'start', '')::timestamptz,
            v_board, v_cols[(v_card ->> 'col')::int + 1], greatest(coalesce((v_card ->> 'pos')::double precision, 1), 1),
            v_me, coalesce(nullif(v_card ->> 'created', '')::timestamptz, now()),
            case when v_done then coalesce(nullif(v_card ->> 'closedAt', '')::timestamptz, now()) end)
    returning id into v_task;
    insert into public.task_activity (task_id, actor_id, kind, title) values (v_task, v_me, 'created', 'Importado do Trello');

    insert into public.task_participants (task_id, profile_id)
    select distinct v_task, x::uuid from jsonb_array_elements_text(coalesce(v_card -> 'participants', '[]')) x
     where x::uuid = any (v_team) and x::uuid is distinct from v_assignee
    on conflict do nothing;

    for v_item in select value from jsonb_array_elements(coalesce(v_card -> 'labels', '[]')) loop
      insert into public.tags (organization_id, name, color)
      values (v_org, left(btrim(v_item ->> 'name'), 40), case when v_item ->> 'color' ~ '^#[0-9A-Fa-f]{6}$' then v_item ->> 'color' else '#64748B' end)
      on conflict (organization_id, name) do nothing;
      select id into v_tag from public.tags where organization_id = v_org and name = left(btrim(v_item ->> 'name'), 40);
      insert into public.task_tags (task_id, tag_id) values (v_task, v_tag) on conflict do nothing;
    end loop;

    insert into public.task_checklist_items (task_id, title, position, done_at, done_by)
    select v_task, left(btrim(i.value ->> 'title'), 200), i.ord::int,
           case when (i.value ->> 'done')::boolean then now() end,
           case when (i.value ->> 'done')::boolean then v_me end
      from jsonb_array_elements(coalesce(v_card -> 'checklist', '[]')) with ordinality i(value, ord)
     where btrim(i.value ->> 'title') <> '';

    for r in select value as c from jsonb_array_elements(coalesce(v_card -> 'comments', '[]')) loop
      insert into public.task_comments (task_id, author_id, body, mentions, created_at)
      values (v_task, v_me,
              left(coalesce(nullif(btrim(r.c ->> 'author'), ''), 'Alguém') || ' no Trello, '
                   || to_char((r.c ->> 'at')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ':' || E'\n'
                   || (r.c ->> 'text'), 4000),
              '{}', (r.c ->> 'at')::timestamptz);
      v_comments := v_comments + 1;
    end loop;

    insert into public.task_attachments (task_id, kind, name, url, uploaded_by)
    select v_task, 'link', left(coalesce(nullif(btrim(l.value ->> 'name'), ''), l.value ->> 'url'), 200), l.value ->> 'url', v_me
      from jsonb_array_elements(coalesce(v_card -> 'links', '[]')) l
     where l.value ->> 'url' ~ '^https?://' and char_length(l.value ->> 'url') <= 1000;

    v_n := v_n + 1;
  end loop;

  insert into public.trello_imports (organization_id, client_id, board_id, source_id, source_name, cards, comments, imported_by)
  values (v_org, p_client, v_board, v_source, left(coalesce(nullif(btrim(p_board ->> 'sourceName'), ''), v_name), 200), v_n, v_comments, v_me)
  returning id into v_import;

  perform set_config('extend.quiet', 'off', true);

  -- Um aviso por pessoa que recebeu cards abertos.
  select name into v_client from public.clients where id = p_client;
  for r in select assignee_id, count(*) n from public.tasks
            where board_id = v_board and assignee_id is not null and status <> 'concluido' group by 1 loop
    perform public.notify_users(array[r.assignee_id], 'assigned',
      case when r.n = 1 then '1 card do Trello está com você' else r.n || ' cards do Trello estão com você' end,
      'Quadro ' || v_name || ' de ' || v_client,
      '/clientes/' || p_client || '/quadros?quadro=' || v_board, 'trello:' || v_import || ':' || r.assignee_id, v_me);
  end loop;
  perform private.timeline(p_client, 'quadros', 'Quadro importado do Trello: ' || v_name || ' (' || v_n || ' cards)');
  return v_board;
end;
$$;

-- Desfazer: os cards importados saem (exclusão lógica, como as demais demandas) e o quadro é arquivado.
create or replace function public.undo_trello_import(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.trello_imports;
  v_name text;
begin
  select * into v from public.trello_imports where id = p_id and organization_id = private.org_id() and undone_at is null for update;
  if v.id is null then raise exception 'Importação não encontrada ou já desfeita.' using errcode = 'P0002'; end if;
  if not private.can_import_trello(v.client_id) then
    raise exception 'Você não edita os quadros deste cliente.' using errcode = '42501';
  end if;
  update public.tasks set deleted_at = now() where board_id = v.board_id and deleted_at is null;
  update public.boards set archived_at = coalesce(archived_at, now()) where id = v.board_id returning name into v_name;
  update public.trello_imports set undone_at = now(), undone_by = auth.uid() where id = v.id;
  perform private.timeline(v.client_id, 'quadros', 'Importação do Trello desfeita: ' || v_name);
end;
$$;

revoke all on function public.import_trello_board(uuid, jsonb) from public, anon;
revoke all on function public.undo_trello_import(uuid) from public, anon;
revoke all on function private.can_import_trello(uuid) from public, anon;
grant execute on function public.import_trello_board(uuid, jsonb) to authenticated;
grant execute on function public.undo_trello_import(uuid) to authenticated;
