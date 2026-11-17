-- Páginas do Facebook e Instagram dos clientes (RF-CON-02): encontradas pela conexão da Meta (a da agência, pelo BM
-- da Extend, ou o Facebook do cliente), ligadas ao cliente por quem conecta as integrações, com os números do perfil e
-- as últimas publicações. Nenhum token novo é guardado: o da página é pedido à Meta na hora, com o token da conexão.

create table public.social_profiles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  connection_id    uuid references public.integration_connections (id) on delete set null,
  platform         text not null check (platform in ('facebook', 'instagram')),
  external_id      text not null check (char_length(external_id) between 1 and 64),
  -- Instagram: a página do Facebook ligada a ele (por onde a Meta dá acesso).
  page_external_id text check (char_length(page_external_id) <= 64),
  name             text not null check (char_length(name) between 1 and 300),
  username         text check (char_length(username) <= 100),
  picture_url      text,
  followers        integer,
  media_count      integer,
  client_id        uuid references public.clients (id) on delete set null,
  last_seen_at     timestamptz not null default now(),
  posts_synced_at  timestamptz,
  sync_error       text check (char_length(sync_error) <= 500),
  unique (organization_id, platform, external_id)
);
create index social_profiles_client on public.social_profiles (client_id) where client_id is not null;

create table public.social_posts (
  profile_id    uuid not null references public.social_profiles (id) on delete cascade,
  external_id   text not null check (char_length(external_id) between 1 and 100),
  media_type    text,
  caption       text check (char_length(caption) <= 5000),
  image_url     text,
  permalink     text,
  published_at  timestamptz not null,
  likes         integer,
  comments      integer,
  shares        integer,
  primary key (profile_id, external_id)
);
create index social_posts_recent on public.social_posts (profile_id, published_at desc);

alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
revoke all on public.social_profiles, public.social_posts from anon, authenticated;
grant select on public.social_profiles, public.social_posts to authenticated;

-- Perfil do cliente: quem vê o cliente. Sem cliente: só quem conecta as integrações (para escolher o cliente).
create or replace function private.can_see_social_profile(p_org uuid, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org = private.org_id()
     and (private.has_perm('ads.connect') or (p_client is not null and private.can_client('clients.read', p_client)));
$$;
revoke all on function private.can_see_social_profile(uuid, uuid) from public, anon;
grant execute on function private.can_see_social_profile(uuid, uuid) to authenticated;

create policy social_profiles_select on public.social_profiles for select to authenticated
  using ((select private.can_see_social_profile(organization_id, client_id)));
create policy social_posts_select on public.social_posts for select to authenticated
  using (exists (select 1 from public.social_profiles p where p.id = profile_id));

-- Liga (ou desliga) o perfil a um cliente. Quem conecta as integrações (admin e gerente de tráfego).
create or replace function public.save_social_profile(p_id uuid, p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.social_profiles;
  v_kind text;
  v_value text;
begin
  if not private.has_perm('ads.connect') then
    raise exception 'Você não tem permissão para ligar páginas e perfis aos clientes.' using errcode = '42501';
  end if;
  select * into v from public.social_profiles where id = p_id and organization_id = private.org_id();
  if not found then raise exception 'Página ou perfil não encontrado.' using errcode = 'P0002'; end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and organization_id = v.organization_id and deleted_at is null) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  update public.social_profiles set client_id = p_client where id = p_id;
  if p_client is null or p_client is not distinct from v.client_id then return; end if;
  -- Entra em "Contas e acessos" do cliente (links rápidos), se ainda não estiver lá.
  v_kind := case v.platform when 'instagram' then 'instagram' else 'page' end;
  v_value := case v.platform when 'instagram' then 'https://www.instagram.com/' || coalesce(v.username, '') else 'https://www.facebook.com/' || v.external_id end;
  if (v.platform = 'facebook' or v.username is not null)
     and not exists (select 1 from public.client_accounts a where a.client_id = p_client and a.kind = v_kind) then
    insert into public.client_accounts (client_id, kind, value, label) values (p_client, v_kind, v_value, left(v.name, 80));
  end if;
end;
$$;
revoke all on function public.save_social_profile(uuid, uuid) from public, anon;
grant execute on function public.save_social_profile(uuid, uuid) to authenticated;

-- Atualizar agora (aba Redes sociais): quem vê o cliente pode pedir; a sincronização roda no servidor.
create or replace function public.can_refresh_social(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.clients c where c.id = p_client and c.organization_id = private.org_id() and c.deleted_at is null)
          and private.can_client('clients.read', p_client) $$;
revoke all on function public.can_refresh_social(uuid) from public, anon;
grant execute on function public.can_refresh_social(uuid) to authenticated;

-- Publicações: 2 vezes por dia (8h05 e 16h05 em Brasília).
select cron.schedule('extend-redes-sync', '5 11,19 * * *', $$select private.call_job('social-sync')$$);
