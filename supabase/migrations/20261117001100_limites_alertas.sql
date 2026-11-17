-- RF-ALE-01: limites dos alertas editáveis (padrão da agência e, se preciso, por cliente), gasto do dia acima do
-- limite e fadiga de criativo (frequência em 7 dias e queda do CTR dos últimos 3 dias contra os 7 anteriores).

alter table public.ad_alerts drop constraint ad_alerts_kind_check;
alter table public.ad_alerts add constraint ad_alerts_kind_check
  check (kind in ('saldo', 'restricao', 'entrega', 'reprovado', 'meta_custo', 'meta_ritmo', 'conexao', 'gasto', 'fadiga'));

-- Frequência dos últimos 7 dias completos por anúncio (a Meta calcula com o alcance único; somar o alcance diário não serve).
alter table public.ads add column frequency_7d numeric(6, 2), add column impressions_7d bigint, add column frequency_at timestamptz;

-- Limites: uma linha sem cliente (padrão da agência) e, se preciso, uma por cliente (substitui o padrão inteiro).
create table public.ad_alert_settings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_id           uuid references public.clients (id) on delete cascade,
  funds_days          integer not null default 3 check (funds_days between 0 and 30),     -- 0: não avisa por dias
  funds_min_cents     bigint check (funds_min_cents > 0),                                   -- avisa abaixo deste saldo
  daily_spend_max_cents bigint check (daily_spend_max_cents > 0),                          -- gasto do dia acima disto
  no_delivery         boolean not null default true,
  fatigue_enabled     boolean not null default true,
  fatigue_frequency   numeric(4, 1) not null default 3.0 check (fatigue_frequency between 1 and 20),
  fatigue_ctr_drop    integer not null default 25 check (fatigue_ctr_drop between 5 and 90), -- % abaixo da média anterior
  updated_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now()
);
create unique index ad_alert_settings_org on public.ad_alert_settings (organization_id) where client_id is null;
create unique index ad_alert_settings_client on public.ad_alert_settings (client_id) where client_id is not null;
create trigger audit_ad_alert_settings after insert or update or delete on public.ad_alert_settings
  for each row execute function private.audit_row('', 'funds_days,funds_min_cents,daily_spend_max_cents,no_delivery,fatigue_enabled,fatigue_frequency,fatigue_ctr_drop');

alter table public.ad_alert_settings enable row level security;
revoke all on public.ad_alert_settings from anon, authenticated;
grant select on public.ad_alert_settings to authenticated;
create policy ad_alert_settings_select on public.ad_alert_settings for select to authenticated
  using (organization_id = (select private.org_id())
         and case when client_id is null then (select private.has_perm('ads.read')) else (select private.can_client('ads.read', client_id)) end);

-- Limites que valem para o cliente: os dele, senão o padrão da agência, senão os do sistema.
create or replace function private.alert_limits(p_org uuid, p_client uuid)
returns public.ad_alert_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.ad_alert_settings;
begin
  if p_client is not null then
    select * into s from public.ad_alert_settings where client_id = p_client;
    if found then return s; end if;
  end if;
  select * into s from public.ad_alert_settings where organization_id = p_org and client_id is null;
  if found then return s; end if;
  s.organization_id := p_org;
  s.funds_days := 3; s.no_delivery := true; s.fatigue_enabled := true; s.fatigue_frequency := 3.0; s.fatigue_ctr_drop := 25;
  return s;
end;
$$;
revoke all on function private.alert_limits(uuid, uuid) from public, anon, authenticated;

-- Salvar limites: do cliente (quem cuida do tráfego dele) ou o padrão da agência (quem conecta as integrações).
create or replace function public.save_alert_limits(
  p_client uuid, p_funds_days integer, p_funds_min_cents bigint, p_daily_spend_max_cents bigint, p_no_delivery boolean,
  p_fatigue_enabled boolean, p_fatigue_frequency numeric, p_fatigue_ctr_drop integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
begin
  if v_org is null then raise exception 'Sem acesso.' using errcode = '42501'; end if;
  if p_client is null then
    if not private.has_perm('ads.connect') then
      raise exception 'Só quem conecta as integrações muda o padrão da agência.' using errcode = '42501';
    end if;
  elsif not private.can_client('ads.manage', p_client) then
    raise exception 'Você não cuida do tráfego deste cliente.' using errcode = '42501';
  end if;
  update public.ad_alert_settings
     set funds_days = p_funds_days, funds_min_cents = p_funds_min_cents, daily_spend_max_cents = p_daily_spend_max_cents,
         no_delivery = p_no_delivery, fatigue_enabled = p_fatigue_enabled, fatigue_frequency = p_fatigue_frequency,
         fatigue_ctr_drop = p_fatigue_ctr_drop, updated_by = auth.uid(), updated_at = now()
   where organization_id = v_org and client_id is not distinct from p_client;
  if not found then
    insert into public.ad_alert_settings (organization_id, client_id, funds_days, funds_min_cents, daily_spend_max_cents, no_delivery,
                                          fatigue_enabled, fatigue_frequency, fatigue_ctr_drop, updated_by)
    values (v_org, p_client, p_funds_days, p_funds_min_cents, p_daily_spend_max_cents, p_no_delivery,
            p_fatigue_enabled, p_fatigue_frequency, p_fatigue_ctr_drop, auth.uid());
  end if;
end;
$$;
revoke all on function public.save_alert_limits(uuid, integer, bigint, bigint, boolean, boolean, numeric, integer) from public, anon;
grant execute on function public.save_alert_limits(uuid, integer, bigint, bigint, boolean, boolean, numeric, integer) to authenticated;

-- Voltar o cliente para o padrão da agência.
create or replace function public.reset_alert_limits(p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_client('ads.manage', p_client) then
    raise exception 'Você não cuida do tráfego deste cliente.' using errcode = '42501';
  end if;
  delete from public.ad_alert_settings where client_id = p_client and organization_id = private.org_id();
end;
$$;
revoke all on function public.reset_alert_limits(uuid) from public, anon;
grant execute on function public.reset_alert_limits(uuid) to authenticated;

-- Grava a frequência de 7 dias lida da Meta (sincronização, service_role). Anúncios fora da resposta ficam sem frequência.
create or replace function public.set_ad_frequency(p_account uuid, p_rows jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ads set frequency_7d = null, impressions_7d = null, frequency_at = now() where ad_account_id = p_account;
  update public.ads a
     set frequency_7d = least((r ->> 'frequency')::numeric, 9999), impressions_7d = (r ->> 'impressions')::bigint
    from jsonb_array_elements(p_rows) r
   where a.ad_account_id = p_account and a.external_id = r ->> 'ad_id';
$$;
revoke all on function public.set_ad_frequency(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_ad_frequency(uuid, jsonb) to service_role;

-- Alertas das sincronizações, agora com os limites do cliente, o gasto do dia e a fadiga de criativo.
create or replace function private.ads_alerts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  s public.ad_alert_settings;
  v_today date := private.today_sp();
  v_run timestamptz := clock_timestamp();
  v_title text;
  v_body text;
  v_href text;
  v_days numeric;
begin
  -- 1. Saldo acabando (conta pré-paga): saldo para N dias ou menos (gasto médio dos 7 dias completos) ou abaixo do mínimo.
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name, a.funds_cents,
           (select sum(i.spend_cents) / 7.0 from public.ad_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date >= v_today - 7 and i.date < v_today) as avg_day
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where a.is_enabled and a.is_prepay and a.funds_cents is not null
  loop
    s := private.alert_limits(r.organization_id, r.client_id);
    v_days := case when r.avg_day > 0 then r.funds_cents / r.avg_day end;
    continue when not ((s.funds_days > 0 and v_days is not null and v_days <= s.funds_days)
                       or (s.funds_min_cents is not null and r.funds_cents < s.funds_min_cents));
    v_title := 'Saldo acabando: ' || r.client_name;
    v_body := r.name || ': saldo de R$ ' || to_char(r.funds_cents / 100.0, 'FM999G999G990D00')
      || case when v_days is not null then ', dá para cerca de ' || floor(v_days)::int || ' dia(s) no ritmo atual' else '' end
      || '. Avise o cliente para recarregar.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'saldo', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-saldo:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 2. Conta com restrição (desativada, pagamento pendente, em análise…).
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name, a.account_status_code
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where a.is_enabled and a.account_status_code is not null and a.account_status_code <> 1
  loop
    v_title := 'Conta de anúncio com restrição: ' || r.client_name;
    v_body := r.name || ' está ' || case r.account_status_code when 2 then 'desativada' when 3 then 'com pagamento pendente' when 7 then 'em análise' when 8 then 'com pagamento pendente'
        when 9 then 'em período de carência' when 101 then 'encerrada' else 'com restrição' end || ' na Meta. Os anúncios podem estar parados.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'restricao', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-restricao:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 3. Entrega parada: campanha ativa e nenhum gasto ontem (se o cliente não desligou este aviso).
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status = 'ativo'
     where a.is_enabled and a.synced_at > now() - interval '1 day' and coalesce(a.account_status_code, 1) = 1
       and exists (select 1 from public.ad_campaigns k where k.ad_account_id = a.id and k.effective_status = 'ACTIVE')
       and coalesce((select sum(i.spend_cents) from public.ad_insights_daily i where i.ad_account_id = a.id and i.level = 'account' and i.date = v_today - 1), 0) = 0
  loop
    continue when not (private.alert_limits(r.organization_id, r.client_id)).no_delivery;
    v_title := 'Anúncios sem entrega: ' || r.client_name;
    v_body := r.name || ' tem campanha ativa, mas não gastou nada ontem. Confira saldo, pagamento e público.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'entrega', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-parada:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 4. Gasto de hoje acima do limite do cliente.
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name, coalesce(sum(i.spend_cents), 0) as spend
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
      join public.ad_insights_daily i on i.ad_account_id = a.id and i.level = 'account' and i.date = v_today
     where a.is_enabled
     group by a.id, c.name
  loop
    s := private.alert_limits(r.organization_id, r.client_id);
    continue when s.daily_spend_max_cents is null or r.spend <= s.daily_spend_max_cents;
    v_title := 'Gasto do dia acima do limite: ' || r.client_name;
    v_body := r.name || ': R$ ' || to_char(r.spend / 100.0, 'FM999G999G990D00') || ' gastos hoje (limite: R$ '
      || to_char(s.daily_spend_max_cents / 100.0, 'FM999G999G990D00') || '). Confira orçamentos e lances.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'gasto', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-gasto:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 5. Fadiga de criativo: anúncio ativo com frequência de 7 dias no limite ou acima e CTR dos últimos 3 dias completos
  --    pelo menos X% abaixo do CTR dos 7 dias anteriores (mínimo de 1.000 impressões em cada janela).
  for r in
    select ad.id, a.organization_id, a.client_id, c.name as client_name, ad.name, ad.frequency_7d,
           sum(i.clicks) filter (where i.date >= v_today - 3)::numeric as clicks3,
           sum(i.impressions) filter (where i.date >= v_today - 3)::numeric as impr3,
           sum(i.clicks) filter (where i.date < v_today - 3)::numeric as clicks7,
           sum(i.impressions) filter (where i.date < v_today - 3)::numeric as impr7
      from public.ads ad
      join public.ad_accounts a on a.id = ad.ad_account_id and a.is_enabled and a.client_id is not null
      join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status = 'ativo'
      join public.ad_insights_daily i on i.ad_account_id = a.id and i.level = 'ad' and i.object_external_id = ad.external_id
                                     and i.date >= v_today - 10 and i.date < v_today
     where ad.effective_status = 'ACTIVE' and ad.frequency_7d is not null and ad.frequency_at > now() - interval '1 day'
     group by ad.id, a.organization_id, a.client_id, c.name
  loop
    s := private.alert_limits(r.organization_id, r.client_id);
    continue when not s.fatigue_enabled or r.frequency_7d < s.fatigue_frequency
               or coalesce(r.impr3, 0) < 1000 or coalesce(r.impr7, 0) < 1000 or r.clicks7 = 0
               or (r.clicks3 / r.impr3) > (r.clicks7 / r.impr7) * (1 - s.fatigue_ctr_drop / 100.0);
    v_title := 'Criativo cansado: ' || r.client_name;
    v_body := r.name || ': frequência de ' || replace(to_char(r.frequency_7d, 'FM990D0'), '.', ',') || ' em 7 dias e CTR de '
      || replace(to_char(r.clicks3 / r.impr3 * 100, 'FM990D00'), '.', ',') || '% nos últimos 3 dias (antes, '
      || replace(to_char(r.clicks7 / r.impr7 * 100, 'FM990D00'), '.', ',') || '%). Hora de trocar ou renovar o criativo.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'fadiga', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-fadiga:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 6. Anúncio reprovado: entra no histórico de reprovações (o gatilho existente avisa o tráfego e quem pediu).
  insert into public.ad_rejections (client_id, platform, rejected_on, format, angle, reason, policy_text, ad_name, source, ad_external_id)
  select a.client_id, 'meta', v_today, null, left(ad.name, 300), 'outro',
         left(coalesce(nullif(ad.review_feedback, ''), 'Reprovado pela Meta. Abra o anúncio no Gerenciador para ver o motivo.'), 1000),
         left(ad.name, 200), 'sync', ad.external_id
    from public.ads ad
    join public.ad_accounts a on a.id = ad.ad_account_id and a.is_enabled and a.client_id is not null
    join public.clients c on c.id = a.client_id and c.deleted_at is null
   where ad.effective_status = 'DISAPPROVED' and char_length(ad.name) >= 2
  on conflict (client_id, ad_external_id) where ad_external_id is not null do nothing;

  for r in
    select ad.id, a.organization_id, a.client_id, c.name as client_name, ad.name, ad.review_feedback
      from public.ads ad
      join public.ad_campaigns k on k.id = ad.campaign_id and k.effective_status = 'ACTIVE'
      join public.ad_accounts a on a.id = ad.ad_account_id and a.is_enabled and a.client_id is not null
      join public.clients c on c.id = a.client_id and c.deleted_at is null
     where ad.effective_status = 'DISAPPROVED'
       and not exists (select 1 from public.ad_alerts x where x.organization_id = a.organization_id and x.kind = 'reprovado'
                          and x.subject = ad.id::text and x.status = 'resolvido' and x.resolved_by is not null)
  loop
    perform private.raise_ad_alert(r.organization_id, r.client_id, 'reprovado', r.id::text,
      'Anúncio reprovado: ' || r.client_name,
      r.name || ': ' || coalesce(nullif(r.review_feedback, ''), 'reprovado pela Meta. Abra o anúncio no Gerenciador para ver o motivo.'),
      '/clientes/' || r.client_id || '/anuncios');
  end loop;

  perform private.settle_ad_alerts(array['saldo', 'restricao', 'entrega', 'gasto', 'fadiga', 'reprovado'], v_run);
end;
$$;
revoke all on function private.ads_alerts_tick() from public, anon, authenticated;
