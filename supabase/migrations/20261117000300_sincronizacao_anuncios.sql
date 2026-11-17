-- Etapa 05, fase 3 (RF-ADS-03/04): sincronização das contas de anúncio ligadas ("Entra no sistema").
-- O servidor (chave secreta) grava; a equipe lê pela RLS: quem conecta vê tudo, quem lê anúncios vê os
-- clientes que acessa. Dinheiro em centavos na moeda da conta.

-- Situação e saldo da conta, atualizados a cada sincronização.
alter table public.ad_accounts
  add column account_status_code int,
  add column disable_reason int,
  add column timezone text,
  add column is_prepay boolean,
  add column balance_cents bigint,
  add column funds_cents bigint,
  add column funding_display text,
  add column amount_spent_cents bigint,
  add column spend_cap_cents bigint,
  add column synced_at timestamptz,
  add column sync_error text;

-- Quem vê os dados de uma conta (usado nas políticas abaixo).
create or replace function private.can_see_ad_account(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ad_accounts a
     where a.id = p_account and a.organization_id = private.org_id()
       and (private.has_perm('ads.connect') or (a.client_id is not null and private.can_client('ads.read', a.client_id)))
  );
$$;
revoke all on function private.can_see_ad_account(uuid) from public, anon;
grant execute on function private.can_see_ad_account(uuid) to authenticated;

create table public.ad_campaigns (
  id                   uuid primary key default gen_random_uuid(),
  ad_account_id        uuid not null references public.ad_accounts (id) on delete cascade,
  external_id          text not null,
  name                 text not null,
  objective            text,
  status               text,
  effective_status     text,
  daily_budget_cents   bigint,
  lifetime_budget_cents bigint,
  starts_at            timestamptz,
  ends_at              timestamptz,
  last_seen_at         timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create table public.ad_sets (
  id                   uuid primary key default gen_random_uuid(),
  ad_account_id        uuid not null references public.ad_accounts (id) on delete cascade,
  campaign_id          uuid references public.ad_campaigns (id) on delete cascade,
  external_id          text not null,
  name                 text not null,
  effective_status     text,
  optimization_goal    text,
  daily_budget_cents   bigint,
  lifetime_budget_cents bigint,
  last_seen_at         timestamptz not null default now(),
  unique (ad_account_id, external_id)
);
create index ad_sets_campaign on public.ad_sets (campaign_id);

create table public.ads (
  id                   uuid primary key default gen_random_uuid(),
  ad_account_id        uuid not null references public.ad_accounts (id) on delete cascade,
  campaign_id          uuid references public.ad_campaigns (id) on delete cascade,
  ad_set_id            uuid references public.ad_sets (id) on delete cascade,
  external_id          text not null,
  name                 text not null,
  effective_status     text,
  creative_external_id text,
  thumbnail_url        text,
  review_feedback      text,
  last_seen_at         timestamptz not null default now(),
  unique (ad_account_id, external_id)
);
create index ads_campaign on public.ads (campaign_id);

-- Números por dia (dia na fuso da conta). level: account, campaign ou ad.
create table public.ad_insights_daily (
  ad_account_id        uuid not null references public.ad_accounts (id) on delete cascade,
  level                text not null check (level in ('account', 'campaign', 'ad')),
  object_external_id   text not null,
  date                 date not null,
  spend_cents          bigint not null default 0,
  impressions          bigint not null default 0,
  reach                bigint not null default 0,
  clicks               bigint not null default 0,
  link_clicks          bigint not null default 0,
  leads                integer not null default 0,
  messages             integer not null default 0,
  purchases            integer not null default 0,
  purchase_value_cents bigint not null default 0,
  landing_page_views   integer not null default 0,
  video_views          integer not null default 0,
  primary key (ad_account_id, level, object_external_id, date)
);
create index ad_insights_daily_date on public.ad_insights_daily (ad_account_id, level, date);

-- Registro de cada sincronização (falhas aparecem na tela e avisam quem conecta).
create table public.ad_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  trigger       text not null check (trigger in ('cron', 'manual')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean,
  error         text,
  counts        jsonb not null default '{}'
);
create index ad_sync_runs_account on public.ad_sync_runs (ad_account_id, started_at desc);

do $$
declare t text;
begin
  foreach t in array array['ad_campaigns', 'ad_sets', 'ads', 'ad_insights_daily', 'ad_sync_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.can_see_ad_account(ad_account_id)))', t || '_select', t);
  end loop;
end $$;

-- Retenção: sincronizações com mais de 60 dias saem (os números ficam).
create or replace function private.ad_sync_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ad_sync_runs where started_at < now() - interval '60 days';
$$;
revoke all on function private.ad_sync_cleanup() from public, anon, authenticated;

-- A cada 3 horas (UTC 0, 3, 9, 12, 15, 18 e 21 = 21h, 0h, 6h, 9h, 12h, 15h e 18h em São Paulo).
select cron.schedule('extend-anuncios-sync', '5 0,3,9,12,15,18,21 * * *', $$select private.call_job('ads-sync')$$);
select cron.schedule('extend-anuncios-limpeza', '30 4 * * *', $$select private.ad_sync_cleanup()$$);
