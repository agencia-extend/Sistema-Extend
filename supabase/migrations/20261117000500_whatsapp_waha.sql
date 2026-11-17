-- WhatsApp por QR Code (WAHA, RF-WPP-01/02 e RF-ALE-02): uma conexão por organização (o número da Extend),
-- os grupos do número (ligados a clientes ou marcados como grupo de alertas internos), as mensagens recebidas
-- pelo webhook e o registro de envios. O endereço do servidor WAHA e a chave ficam no banco (chave cifrada),
-- para trocar de máquina local para VPS sem novo deploy. Só o servidor (chave secreta) lê tokens.

create table public.whatsapp_connections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null unique references public.organizations (id) on delete cascade,
  base_url         text not null check (base_url ~ '^https?://'),
  api_key_enc      text not null,
  session          text not null default 'extend' check (session ~ '^[a-z0-9_-]{2,40}$'),
  webhook_secret_enc text not null,
  status           text not null default 'STOPPED',
  me_id            text,
  me_name          text,
  last_error       text,
  last_event_at    timestamptz,
  connected_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger whatsapp_connections_updated_at before update on public.whatsapp_connections for each row execute function private.set_updated_at();
create trigger audit_whatsapp_connections after insert or update or delete on public.whatsapp_connections
  for each row execute function private.audit_row('api_key_enc,webhook_secret_enc', 'base_url,status,me_id');
alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon, authenticated;

create table public.whatsapp_groups (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.whatsapp_connections (id) on delete cascade,
  jid            text not null check (jid ~ '@g\.us$'),
  name           text not null default '',
  client_id      uuid references public.clients (id) on delete set null,
  is_alerts      boolean not null default false,
  last_seen_at   timestamptz not null default now(),
  unique (connection_id, jid)
);
-- Um grupo de alertas internos por conexão.
create unique index whatsapp_groups_alerts on public.whatsapp_groups (connection_id) where is_alerts;
create index whatsapp_groups_client on public.whatsapp_groups (client_id) where client_id is not null;
alter table public.whatsapp_groups enable row level security;
revoke all on public.whatsapp_groups from anon, authenticated;
grant select on public.whatsapp_groups to authenticated;
create policy whatsapp_groups_select on public.whatsapp_groups for select to authenticated
  using (exists (select 1 from public.whatsapp_connections c where c.id = connection_id and c.organization_id = (select private.org_id()))
         and ((select private.has_perm('integrations.manage')) or (select private.has_perm('inbox.read'))
              or (client_id is not null and (select private.can_client('reports.manage', client_id)))));

-- Mensagens recebidas e enviadas (pelo webhook): base da caixa de entrada.
create table public.whatsapp_messages (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.whatsapp_connections (id) on delete cascade,
  wamid          text not null,
  chat_id        text not null,
  from_me        boolean not null default false,
  author         text,
  author_name    text,
  body           text,
  kind           text not null default 'text',
  sent_at        timestamptz not null,
  created_at     timestamptz not null default now(),
  unique (connection_id, wamid)
);
create index whatsapp_messages_chat on public.whatsapp_messages (connection_id, chat_id, sent_at desc);
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to authenticated;
create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated
  using (exists (select 1 from public.whatsapp_connections c where c.id = connection_id and c.organization_id = (select private.org_id()))
         and (select private.has_perm('inbox.read')));

-- Registro de envios (teste, alerta, relatório): o que saiu, para onde e se falhou.
create table public.whatsapp_outbox (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.whatsapp_connections (id) on delete cascade,
  kind           text not null check (kind in ('teste', 'alerta', 'relatorio')),
  chat_id        text not null,
  chat_name      text,
  body           text not null,
  dedupe_key     text unique,
  ok             boolean,
  error          text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index whatsapp_outbox_recent on public.whatsapp_outbox (connection_id, created_at desc);
alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_outbox from anon, authenticated;
grant select on public.whatsapp_outbox to authenticated;
create policy whatsapp_outbox_select on public.whatsapp_outbox for select to authenticated
  using (exists (select 1 from public.whatsapp_connections c where c.id = connection_id and c.organization_id = (select private.org_id()))
         and (select private.has_perm('integrations.manage')));

-- Situação da conexão sem chaves (tela de Configurações e quem lê conversas).
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
     and (private.has_perm('integrations.manage') or private.has_perm('inbox.read'));
$$;
revoke all on function public.whatsapp_status() from public, anon;
grant execute on function public.whatsapp_status() to authenticated;

-- Liga o grupo a um cliente e/ou marca como grupo de alertas internos (só um por conexão).
create or replace function public.save_whatsapp_group(p_id uuid, p_client uuid, p_alerts boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conn uuid;
begin
  if not private.has_perm('integrations.manage') then
    raise exception 'Você não tem permissão para configurar o WhatsApp.' using errcode = '42501';
  end if;
  select g.connection_id into v_conn from public.whatsapp_groups g join public.whatsapp_connections c on c.id = g.connection_id
   where g.id = p_id and c.organization_id = private.org_id();
  if v_conn is null then
    raise exception 'Grupo não encontrado.' using errcode = 'P0002';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and organization_id = private.org_id() and deleted_at is null) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  if p_alerts then
    update public.whatsapp_groups set is_alerts = false where connection_id = v_conn and id <> p_id and is_alerts;
  end if;
  update public.whatsapp_groups set client_id = p_client, is_alerts = p_alerts where id = p_id;
end;
$$;
revoke all on function public.save_whatsapp_group(uuid, uuid, boolean) from public, anon;
grant execute on function public.save_whatsapp_group(uuid, uuid, boolean) to authenticated;

-- Encaminhar alertas de anúncios ao grupo interno (RF-ALE-02): a cada 5 minutos o servidor pega os
-- alertas novos (um por chave de deduplicação) e manda para o grupo marcado como "alertas internos".
select cron.schedule('extend-whatsapp-alertas', '*/5 * * * *', $$select private.call_job('whatsapp-alerts')$$);

-- Retenção: mensagens com mais de 1 ano e envios com mais de 90 dias saem.
create or replace function private.whatsapp_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.whatsapp_messages where sent_at < now() - interval '1 year';
  delete from public.whatsapp_outbox where created_at < now() - interval '90 days';
$$;
revoke all on function private.whatsapp_cleanup() from public, anon, authenticated;
select cron.schedule('extend-whatsapp-limpeza', '40 4 * * *', $$select private.whatsapp_cleanup()$$);
