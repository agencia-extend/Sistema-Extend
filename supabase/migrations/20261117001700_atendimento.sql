-- Atendimento da Extend (RF-WPP-03): caixa de entrada das conversas do WhatsApp da Extend (contatos, não grupos),
-- com responsável, "aguardando resposta", não lidas, encerrar/reabrir e o vínculo com o lead do Comercial.
-- As mensagens já chegam em whatsapp_messages pelo webhook do WAHA; aqui elas viram conversas.

create table public.wa_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id   uuid not null references public.whatsapp_connections (id) on delete cascade,
  chat_id         text not null check (char_length(chat_id) <= 200),
  phone           text check (phone ~ '^[0-9]{10,15}$'),
  contact_name    text not null default '' check (char_length(contact_name) <= 200),
  lead_id         uuid references public.leads (id) on delete set null,
  assignee_id     uuid references public.profiles (id) on delete set null,
  status          text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  waiting_reply   boolean not null default false,
  unread_count    integer not null default 0,
  last_preview    text check (char_length(last_preview) <= 200),
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (connection_id, chat_id)
);
create index wa_conversations_list on public.wa_conversations (organization_id, status, last_message_at desc);
create index wa_conversations_lead on public.wa_conversations (lead_id) where lead_id is not null;
alter table public.wa_conversations enable row level security;
revoke all on public.wa_conversations from anon, authenticated;
grant select on public.wa_conversations to authenticated;
create policy wa_conversations_select on public.wa_conversations for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('inbox.read')));

-- Telefone do chat individual (5511999998888@c.us → 5511999998888). Ids @lid não trazem o número.
create or replace function private.wa_phone(p_chat text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when p_chat ~ '^[0-9]{10,15}@c\.us$' then split_part(p_chat, '@', 1) end $$;

-- Cada mensagem de contato atualiza (ou cria) a conversa. Grupos ficam de fora (são os grupos dos clientes).
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
  v_phone text := private.wa_phone(new.chat_id);
  v_lead uuid;
  v_to uuid[];
  v_name text;
begin
  if new.chat_id like '%@g.us' or new.chat_id like '%@broadcast' or new.chat_id like '%@newsletter' then return new; end if;
  select organization_id into v_org from public.whatsapp_connections where id = new.connection_id;
  select * into v_conv from public.wa_conversations where connection_id = new.connection_id and chat_id = new.chat_id for update;
  if v_conv.id is null then
    if v_phone is not null then select id into v_lead from public.leads where organization_id = v_org and phone = v_phone; end if;
    insert into public.wa_conversations (organization_id, connection_id, chat_id, phone, contact_name, lead_id)
    values (v_org, new.connection_id, new.chat_id, v_phone, case when new.from_me then '' else coalesce(new.author_name, '') end, v_lead)
    returning * into v_conv;
    v_new := not new.from_me;
  end if;
  if new.sent_at < coalesce(v_conv.last_message_at, '-infinity') then return new; end if; -- mensagem antiga (histórico)
  v_reopened := not new.from_me and v_conv.status = 'encerrada';
  update public.wa_conversations set
    last_message_at = new.sent_at,
    last_preview = left(coalesce(nullif(new.body, ''), case when new.kind = 'media' then '[mídia]' else '' end), 200),
    contact_name = case when contact_name = '' and not new.from_me and new.author_name is not null then left(new.author_name, 200) else contact_name end,
    waiting_reply = not new.from_me,
    unread_count = case when new.from_me then 0 else unread_count + 1 end,
    last_inbound_at = case when new.from_me then last_inbound_at else new.sent_at end,
    status = case when new.from_me then status else 'aberta' end
  where id = v_conv.id;

  -- Conversa nova ou reaberta: avisa o responsável; sem responsável, quem responde o atendimento.
  if v_new or v_reopened then
    v_name := coalesce(nullif(coalesce(v_conv.contact_name, ''), ''), new.author_name, v_phone, 'Contato');
    if v_conv.assignee_id is not null then
      v_to := array[v_conv.assignee_id];
    else
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
create trigger whatsapp_messages_conversation after insert on public.whatsapp_messages for each row execute function private.wa_message_to_conversation();

-- Ações da pessoa (o banco confere a permissão).
create or replace function private.own_conversation(p_id uuid, p_perm text)
returns public.wa_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations;
begin
  select * into v from public.wa_conversations where id = p_id and organization_id = private.org_id() for update;
  if v.id is null then raise exception 'Conversa não encontrada.' using errcode = 'P0002'; end if;
  if not private.has_perm(p_perm) then raise exception 'Você não tem permissão para esta ação no atendimento.' using errcode = '42501'; end if;
  return v;
end;
$$;
revoke all on function private.own_conversation(uuid, text) from public, anon, authenticated;

create or replace function public.assign_conversation(p_id uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.reply');
begin
  if p_user is not null and not exists (
    select 1 from public.profiles p join public.user_roles ur on ur.user_id = p.id
      join public.role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = 'inbox.reply'
     where p.id = p_user and p.organization_id = v.organization_id and p.is_active) then
    raise exception 'Esta pessoa não atende o WhatsApp.' using errcode = 'P0001';
  end if;
  update public.wa_conversations set assignee_id = p_user where id = p_id;
  if p_user is not null and p_user <> auth.uid() then
    perform public.notify_users(array[p_user], 'inbox', 'Conversa passada para você: ' || coalesce(nullif(v.contact_name, ''), v.phone, 'Contato'),
      left(coalesce(v.last_preview, ''), 200), '/atendimento/' || p_id, 'inbox-assign:' || p_id || ':' || p_user || ':' || extract(epoch from now())::bigint, auth.uid());
  end if;
end;
$$;

create or replace function public.set_conversation_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.reply');
begin
  if p_status not in ('aberta', 'encerrada') then raise exception 'Situação inválida.' using errcode = '22023'; end if;
  update public.wa_conversations set status = p_status, waiting_reply = case when p_status = 'encerrada' then false else waiting_reply end,
         unread_count = case when p_status = 'encerrada' then 0 else unread_count end
   where id = v.id;
end;
$$;

create or replace function public.mark_conversation_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.read');
begin
  update public.wa_conversations set unread_count = 0 where id = v.id and unread_count > 0;
end;
$$;

-- Liga a conversa a um lead do Comercial (ou desliga, p_lead null).
create or replace function public.link_conversation_lead(p_id uuid, p_lead uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.reply');
begin
  if p_lead is not null and not exists (select 1 from public.leads where id = p_lead and organization_id = v.organization_id) then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;
  if p_lead is not null and not private.has_perm('crm.leads.read') then raise exception 'Você não vê os leads do Comercial.' using errcode = '42501'; end if;
  update public.wa_conversations set lead_id = p_lead where id = v.id;
end;
$$;

-- Cria o lead no início do funil padrão a partir da conversa (origem WhatsApp, com o telefone).
create or replace function public.create_lead_from_conversation(p_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.reply');
  v_pipe uuid;
  v_stage uuid;
  v_lead uuid;
begin
  if not private.has_perm('crm.leads.manage') then raise exception 'Você não cadastra leads no Comercial.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Informe o nome do lead.' using errcode = '22023'; end if;
  if v.lead_id is not null then raise exception 'Esta conversa já tem um lead.' using errcode = 'P0001'; end if;
  if v.phone is not null then
    select id into v_lead from public.leads where organization_id = v.organization_id and phone = v.phone;
    if v_lead is not null then
      update public.wa_conversations set lead_id = v_lead where id = v.id;
      return v_lead;
    end if;
  end if;
  select p.id into v_pipe from public.pipelines p where p.organization_id = v.organization_id order by p.is_default desc, p.position, p.created_at limit 1;
  select s.id into v_stage from public.pipeline_stages s where s.pipeline_id = v_pipe order by s.position limit 1;
  if v_stage is null then raise exception 'Configure um funil comercial antes (Configurações › Funis comerciais).' using errcode = 'P0001'; end if;
  insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source, owner_id, created_by)
  values (v.organization_id, v_pipe, v_stage, left(btrim(p_name), 120), v.phone, 'whatsapp', coalesce(v.assignee_id, auth.uid()), auth.uid())
  returning id into v_lead;
  update public.wa_conversations set lead_id = v_lead where id = v.id;
  return v_lead;
end;
$$;
revoke all on function public.assign_conversation(uuid, uuid), public.set_conversation_status(uuid, text), public.mark_conversation_read(uuid),
  public.link_conversation_lead(uuid, uuid), public.create_lead_from_conversation(uuid, text) from public, anon;
grant execute on function public.assign_conversation(uuid, uuid), public.set_conversation_status(uuid, text), public.mark_conversation_read(uuid),
  public.link_conversation_lead(uuid, uuid), public.create_lead_from_conversation(uuid, text) to authenticated;

-- Pessoas que atendem (para escolher o responsável).
create or replace function public.inbox_agents()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.full_name
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = 'inbox.reply'
   where p.organization_id = private.org_id() and p.is_active and private.has_perm('inbox.read')
   order by p.full_name;
$$;
revoke all on function public.inbox_agents() from public, anon;
grant execute on function public.inbox_agents() to authenticated;

-- Lead novo com telefone: liga às conversas que já existem com esse número.
create or replace function private.lead_links_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is not null and (tg_op = 'INSERT' or new.phone is distinct from old.phone) then
    update public.wa_conversations set lead_id = new.id where organization_id = new.organization_id and phone = new.phone and lead_id is null;
  end if;
  return new;
end;
$$;
create trigger leads_link_conversations after insert or update of phone on public.leads for each row execute function private.lead_links_conversations();

-- Conversas que já existem a partir das mensagens guardadas.
insert into public.wa_conversations (organization_id, connection_id, chat_id, phone, contact_name, last_message_at)
select c.organization_id, m.connection_id, m.chat_id, private.wa_phone(m.chat_id), coalesce(max(m.author_name) filter (where not m.from_me), ''), max(m.sent_at)
  from public.whatsapp_messages m join public.whatsapp_connections c on c.id = m.connection_id
 where m.chat_id not like '%@g.us'
 group by c.organization_id, m.connection_id, m.chat_id
on conflict do nothing;

-- Tela ao vivo: mensagens e conversas no Realtime (a RLS decide quem recebe).
alter publication supabase_realtime add table public.wa_conversations;
alter publication supabase_realtime add table public.whatsapp_messages;
