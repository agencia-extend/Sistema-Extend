-- Atendimento como no HubSystem: grupos também viram conversas (com o cliente do grupo) e "Compilar conversas"
-- traz o histórico do aparelho (conversas individuais e grupos) para o Atendimento, em etapas, sem avisar
-- conversa por conversa.

-- Conversa de contato ou de grupo; quando veio da compilação.
alter table public.wa_conversations add column kind text not null default 'contato' check (kind in ('contato', 'grupo'));
alter table public.wa_conversations add column imported_at timestamptz;
update public.wa_conversations set kind = 'grupo' where chat_id like '%@g.us';
create index wa_conversations_kind on public.wa_conversations (organization_id, kind, status, last_message_at desc);

-- Mensagens novas viram conversa (contato ou grupo). Durante a compilação (extend.wa_import = on), a própria
-- função de importação monta a conversa: aqui não faz nada, para não avisar a equipe de cada conversa antiga.
create or replace function private.wa_message_to_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_conv public.wa_conversations;
  v_new boolean := false;
  v_reopened boolean := false;
  v_group boolean := new.chat_id like '%@g.us';
  v_phone text := private.wa_phone(new.chat_id);
  v_lead uuid;
  v_to uuid[];
  v_name text;
begin
  if coalesce(current_setting('extend.wa_import', true), '') = 'on' then return new; end if;
  if new.chat_id like '%@broadcast' or new.chat_id like '%@newsletter' or new.chat_id like 'status@%' then return new; end if;
  select organization_id into v_org from public.whatsapp_connections where id = new.connection_id;
  select * into v_conv from public.wa_conversations where connection_id = new.connection_id and chat_id = new.chat_id for update;
  if v_conv.id is null then
    if v_group then
      insert into public.whatsapp_groups (connection_id, jid, name) values (new.connection_id, new.chat_id, '')
      on conflict (connection_id, jid) do update set last_seen_at = now();
      select name into v_name from public.whatsapp_groups where connection_id = new.connection_id and jid = new.chat_id;
    elsif v_phone is not null then
      select id into v_lead from public.leads where organization_id = v_org and phone = v_phone;
    end if;
    insert into public.wa_conversations (organization_id, connection_id, chat_id, kind, phone, contact_name, lead_id)
    values (v_org, new.connection_id, new.chat_id, case when v_group then 'grupo' else 'contato' end, v_phone,
            left(case when v_group then coalesce(v_name, '') when new.from_me then '' else coalesce(new.author_name, '') end, 200), v_lead)
    returning * into v_conv;
    -- Grupo novo não avisa ninguém: são os grupos dos clientes, já conhecidos da equipe.
    v_new := not new.from_me and not v_group;
  end if;
  if new.sent_at < coalesce(v_conv.last_message_at, '-infinity') then return new; end if; -- mensagem antiga (histórico)
  v_reopened := not new.from_me and v_conv.status = 'encerrada';
  update public.wa_conversations set
    last_message_at = new.sent_at,
    last_preview = left(case when v_group and not new.from_me and new.author_name is not null then new.author_name || ': ' else '' end
                        || coalesce(nullif(new.body, ''), case when new.kind = 'media' then '[mídia]' else '' end), 200),
    contact_name = case when not v_group and contact_name = '' and not new.from_me and new.author_name is not null then left(new.author_name, 200) else contact_name end,
    waiting_reply = not new.from_me,
    unread_count = case when new.from_me then 0 else unread_count + 1 end,
    last_inbound_at = case when new.from_me then last_inbound_at else new.sent_at end,
    status = case when new.from_me then status else 'aberta' end
  where id = v_conv.id;

  -- Conversa nova ou reaberta: avisa o responsável; sem responsável, quem responde o atendimento (grupo só com responsável).
  if v_new or v_reopened then
    v_name := coalesce(nullif(coalesce(v_conv.contact_name, ''), ''), new.author_name, v_phone, case when v_group then 'Grupo' else 'Contato' end);
    if v_conv.assignee_id is not null then
      v_to := array[v_conv.assignee_id];
    elsif not v_group then
      select array_agg(distinct p.id) into v_to
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id
        join public.role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = 'inbox.reply'
       where p.organization_id = v_org and p.is_active;
    end if;
    if v_to is not null then
      perform public.notify_users(v_to, 'inbox', case when v_new then 'Nova conversa no WhatsApp: ' else 'Conversa reaberta: ' end || v_name,
        left(coalesce(new.body, '[mídia]'), 200), '/atendimento/' || v_conv.id,
        case when v_new then 'inbox-new:' || v_conv.id else 'inbox-reopen:' || v_conv.id || ':' || extract(epoch from new.sent_at)::bigint end, null);
    end if;
  end if;
  return new;
end;
$$;

-- Nome do grupo atualizado em Configurações › WhatsApp (Buscar grupos) passa para a conversa.
create or replace function private.wa_group_name_to_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name <> '' and new.name is distinct from old.name then
    update public.wa_conversations set contact_name = left(new.name, 200) where connection_id = new.connection_id and chat_id = new.jid;
  end if;
  return new;
end;
$$;
create trigger whatsapp_groups_conversation_name after update of name on public.whatsapp_groups
  for each row execute function private.wa_group_name_to_conversation();
update public.wa_conversations c set contact_name = left(g.name, 200)
  from public.whatsapp_groups g where c.kind = 'grupo' and g.connection_id = c.connection_id and g.jid = c.chat_id and g.name <> '';

-- Compilações (uma em andamento por número). Só o servidor escreve; quem conecta acompanha.
create table public.wa_imports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  connection_id    uuid not null references public.whatsapp_connections (id) on delete cascade,
  status           text not null default 'importando' check (status in ('importando', 'aguardando', 'concluida', 'erro', 'cancelada')),
  include_contacts boolean not null default true,
  include_groups   boolean not null default true,
  pass             integer not null default 1,
  next_offset      integer not null default 0,
  contacts_done    integer not null default 0,
  groups_done      integer not null default 0,
  skipped          integer not null default 0,
  messages_done    integer not null default 0,
  last_error       text,
  not_before       timestamptz not null default now(),
  lease_until      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz,
  check (include_contacts or include_groups)
);
create unique index wa_imports_one_active on public.wa_imports (connection_id) where status in ('importando', 'aguardando');
create index wa_imports_due on public.wa_imports (not_before) where status in ('importando', 'aguardando');
alter table public.wa_imports enable row level security;
revoke all on public.wa_imports from anon, authenticated;
grant select on public.wa_imports to authenticated;
create policy wa_imports_select on public.wa_imports for select to authenticated
  using (organization_id = (select private.org_id()) and ((select private.has_perm('inbox.manage')) or (select private.has_perm('integrations.manage'))));

-- Uma conversa do histórico: grava as mensagens que faltam e monta a conversa. Devolve quantas mensagens entraram.
-- p_messages: [{wamid, from_me, author, author_name, body, kind, sent_at}]. Só o servidor chama.
create or replace function public.wa_import_chat(p_connection uuid, p_chat text, p_kind text, p_phone text, p_name text, p_messages jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_count integer := 0;
  v_last public.whatsapp_messages;
  v_inbound timestamptz;
  v_lead uuid;
  v_group boolean := p_kind = 'grupo';
  v_phone text := case when p_phone ~ '^[0-9]{10,15}$' then p_phone end;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), ''), 200);
  v_preview text;
begin
  if p_kind not in ('contato', 'grupo') then raise exception 'Tipo de conversa inválido.' using errcode = '22023'; end if;
  if v_group <> (p_chat like '%@g.us') then raise exception 'Conversa inválida.' using errcode = '22023'; end if;
  select organization_id into v_org from public.whatsapp_connections where id = p_connection;
  if v_org is null then raise exception 'Conexão não encontrada.' using errcode = 'P0002'; end if;

  perform set_config('extend.wa_import', 'on', true);
  insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author, author_name, body, kind, sent_at)
  select p_connection, left(m->>'wamid', 200), p_chat, coalesce((m->>'from_me')::boolean, false), left(m->>'author', 200), left(m->>'author_name', 200),
         left(m->>'body', 8000), case when m->>'kind' = 'media' then 'media' else 'text' end, (m->>'sent_at')::timestamptz
    from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) m
   where coalesce(m->>'wamid', '') <> '' and m->>'sent_at' is not null
  on conflict (connection_id, wamid) do nothing;
  get diagnostics v_count = row_count;
  perform set_config('extend.wa_import', 'off', true);

  if v_group then
    insert into public.whatsapp_groups (connection_id, jid, name) values (p_connection, p_chat, v_name)
    on conflict (connection_id, jid) do update set name = case when excluded.name <> '' then excluded.name else public.whatsapp_groups.name end, last_seen_at = now();
    select left(name, 200) into v_name from public.whatsapp_groups where connection_id = p_connection and jid = p_chat;
  end if;

  select * into v_last from public.whatsapp_messages where connection_id = p_connection and chat_id = p_chat order by sent_at desc limit 1;
  -- Contato sem nenhuma mensagem não vira conversa; grupo entra mesmo vazio (as mensagens novas chegam depois).
  if v_last.id is null and not v_group then return v_count; end if;
  select max(sent_at) into v_inbound from public.whatsapp_messages where connection_id = p_connection and chat_id = p_chat and not from_me;
  if not v_group and v_phone is not null then select id into v_lead from public.leads where organization_id = v_org and phone = v_phone; end if;
  v_preview := case when v_last.id is null then null else left(
    case when v_group and not v_last.from_me and v_last.author_name is not null then v_last.author_name || ': ' else '' end
    || coalesce(nullif(v_last.body, ''), case when v_last.kind = 'media' then '[mídia]' else '' end), 200) end;

  insert into public.wa_conversations as c (organization_id, connection_id, chat_id, kind, phone, contact_name, lead_id, status, waiting_reply, unread_count,
                                            last_preview, last_message_at, last_inbound_at, imported_at)
  values (v_org, p_connection, p_chat, p_kind, v_phone, coalesce(v_name, ''), v_lead,
          -- Histórico antigo entra encerrado; o que é recente fica aberto e, se o contato falou por último há pouco, aguardando.
          case when v_last.sent_at is null or v_last.sent_at < now() - interval '30 days' then 'encerrada' else 'aberta' end,
          coalesce(not v_last.from_me and v_last.sent_at > now() - interval '3 days', false), 0,
          v_preview, v_last.sent_at, v_inbound, now())
  on conflict (connection_id, chat_id) do update set
    phone = coalesce(c.phone, excluded.phone),
    contact_name = case when c.contact_name = '' or c.kind = 'grupo' and excluded.contact_name <> '' then excluded.contact_name else c.contact_name end,
    lead_id = coalesce(c.lead_id, excluded.lead_id),
    last_preview = case when excluded.last_message_at > coalesce(c.last_message_at, '-infinity') then excluded.last_preview else c.last_preview end,
    last_inbound_at = greatest(c.last_inbound_at, excluded.last_inbound_at),
    last_message_at = greatest(c.last_message_at, excluded.last_message_at),
    imported_at = now();
  return v_count;
end;
$$;
revoke all on function public.wa_import_chat(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wa_import_chat(uuid, text, text, text, text, jsonb) to service_role;

-- Situação para a tela do Atendimento: quem pode conectar e compilar.
create or replace function public.whatsapp_status()
returns table (id uuid, base_url text, session text, status text, me_id text, me_name text, last_error text, last_event_at timestamptz, connected_by_name text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.base_url, c.session, c.status, c.me_id, c.me_name, c.last_error, c.last_event_at, p.full_name, c.updated_at
    from public.whatsapp_connections c left join public.profiles p on p.id = c.connected_by
   where c.organization_id = private.org_id()
     and (private.has_perm('integrations.manage') or private.has_perm('inbox.read') or private.has_perm('inbox.manage'));
$$;

-- A compilação continua sozinha mesmo com a tela fechada (só chama o sistema quando há compilação na fila).
select cron.schedule('extend-whatsapp-compilar', '* * * * *', $$select private.call_job('whatsapp-import') where exists (select 1 from public.wa_imports where status in ('importando', 'aguardando') and not_before <= now())$$);
