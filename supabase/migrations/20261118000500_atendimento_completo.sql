-- Atendimento como no HubSystem (RF-WPP-03/06/07): foto do contato, etiquetas, respostas rápidas, apagar e restaurar
-- conversa, confirmação de entrega e leitura (✓ ✓✓), radar de quem espera resposta, origem do anúncio
-- Clique-para-WhatsApp (o lead entra no funil sozinho) e telefone de quem tem id oculto (@lid).

-- Conversa: foto, apagada e anúncio de origem.
alter table public.wa_conversations
  add column avatar_url text check (char_length(avatar_url) <= 1000 and avatar_url ~ '^https://'),
  add column avatar_checked_at timestamptz,
  add column deleted_at timestamptz,
  add column ad_source_id text check (char_length(ad_source_id) <= 64),
  add column ad_headline text check (char_length(ad_headline) <= 300),
  add column ad_source_url text check (char_length(ad_source_url) <= 1000),
  add column ad_ctwa_clid text check (char_length(ad_ctwa_clid) <= 300),
  add column ad_at timestamptz;
create index wa_conversations_waiting on public.wa_conversations (organization_id, last_inbound_at) where waiting_reply and status = 'aberta' and deleted_at is null;

-- Mensagem enviada: enviada, entregue, lida ou erro (evento message.ack do WAHA).
alter table public.whatsapp_messages add column ack text check (ack in ('enviada', 'entregue', 'lida', 'erro'));

-- Etiquetas da agência e as de cada conversa.
create table public.wa_tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 40),
  color           text not null default 'azul' check (color in ('azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'cinza')),
  created_at      timestamptz not null default now()
);
create unique index wa_tags_name on public.wa_tags (organization_id, lower(name));
create table public.wa_conversation_tags (
  conversation_id uuid not null references public.wa_conversations (id) on delete cascade,
  tag_id          uuid not null references public.wa_tags (id) on delete cascade,
  primary key (conversation_id, tag_id)
);
create index wa_conversation_tags_tag on public.wa_conversation_tags (tag_id);

-- Respostas rápidas: "/atalho" na caixa de resposta.
create table public.wa_quick_replies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  shortcut        text not null check (shortcut ~ '^[a-z0-9_-]{1,30}$'),
  body            text not null check (char_length(body) between 1 and 4096),
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  unique (organization_id, shortcut)
);

-- Ajustes do atendimento: minutos até a conversa entrar no radar.
create table public.wa_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  radar_minutes   integer not null default 15 check (radar_minutes between 5 and 1440),
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now()
);

alter table public.wa_tags enable row level security;
alter table public.wa_conversation_tags enable row level security;
alter table public.wa_quick_replies enable row level security;
alter table public.wa_settings enable row level security;
revoke all on public.wa_tags, public.wa_conversation_tags, public.wa_quick_replies, public.wa_settings from anon, authenticated;
grant select on public.wa_tags, public.wa_conversation_tags, public.wa_quick_replies, public.wa_settings to authenticated;
create policy wa_tags_select on public.wa_tags for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('inbox.read')));
create policy wa_conversation_tags_select on public.wa_conversation_tags for select to authenticated
  using (exists (select 1 from public.wa_conversations c where c.id = conversation_id and c.organization_id = (select private.org_id())) and (select private.has_perm('inbox.read')));
create policy wa_quick_replies_select on public.wa_quick_replies for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('inbox.read')));
create policy wa_settings_select on public.wa_settings for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('inbox.read')));

create trigger audit_wa_quick_replies after insert or update or delete on public.wa_quick_replies for each row execute function private.audit_row();
create trigger audit_wa_tags after insert or update or delete on public.wa_tags for each row execute function private.audit_row();
create trigger audit_wa_settings after insert or update on public.wa_settings for each row execute function private.audit_row();

create or replace function private.inbox_manager()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('inbox.manage') then
    raise exception 'Só quem administra o atendimento muda isto.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.inbox_manager() from public, anon, authenticated;

create or replace function public.save_wa_tag(p_id uuid, p_name text, p_color text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform private.inbox_manager();
  if char_length(v_name) not between 1 and 40 then raise exception 'Nome da etiqueta de 1 a 40 caracteres.' using errcode = 'P0001'; end if;
  if p_color not in ('azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'cinza') then raise exception 'Escolha a cor da etiqueta.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.wa_tags where organization_id = private.org_id() and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Já existe uma etiqueta com este nome.' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.wa_tags (organization_id, name, color) values (private.org_id(), v_name, p_color) returning id into v_id;
  else
    update public.wa_tags set name = v_name, color = p_color where id = p_id and organization_id = private.org_id() returning id into v_id;
    if v_id is null then raise exception 'Etiqueta não encontrada.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_wa_tag(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inbox_manager();
  delete from public.wa_tags where id = p_id and organization_id = private.org_id();
  if not found then raise exception 'Etiqueta não encontrada.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_conversation_tags(p_id uuid, p_tags uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.reply');
begin
  if exists (select 1 from unnest(coalesce(p_tags, '{}')) t(id) where not exists (select 1 from public.wa_tags w where w.id = t.id and w.organization_id = v.organization_id)) then
    raise exception 'Etiqueta não encontrada.' using errcode = 'P0002';
  end if;
  delete from public.wa_conversation_tags where conversation_id = p_id and not (tag_id = any (coalesce(p_tags, '{}')));
  insert into public.wa_conversation_tags (conversation_id, tag_id) select p_id, t from unnest(coalesce(p_tags, '{}')) t on conflict do nothing;
end;
$$;

create or replace function public.save_quick_reply(p_id uuid, p_shortcut text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_short text := lower(btrim(coalesce(p_shortcut, ''), ' /'));
begin
  perform private.inbox_manager();
  if v_short !~ '^[a-z0-9_-]{1,30}$' then raise exception 'Atalho de 1 a 30 letras sem acento, números, - ou _.' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4096 then raise exception 'Escreva o texto da resposta (até 4.096 caracteres).' using errcode = 'P0001'; end if;
  if exists (select 1 from public.wa_quick_replies where organization_id = private.org_id() and shortcut = v_short and id is distinct from p_id) then
    raise exception 'Já existe uma resposta com o atalho /%.', v_short using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.wa_quick_replies (organization_id, shortcut, body, updated_by) values (private.org_id(), v_short, btrim(p_body), auth.uid()) returning id into v_id;
  else
    update public.wa_quick_replies set shortcut = v_short, body = btrim(p_body), updated_by = auth.uid(), updated_at = now()
     where id = p_id and organization_id = private.org_id() returning id into v_id;
    if v_id is null then raise exception 'Resposta não encontrada.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_quick_reply(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inbox_manager();
  delete from public.wa_quick_replies where id = p_id and organization_id = private.org_id();
  if not found then raise exception 'Resposta não encontrada.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_inbox_settings(p_radar_minutes int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inbox_manager();
  if p_radar_minutes not between 5 and 1440 then raise exception 'O radar vai de 5 minutos a 24 horas.' using errcode = 'P0001'; end if;
  insert into public.wa_settings (organization_id, radar_minutes, updated_by) values (private.org_id(), p_radar_minutes, auth.uid())
  on conflict (organization_id) do update set radar_minutes = excluded.radar_minutes, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- Apagar some da lista para todos (as mensagens ficam guardadas); mensagem nova do contato traz de volta.
create or replace function public.delete_conversation(p_id uuid, p_restore boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations := private.own_conversation(p_id, 'inbox.manage');
begin
  if p_restore then
    update public.wa_conversations set deleted_at = null where id = v.id;
  else
    update public.wa_conversations set deleted_at = now(), unread_count = 0, waiting_reply = false where id = v.id;
  end if;
end;
$$;

revoke all on function public.save_wa_tag(uuid, text, text), public.delete_wa_tag(uuid), public.set_conversation_tags(uuid, uuid[]),
  public.save_quick_reply(uuid, text, text), public.delete_quick_reply(uuid), public.set_inbox_settings(int), public.delete_conversation(uuid, boolean) from public, anon;
grant execute on function public.save_wa_tag(uuid, text, text), public.delete_wa_tag(uuid), public.set_conversation_tags(uuid, uuid[]),
  public.save_quick_reply(uuid, text, text), public.delete_quick_reply(uuid), public.set_inbox_settings(int), public.delete_conversation(uuid, boolean) to authenticated;

-- Telefone de quem tem id oculto (@lid), descoberto pelo servidor: liga o lead com o mesmo telefone. Só o servidor chama.
create or replace function public.wa_conversation_phone(p_connection uuid, p_chat text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations;
begin
  if p_phone !~ '^[0-9]{10,15}$' then return; end if;
  select * into v from public.wa_conversations where connection_id = p_connection and chat_id = p_chat and kind = 'contato' for update;
  if v.id is null or v.phone is not null then return; end if;
  update public.wa_conversations set phone = p_phone,
    lead_id = coalesce(lead_id, (select l.id from public.leads l where l.organization_id = v.organization_id and l.phone = p_phone))
   where id = v.id;
end;
$$;
revoke all on function public.wa_conversation_phone(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wa_conversation_phone(uuid, text, text) to service_role;

-- RF-WPP-06: conversa que começou por anúncio Clique-para-WhatsApp guarda o anúncio e, sem lead, cria o lead na
-- primeira etapa do funil padrão ("Lead de anúncio / início de conversa"), com origem anúncio. Só o servidor chama.
create or replace function public.wa_ad_referral(p_connection uuid, p_chat text, p_source_id text, p_headline text, p_url text, p_ctwa text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.wa_conversations;
  v_pipe uuid;
  v_stage uuid;
  v_lead uuid;
  v_campaign text;
  v_ad text;
begin
  select * into v from public.wa_conversations where connection_id = p_connection and chat_id = p_chat and kind = 'contato' for update;
  if v.id is null then return null; end if;
  if v.ad_at is null then
    update public.wa_conversations set ad_source_id = left(p_source_id, 64), ad_headline = left(p_headline, 300),
      ad_source_url = case when p_url ~ '^https://' then left(p_url, 1000) end, ad_ctwa_clid = left(p_ctwa, 300), ad_at = now()
     where id = v.id;
  end if;
  if v.lead_id is not null then return v.lead_id; end if;
  if v.phone is not null then
    select id into v_lead from public.leads where organization_id = v.organization_id and phone = v.phone;
  end if;
  if v_lead is null then
    select a.name, c.name into v_ad, v_campaign
      from public.ads a join public.ad_accounts acc on acc.id = a.ad_account_id
      left join public.ad_campaigns c on c.id = a.campaign_id
     where acc.organization_id = v.organization_id and a.external_id = p_source_id limit 1;
    select p.id into v_pipe from public.pipelines p where p.organization_id = v.organization_id order by p.is_default desc, p.position, p.created_at limit 1;
    select s.id into v_stage from public.pipeline_stages s where s.pipeline_id = v_pipe order by s.position limit 1;
    if v_stage is null then return null; end if;
    insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source, utm_source, utm_medium, utm_campaign, utm_content, owner_id, created_by, notes)
    values (v.organization_id, v_pipe, v_stage, left(coalesce(nullif(btrim(v.contact_name), ''), v.phone, 'Contato do anúncio'), 120), v.phone, 'anuncio',
            'meta', 'clique_whatsapp', left(v_campaign, 200), left(coalesce(v_ad, p_headline, p_source_id), 200), v.assignee_id, null,
            'Chegou pelo anúncio Clique-para-WhatsApp' || coalesce(': ' || coalesce(v_ad, p_headline), '') || '.')
    returning id into v_lead;
  end if;
  update public.wa_conversations set lead_id = v_lead where id = v.id;
  return v_lead;
end;
$$;
revoke all on function public.wa_ad_referral(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.wa_ad_referral(uuid, text, text, text, text, text) to service_role;

-- Mensagem nova do contato traz de volta a conversa apagada.
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
    status = case when new.from_me then status else 'aberta' end,
    deleted_at = case when new.from_me then deleted_at else null end
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
