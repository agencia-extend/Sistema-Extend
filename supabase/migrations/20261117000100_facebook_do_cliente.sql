-- Facebook do cliente: conexão da Meta que pertence a um cliente (owner_kind = 'client').
-- Para contas de anúncio que estão no perfil do cliente e não no BM da Extend. Dois jeitos de conectar:
--   1. o gestor conecta na aba Tráfego do cliente, entrando com o Facebook do cliente;
--   2. o gestor gera um link e o próprio cliente autoriza, sem login no sistema (client_connect_links).
-- O token continua cifrado e sem grant (só o servidor lê). As contas encontradas já ficam com o cliente.
-- Quem gerencia: quem tem ads.manage no cliente (gestor do cliente, gerente de tráfego, admin).

alter table public.integration_connections
  add column client_id uuid references public.clients (id) on delete cascade;

alter table public.integration_connections drop constraint integration_connections_check;
alter table public.integration_connections drop constraint integration_connections_owner_kind_check;
alter table public.integration_connections
  add constraint integration_connections_owner_kind_check check (owner_kind in ('agency', 'user', 'client')),
  add constraint integration_connections_owner_check check (
    (owner_kind = 'user') = (profile_id is not null) and (owner_kind = 'client') = (client_id is not null)
  ),
  add constraint integration_connections_client_meta check (owner_kind <> 'client' or (provider = 'meta' and purpose = 'ads'));
create unique index integration_connections_client on public.integration_connections (client_id, provider, purpose) where owner_kind = 'client';
create index integration_connections_client_id on public.integration_connections (client_id) where client_id is not null;

-- Links para o cliente autorizar. Só o hash do código fica no banco; um link aberto por cliente.
create table public.client_connect_links (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  provider       text not null default 'meta' check (provider = 'meta'),
  token_hash     text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  used_at        timestamptz,
  connection_id  uuid references public.integration_connections (id) on delete set null
);
create index client_connect_links_client on public.client_connect_links (client_id, created_at desc);
create trigger audit_client_connect_links after insert or update or delete on public.client_connect_links
  for each row execute function private.audit_row('token_hash', 'revoked_at,used_at');
alter table public.client_connect_links enable row level security;
revoke all on public.client_connect_links from anon, authenticated;
grant select (id, client_id, provider, created_by, created_at, expires_at, revoked_at, used_at) on public.client_connect_links to authenticated;
create policy "tráfego do cliente vê os links" on public.client_connect_links for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('ads.manage', client_id)));

-- Gera o link (o código é sorteado no servidor; aqui chega só o hash). Cancela o link aberto anterior.
create or replace function public.create_client_connect_link(p_client uuid, p_token_hash text, p_days int default 7)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.clients where id = p_client and deleted_at is null and organization_id = private.org_id();
  if v_org is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  if not private.can_client('ads.manage', p_client) then
    raise exception 'Você não tem permissão para conectar o Facebook deste cliente.' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Código inválido.' using errcode = '22023';
  end if;
  update public.client_connect_links set revoked_at = now()
   where client_id = p_client and revoked_at is null and used_at is null;
  insert into public.client_connect_links (organization_id, client_id, token_hash, created_by, expires_at)
  values (v_org, p_client, p_token_hash, auth.uid(), now() + make_interval(days => greatest(1, least(p_days, 30))))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_client_connect_link(uuid, text, int) from public, anon;
grant execute on function public.create_client_connect_link(uuid, text, int) to authenticated;

create or replace function public.revoke_client_connect_link(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.client_connect_links where id = p_id and organization_id = private.org_id();
  if v_client is null then
    raise exception 'Link não encontrado.' using errcode = 'P0002';
  end if;
  if not private.can_client('ads.manage', v_client) then
    raise exception 'Você não tem permissão para cancelar este link.' using errcode = '42501';
  end if;
  update public.client_connect_links set revoked_at = now() where id = p_id and revoked_at is null and used_at is null;
end;
$$;
revoke all on function public.revoke_client_connect_link(uuid) from public, anon;
grant execute on function public.revoke_client_connect_link(uuid) to authenticated;

-- Quem pode conectar/desconectar o Facebook do cliente (usado pelo servidor antes do login da Meta).
create or replace function public.can_manage_client_ads(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clients c where c.id = p_client and c.deleted_at is null and c.organization_id = private.org_id())
     and private.can_client('ads.manage', p_client);
$$;
revoke all on function public.can_manage_client_ads(uuid) from public, anon;
grant execute on function public.can_manage_client_ads(uuid) to authenticated;

-- Situação das conexões, agora com as dos clientes (sem tokens). Quem vê: tráfego do cliente e quem
-- configura as integrações.
drop function public.integration_status();
create function public.integration_status()
returns table (
  id uuid, provider text, purpose text, owner_kind text, method text, account_name text, account_email text,
  status text, last_error text, expires_at timestamptz, accounts_synced_at timestamptz, connected_by_name text, created_at timestamptz,
  client_id uuid, client_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.provider, c.purpose, c.owner_kind, c.method, c.account_name, c.account_email,
         case when c.status = 'active' and c.expires_at is not null and c.expires_at < now() and c.refresh_token_enc is null then 'expired' else c.status end,
         c.last_error, c.expires_at, c.accounts_synced_at, p.full_name, c.created_at, c.client_id, cl.name
    from public.integration_connections c
    left join public.profiles p on p.id = c.connected_by
    left join public.clients cl on cl.id = c.client_id
   where c.organization_id = private.org_id()
     and ((c.owner_kind = 'agency' and (private.has_perm('ads.connect') or private.has_perm('ads.read') or private.has_perm('integrations.manage')))
          or c.profile_id = auth.uid()
          or (c.owner_kind = 'client' and (private.has_perm('ads.connect') or private.can_client('ads.read', c.client_id) or private.can_client('ads.manage', c.client_id))));
$$;
revoke all on function public.integration_status() from public, anon;
grant execute on function public.integration_status() to authenticated;

-- Conta encontrada pelo Facebook do cliente: o tráfego do cliente decide se entra no sistema.
create or replace function public.toggle_client_ad_account(p_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.ad_accounts where id = p_id and organization_id = private.org_id();
  if v_client is null then
    raise exception 'Conta não encontrada ou sem cliente.' using errcode = 'P0002';
  end if;
  if not private.can_client('ads.manage', v_client) then
    raise exception 'Você não tem permissão para configurar as contas deste cliente.' using errcode = '42501';
  end if;
  update public.ad_accounts set is_enabled = p_enabled where id = p_id;
end;
$$;
revoke all on function public.toggle_client_ad_account(uuid, boolean) from public, anon;
grant execute on function public.toggle_client_ad_account(uuid, boolean) to authenticated;

-- Avisos de conexão parada ou vencendo: a da agência vai para quem conecta; a do cliente vai para o
-- tráfego do cliente (quem tem ads.manage nele) e, se ninguém, para quem conecta a agência.
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
  v_href text;
  v_stopped boolean;
begin
  for r in
    select c.*, cl.name as client_name from public.integration_connections c
      left join public.clients cl on cl.id = c.client_id
     where c.owner_kind in ('agency', 'client')
       and (c.owner_kind = 'agency' or (cl.deleted_at is null and cl.status in ('ativo', 'onboarding', 'pausado')))
       and (c.status <> 'active'
            or (c.refresh_token_enc is null and c.expires_at is not null and c.expires_at < now() + interval '7 days'))
  loop
    v_users := null;
    if r.owner_kind = 'client' then
      select array_agg(distinct m.profile_id) into v_users from public.client_members m
        join public.profiles p on p.id = m.profile_id and p.is_active and p.portal_client_id is null
       where m.client_id = r.client_id and private.user_perm_scope(m.profile_id, 'ads.manage') is not null;
    end if;
    if v_users is null then
      select array_agg(p.id) into v_users from public.profiles p
       where p.organization_id = r.organization_id and p.is_active and p.portal_client_id is null
         and private.user_perm_scope(p.id, 'ads.connect') is not null;
    end if;
    continue when v_users is null;
    v_name := case when r.owner_kind = 'client' then 'o Facebook de ' || r.client_name
                   when r.provider = 'meta' then 'Meta (Facebook e Instagram)' else 'Google Ads' end;
    v_href := case when r.owner_kind = 'client' then '/clientes/' || r.client_id || '/trafego#facebook' else '/configuracoes/integracoes' end;
    v_stopped := r.status <> 'active' or r.expires_at < now();
    perform public.notify_users(v_users, 'ad_alert',
      case when v_stopped then 'Conexão com ' || v_name || ' parou'
           else 'Conexão com ' || v_name || ' vence em ' || greatest(1, extract(day from r.expires_at - now())::int) || ' dias' end,
      coalesce(r.last_error, case when r.owner_kind = 'client'
        then 'Reconecte na aba Tráfego do cliente ou envie um novo link para o cliente autorizar.'
        else 'Reconecte em Configurações › Integrações para os dados continuarem chegando.' end),
      v_href,
      'integracao:' || r.id || ':' || case when v_stopped
        then 'parada:' || to_char(private.today_sp(), 'YYYY-MM-DD') else 'vence:' || to_char(r.expires_at, 'YYYY-MM-DD') end,
      null);
  end loop;
end;
$$;
revoke all on function private.integrations_tick() from public, anon, authenticated;
