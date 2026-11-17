-- Performance por criativo na biblioteca (RF-BIB-03) e sugestão de "fadigado" (RF-BIB-02).
-- Cada criativo ganha um código (CR-42). Anúncio da Meta com o código no nome é ligado sozinho na sincronização;
-- o tráfego também liga e desliga à mão. Os números vêm de ad_insights_daily (nível anúncio) dos anúncios ligados
-- e são vistos por quem vê o criativo na biblioteca (equipe de mídias incluída), por uma função que soma tudo.

alter table public.creative_library add column ref_number bigint generated always as identity;
create unique index creative_library_ref_number on public.creative_library (ref_number);

-- ThruPlays (vídeo assistido até o fim ou 15 s) para o hold rate.
alter table public.ad_insights_daily add column thruplays integer not null default 0;

create table public.creative_ads (
  library_id uuid not null references public.creative_library (id) on delete cascade,
  ad_id      uuid not null references public.ads (id) on delete cascade,
  source     text not null check (source in ('codigo', 'manual')),
  -- Desligado à mão: a sincronização não religa pelo código.
  excluded   boolean not null default false,
  linked_by  uuid references public.profiles (id) on delete set null,
  linked_at  timestamptz not null default now(),
  primary key (library_id, ad_id)
);
create index creative_ads_ad on public.creative_ads (ad_id);
alter table public.creative_ads enable row level security;
revoke all on public.creative_ads from anon, authenticated;
grant select on public.creative_ads to authenticated;
-- Vê a ligação quem vê o criativo e a conta do anúncio (as duas RLS valem dentro do exists).
create policy creative_ads_select on public.creative_ads for select to authenticated
  using (exists (select 1 from public.creative_library l where l.id = library_id)
         and exists (select 1 from public.ads a where a.id = ad_id));

-- Quem vê os números do criativo: vê o criativo na biblioteca (mesma regra da política creative_library_select)
-- e tem "Ver performance dos criativos" no cliente (tráfego, social media, edição e design).
create or replace function private.can_see_creative_perf(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_client('clients.read', p_client)
     and (private.has_perm('creatives.request.create') or private.has_perm('creatives.produce')
          or private.has_perm('creatives.review') or private.has_perm('creatives.library.manage'))
     and private.can_client('creatives.performance.read', p_client);
$$;

-- Quem liga anúncios ao criativo: o tráfego do cliente ou quem organiza a biblioteca.
create or replace function private.can_link_creative(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_client('clients.read', p_client)
     and (private.can_client('ads.manage', p_client) or private.has_perm('creatives.library.manage') or private.has_perm('creatives.review'));
$$;
revoke all on function private.can_see_creative_perf(uuid), private.can_link_creative(uuid) from public, anon;

-- Liga pelo código no nome do anúncio (CR42, CR-42, cr-0042…), só anúncios das contas do mesmo cliente.
create or replace function private.link_creatives_by_code(p_account uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.creative_ads (library_id, ad_id, source)
  select l.id, a.id, 'codigo'
    from public.ads a
    join public.ad_accounts acc on acc.id = a.ad_account_id and acc.client_id is not null
    join public.creative_library l on l.client_id = acc.client_id
   where (p_account is null or a.ad_account_id = p_account)
     and a.name ~* ('(^|[^a-z0-9])cr-?0*' || l.ref_number || '([^0-9]|$)')
  on conflict (library_id, ad_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function private.link_creatives_by_code(uuid) from public, anon, authenticated;

-- Chamada pela sincronização depois de gravar os anúncios.
create or replace function public.sync_link_creatives(p_account uuid)
returns integer
language sql
security definer
set search_path = ''
as $$ select private.link_creatives_by_code(p_account) $$;
revoke all on function public.sync_link_creatives(uuid) from public, anon, authenticated;
grant execute on function public.sync_link_creatives(uuid) to service_role;

create or replace function public.link_creative_ad(p_library uuid, p_ad uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_ad_client uuid;
begin
  select l.client_id into v_client from public.creative_library l
    join public.clients c on c.id = l.client_id and c.organization_id = private.org_id()
   where l.id = p_library;
  if v_client is null then raise exception 'Criativo não encontrado.' using errcode = 'P0002'; end if;
  if not private.can_link_creative(v_client) then
    raise exception 'Só o tráfego do cliente ou quem organiza a biblioteca liga anúncios.' using errcode = '42501';
  end if;
  select acc.client_id into v_ad_client from public.ads a join public.ad_accounts acc on acc.id = a.ad_account_id where a.id = p_ad;
  if v_ad_client is null or v_ad_client <> v_client then
    raise exception 'Este anúncio não é de uma conta deste cliente.' using errcode = 'P0001';
  end if;
  insert into public.creative_ads (library_id, ad_id, source, linked_by)
  values (p_library, p_ad, 'manual', auth.uid())
  on conflict (library_id, ad_id) do update set excluded = false, source = 'manual', linked_by = auth.uid(), linked_at = now();
end;
$$;

create or replace function public.unlink_creative_ad(p_library uuid, p_ad uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  select l.client_id into v_client from public.creative_library l
    join public.clients c on c.id = l.client_id and c.organization_id = private.org_id()
   where l.id = p_library;
  if v_client is null then raise exception 'Criativo não encontrado.' using errcode = 'P0002'; end if;
  if not private.can_link_creative(v_client) then
    raise exception 'Só o tráfego do cliente ou quem organiza a biblioteca desliga anúncios.' using errcode = '42501';
  end if;
  -- Fica marcado como desligado para o código no nome não religar na próxima sincronização.
  update public.creative_ads set excluded = true, linked_by = auth.uid(), linked_at = now()
   where library_id = p_library and ad_id = p_ad and not excluded;
  if not found then raise exception 'Este anúncio não está ligado ao criativo.' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.link_creative_ad(uuid, uuid), public.unlink_creative_ad(uuid, uuid) from public, anon;
grant execute on function public.link_creative_ad(uuid, uuid), public.unlink_creative_ad(uuid, uuid) to authenticated;

-- Números somados dos anúncios ligados, por criativo, no período (sem datas: tudo o que foi sincronizado).
-- Só devolve os criativos cujos números a pessoa pode ver. fatigued: algum anúncio ligado com alerta de fadiga em aberto.
create or replace function public.creative_performance(p_ids uuid[], p_since date default null, p_until date default null)
returns table (
  library_id uuid, ads integer, active_ads integer, spend_cents bigint, impressions bigint, clicks bigint, link_clicks bigint,
  leads bigint, messages bigint, purchases bigint, purchase_value_cents bigint, video_views bigint, thruplays bigint,
  days_live integer, first_day date, last_day date, frequency numeric, fatigued boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with lib as (
    select l.id, l.client_id from public.creative_library l
      join public.clients c on c.id = l.client_id and c.organization_id = private.org_id()
     where l.id = any(p_ids) and private.can_see_creative_perf(l.client_id)
  ), links as (
    select ca.library_id, a.id as ad_id, a.ad_account_id, a.external_id, a.effective_status, a.frequency_7d
      from public.creative_ads ca join lib on lib.id = ca.library_id
      join public.ads a on a.id = ca.ad_id
     where not ca.excluded
  ), days as (
    select k.library_id, i.date, sum(i.spend_cents) as spend_cents, sum(i.impressions) as impressions, sum(i.clicks) as clicks,
           sum(i.link_clicks) as link_clicks, sum(i.leads) as leads, sum(i.messages) as messages, sum(i.purchases) as purchases,
           sum(i.purchase_value_cents) as purchase_value_cents, sum(i.video_views) as video_views, sum(i.thruplays) as thruplays
      from links k
      join public.ad_insights_daily i on i.ad_account_id = k.ad_account_id and i.level = 'ad' and i.object_external_id = k.external_id
     where (p_since is null or i.date >= p_since) and (p_until is null or i.date <= p_until)
     group by k.library_id, i.date
  )
  select lib.id,
         (select count(*)::int from links k where k.library_id = lib.id),
         (select count(*)::int from links k where k.library_id = lib.id and k.effective_status = 'ACTIVE'),
         coalesce(sum(d.spend_cents), 0)::bigint, coalesce(sum(d.impressions), 0)::bigint, coalesce(sum(d.clicks), 0)::bigint,
         coalesce(sum(d.link_clicks), 0)::bigint, coalesce(sum(d.leads), 0)::bigint, coalesce(sum(d.messages), 0)::bigint,
         coalesce(sum(d.purchases), 0)::bigint, coalesce(sum(d.purchase_value_cents), 0)::bigint,
         coalesce(sum(d.video_views), 0)::bigint, coalesce(sum(d.thruplays), 0)::bigint,
         (count(d.date) filter (where d.spend_cents > 0))::int,
         min(d.date) filter (where d.spend_cents > 0), max(d.date) filter (where d.spend_cents > 0),
         (select max(k.frequency_7d) from links k where k.library_id = lib.id),
         exists (select 1 from links k join public.ad_alerts al on al.kind = 'fadiga' and al.subject = k.ad_id::text and al.status <> 'resolvido'
                  where k.library_id = lib.id)
    from lib left join days d on d.library_id = lib.id
   group by lib.id;
$$;
revoke all on function public.creative_performance(uuid[], date, date) from public, anon;
grant execute on function public.creative_performance(uuid[], date, date) to authenticated;

-- Anúncios ligados a um criativo (para a página do criativo), visíveis a quem vê o criativo.
create or replace function public.creative_linked_ads(p_library uuid)
returns table (ad_id uuid, name text, effective_status text, thumbnail_url text, account_name text, campaign_name text, source text, frequency numeric, fatigued boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.effective_status, a.thumbnail_url, acc.name, cp.name, ca.source, a.frequency_7d,
         exists (select 1 from public.ad_alerts al where al.kind = 'fadiga' and al.subject = a.id::text and al.status <> 'resolvido')
    from public.creative_ads ca
    join public.creative_library l on l.id = ca.library_id
    join public.clients c on c.id = l.client_id and c.organization_id = private.org_id()
    join public.ads a on a.id = ca.ad_id
    join public.ad_accounts acc on acc.id = a.ad_account_id
    left join public.ad_campaigns cp on cp.id = a.campaign_id
   where ca.library_id = p_library and not ca.excluded and private.can_see_creative_perf(l.client_id)
   order by (a.effective_status = 'ACTIVE') desc, a.name;
$$;
revoke all on function public.creative_linked_ads(uuid) from public, anon;
grant execute on function public.creative_linked_ads(uuid) to authenticated;

-- Anúncios do cliente que ainda não estão ligados ao criativo (para ligar à mão). Só para quem pode ligar.
create or replace function public.creative_linkable_ads(p_library uuid)
returns table (ad_id uuid, name text, effective_status text, account_name text, campaign_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.effective_status, acc.name, cp.name
    from public.creative_library l
    join public.clients c on c.id = l.client_id and c.organization_id = private.org_id()
    join public.ad_accounts acc on acc.client_id = l.client_id
    join public.ads a on a.ad_account_id = acc.id
    left join public.ad_campaigns cp on cp.id = a.campaign_id
   where l.id = p_library and private.can_link_creative(l.client_id)
     and not exists (select 1 from public.creative_ads ca where ca.library_id = l.id and ca.ad_id = a.id and not ca.excluded)
   order by (a.effective_status = 'ACTIVE') desc, a.last_seen_at desc, a.name
   limit 300;
$$;
revoke all on function public.creative_linkable_ads(uuid) from public, anon;
grant execute on function public.creative_linkable_ads(uuid) to authenticated;

-- Liga o que já existe (anúncios sincronizados com o código no nome).
select private.link_creatives_by_code(null);
