-- Atendimento: fotos, áudios, vídeos e documentos (como no HubSystem). O arquivo do WAHA expira em 1 hora, então a mídia
-- recebida é guardada no armazenamento privado "whatsapp-midia"; a enviada sobe do navegador direto para lá (link
-- assinado criado pelo servidor). Ninguém lê o armazenamento direto: o sistema entrega só a quem vê a conversa.

alter table public.whatsapp_messages add column media_path text check (char_length(media_path) <= 300);
alter table public.whatsapp_messages add column media_mime text check (char_length(media_mime) <= 120);
alter table public.whatsapp_messages add column media_name text check (char_length(media_name) <= 200);

insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-midia', 'whatsapp-midia', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Prévia da conversa pelo tipo do arquivo.
create or replace function private.wa_media_label(p_mime text)
returns text
language sql
immutable
set search_path = ''
as $f$
  select case
    when p_mime like 'image/webp%' then '[figurinha]'
    when p_mime like 'image/%' then '[foto]'
    when p_mime like 'audio/%' then '[áudio]'
    when p_mime like 'video/%' then '[vídeo]'
    when p_mime is not null then '[documento]'
    else '[mídia]'
  end
$f$;

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
                        || coalesce(nullif(new.body, ''), case when new.kind = 'media' then private.wa_media_label(new.media_mime) else '' end), 200),
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
