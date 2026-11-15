-- Etapa 05, parte 1: conexões com a Meta e o Google e as contas encontradas (RF-ADS-01/02, RF-AGE-03).
--
-- Conexões:
--   agência  (owner_kind = 'agency'): Meta (BM da Extend, por login ou token de usuário do sistema)
--                                     e Google Ads (conta Google que acessa a MCC). Uma de cada.
--   pessoa   (owner_kind = 'user'):   Google Agenda de cada pessoa e o Facebook de cada gestor
--                                     (contas de clientes que não estão no BM da Extend).
-- Os tokens ficam cifrados (AES-256-GCM, chave TOKEN_ENCRYPTION_KEY) e a tabela não tem grant para
-- ninguém: só o servidor (chave secreta) lê e grava. A tela usa integration_status(), sem tokens.

create table public.integration_connections (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  provider          text not null check (provider in ('meta', 'google')),
  purpose           text not null check (purpose in ('ads', 'calendar')),
  owner_kind        text not null check (owner_kind in ('agency', 'user')),
  profile_id        uuid references public.profiles (id) on delete cascade,
  method            text not null default 'oauth' check (method in ('oauth', 'system_user')),
  account_name      text,
  account_email     text,
  external_user_id  text,
  scopes            text[] not null default '{}',
  token_enc         text not null,
  refresh_token_enc text,
  expires_at        timestamptz,
  status            text not null default 'active' check (status in ('active', 'expired', 'error')),
  last_error        text,
  last_checked_at   timestamptz,
  accounts_synced_at timestamptz,
  connected_by      uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((owner_kind = 'agency') = (profile_id is null)),
  check (not (provider = 'meta' and purpose = 'calendar'))
);
create unique index integration_connections_agency on public.integration_connections (organization_id, provider, purpose) where owner_kind = 'agency';
create unique index integration_connections_user on public.integration_connections (profile_id, provider, purpose) where owner_kind = 'user';
create trigger integration_connections_updated_at before update on public.integration_connections for each row execute function private.set_updated_at();
create trigger audit_integration_connections after insert or update or delete on public.integration_connections
  for each row execute function private.audit_row('token_enc,refresh_token_enc', 'status,account_name,account_email,method,expires_at');
alter table public.integration_connections enable row level security;
revoke all on public.integration_connections from anon, authenticated;

-- BMs da Meta e MCCs do Google encontrados nas conexões.
create table public.ad_managers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider        text not null check (provider in ('meta', 'google')),
  external_id     text not null,
  name            text not null,
  connection_id   uuid references public.integration_connections (id) on delete set null,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);
alter table public.ad_managers enable row level security;
create policy ad_managers_select on public.ad_managers for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('ads.connect')));
revoke all on public.ad_managers from anon, authenticated;
grant select on public.ad_managers to authenticated;

-- Contas de anúncio encontradas. Só entram na sincronização as marcadas (is_enabled) e ligadas a um cliente.
create table public.ad_accounts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  provider          text not null check (provider in ('meta', 'google')),
  external_id       text not null,
  name              text not null,
  currency          text,
  status_label      text,
  manager_id        uuid references public.ad_managers (id) on delete set null,
  -- Google: a MCC pela qual a conta responde (login-customer-id), guardada por conta.
  login_customer_id text,
  connection_id     uuid references public.integration_connections (id) on delete set null,
  client_id         uuid references public.clients (id) on delete set null,
  is_enabled        boolean not null default false,
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  check (not is_enabled or client_id is not null)
);
create index ad_accounts_client on public.ad_accounts (client_id) where client_id is not null;
create trigger ad_accounts_updated_at before update on public.ad_accounts for each row execute function private.set_updated_at();
create trigger audit_ad_accounts after update on public.ad_accounts
  for each row execute function private.audit_row('', 'client_id,is_enabled');
alter table public.ad_accounts enable row level security;
-- Quem conecta vê todas; quem lê anúncios vê as contas dos clientes que acessa.
create policy ad_accounts_select on public.ad_accounts for select to authenticated
  using (organization_id = (select private.org_id())
         and ((select private.has_perm('ads.connect')) or (client_id is not null and private.can_client('ads.read', client_id))));
revoke all on public.ad_accounts from anon, authenticated;
grant select on public.ad_accounts to authenticated;

-- Situação das conexões, sem tokens: as da agência (para quem lê ou conecta anúncios) e as da própria pessoa.
create or replace function public.integration_status()
returns table (
  id uuid, provider text, purpose text, owner_kind text, method text, account_name text, account_email text,
  status text, last_error text, expires_at timestamptz, accounts_synced_at timestamptz, connected_by_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.provider, c.purpose, c.owner_kind, c.method, c.account_name, c.account_email,
         case when c.status = 'active' and c.expires_at is not null and c.expires_at < now() and c.refresh_token_enc is null then 'expired' else c.status end,
         c.last_error, c.expires_at, c.accounts_synced_at, p.full_name, c.created_at
    from public.integration_connections c
    left join public.profiles p on p.id = c.connected_by
   where c.organization_id = private.org_id()
     and ((c.owner_kind = 'agency' and (private.has_perm('ads.connect') or private.has_perm('ads.read') or private.has_perm('integrations.manage')))
          or c.profile_id = auth.uid());
$$;
revoke all on function public.integration_status() from public, anon;
grant execute on function public.integration_status() to authenticated;

-- Escolher se a conta entra e a qual cliente pertence. Ao ligar, a conta aparece em "Contas e acessos" do cliente.
create or replace function public.save_ad_account(p_id uuid, p_enabled boolean, p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.ad_accounts;
  v_kind text;
begin
  if not private.has_perm('ads.connect') then
    raise exception 'Você não tem permissão para configurar as contas de anúncio.' using errcode = '42501';
  end if;
  select * into v_acc from public.ad_accounts where id = p_id and organization_id = private.org_id();
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and organization_id = v_acc.organization_id and deleted_at is null) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  if p_enabled and p_client is null then
    raise exception 'Escolha o cliente antes de incluir a conta.' using errcode = 'P0001';
  end if;
  update public.ad_accounts set is_enabled = p_enabled, client_id = p_client where id = p_id;

  if p_client is not null then
    v_kind := case v_acc.provider when 'meta' then 'ad_account_meta' else 'ad_account_google' end;
    if not exists (select 1 from public.client_accounts a where a.client_id = p_client and a.kind = v_kind
                    and regexp_replace(a.value, '\D', '', 'g') = regexp_replace(v_acc.external_id, '\D', '', 'g')) then
      insert into public.client_accounts (client_id, kind, value, label) values (p_client, v_kind, v_acc.external_id, v_acc.name);
    end if;
  end if;
end;
$$;
revoke all on function public.save_ad_account(uuid, boolean, uuid) from public, anon;
grant execute on function public.save_ad_account(uuid, boolean, uuid) to authenticated;

-- Aviso de conexão da agência vencendo (Meta por login dura ~60 dias) ou com erro: quem pode conectar é avisado.
create or replace function private.integrations_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_users uuid[];
  v_name text;
begin
  for r in
    select c.* from public.integration_connections c
     where c.owner_kind = 'agency'
       and (c.status <> 'active'
            or (c.refresh_token_enc is null and c.expires_at is not null and c.expires_at < now() + interval '7 days'))
  loop
    select array_agg(p.id) into v_users from public.profiles p
     where p.organization_id = r.organization_id and p.is_active and p.portal_client_id is null
       and private.user_perm_scope(p.id, 'ads.connect') is not null;
    continue when v_users is null;
    v_name := case r.provider when 'meta' then 'Meta (Facebook e Instagram)' else 'Google Ads' end;
    perform public.notify_users(v_users, 'ad_alert',
      case when r.status <> 'active' or r.expires_at < now() then 'Conexão com ' || v_name || ' parou'
           else 'Conexão com ' || v_name || ' vence em ' || greatest(1, extract(day from r.expires_at - now())::int) || ' dias' end,
      coalesce(r.last_error, 'Reconecte em Configurações › Integrações para os dados continuarem chegando.'),
      '/configuracoes/integracoes',
      -- parada: lembra uma vez por dia; vencendo: avisa uma vez.
      'integracao:' || r.id || ':' || case when r.status <> 'active' or r.expires_at < now()
        then 'parada:' || to_char(private.today_sp(), 'YYYY-MM-DD') else 'vence:' || to_char(r.expires_at, 'YYYY-MM-DD') end,
      null);
  end loop;
end;
$$;
revoke all on function private.integrations_tick() from public, anon, authenticated;
select cron.schedule('extend-integracoes', '0 12 * * *', $$select private.integrations_tick()$$);

-- Avisa todas as pessoas ativas que têm uma permissão (usada pelo servidor, ex.: conexão da agência desligada).
create or replace function public.notify_perm_holders(p_org uuid, p_perm text, p_kind text, p_title text, p_body text, p_href text, p_dedupe text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  select array_agg(p.id) into v_users from public.profiles p
   where p.organization_id = p_org and p.is_active and p.portal_client_id is null
     and private.user_perm_scope(p.id, p_perm) is not null;
  if v_users is null then return 0; end if;
  return public.notify_users(v_users, p_kind, p_title, p_body, p_href, p_dedupe, p_actor);
end;
$$;
revoke all on function public.notify_perm_holders(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.notify_perm_holders(uuid, text, text, text, text, text, text, uuid) to service_role;

-- Google Agenda (RF-AGE-03): evento do sistema ↔ evento criado na agenda de cada participante conectado.
-- Sem cascata no evento: o servidor apaga na agenda do Google antes de apagar o vínculo.
create table public.calendar_event_links (
  event_id        uuid not null,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  connection_id   uuid references public.integration_connections (id) on delete set null,
  google_event_id text not null,
  synced_at       timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.calendar_event_links enable row level security;
revoke all on public.calendar_event_links from anon, authenticated;
