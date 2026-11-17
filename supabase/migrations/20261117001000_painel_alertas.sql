-- RF-ALE-03: painel de alertas (abertos, reconhecidos, resolvidos; quem resolveu e como).
-- Cada condição vira um alerta com ciclo de vida, além do aviso no sino:
--   aberto      → a condição foi vista; o tráfego recebe o aviso (no máximo um por dia, como antes);
--   reconhecido → alguém está cuidando; os avisos diários param;
--   resolvido   → à mão (com nota) ou sozinho, quando a verificação seguinte não encontra mais a condição.
-- Se a condição continuar depois de resolvido à mão, a verificação seguinte abre um alerta novo
-- (exceto anúncio reprovado: um alerta por anúncio).

create table public.ad_alerts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  client_id        uuid references public.clients (id) on delete cascade,
  kind             text not null check (kind in ('saldo', 'restricao', 'entrega', 'reprovado', 'meta_custo', 'meta_ritmo', 'conexao')),
  subject          text not null check (char_length(subject) between 1 and 200),
  title            text not null check (char_length(title) between 1 and 200),
  body             text check (char_length(body) <= 1000),
  href             text check (char_length(href) <= 300),
  status           text not null default 'aberto' check (status in ('aberto', 'reconhecido', 'resolvido')),
  opened_at        timestamptz not null default now(),
  last_seen_at     timestamptz not null default clock_timestamp(),
  times_seen       integer not null default 1,
  ack_by           uuid references public.profiles (id) on delete set null,
  ack_at           timestamptz,
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  resolution       text check (char_length(resolution) <= 500),
  check ((status = 'resolvido') = (resolved_at is not null)),
  check (status <> 'reconhecido' or ack_at is not null)
);
-- Um alerta não resolvido por condição (tipo + assunto: conta, anúncio, meta ou conexão).
create unique index ad_alerts_open on public.ad_alerts (organization_id, kind, subject) where status <> 'resolvido';
create index ad_alerts_list on public.ad_alerts (organization_id, status, opened_at desc);
create index ad_alerts_client on public.ad_alerts (client_id, status) where client_id is not null;

alter table public.ad_alerts enable row level security;
revoke all on public.ad_alerts from anon, authenticated;
grant select on public.ad_alerts to authenticated;
-- Vê quem lê os anúncios do cliente; alertas sem cliente (conexão da agência), quem conecta as integrações.
create policy ad_alerts_select on public.ad_alerts for select to authenticated
  using (organization_id = (select private.org_id())
         and case when client_id is null then (select private.has_perm('ads.connect')) else (select private.can_client('ads.read', client_id)) end);

-- Quem recebe os avisos do tráfego do cliente (mesma regra de notify_client_ads_team).
create or replace function private.ads_team(p_org uuid, p_client uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  if p_client is not null then
    select array_agg(distinct m.profile_id) into v_users from public.client_members m
      join public.profiles p on p.id = m.profile_id and p.is_active and p.portal_client_id is null
     where m.client_id = p_client and private.user_perm_scope(m.profile_id, 'ads.manage') is not null;
  end if;
  if v_users is null then
    select array_agg(p.id) into v_users from public.profiles p
     where p.organization_id = p_org and p.is_active and p.portal_client_id is null
       and private.user_perm_scope(p.id, 'ads.connect') is not null;
  end if;
  return v_users;
end;
$$;
revoke all on function private.ads_team(uuid, uuid) from public, anon, authenticated;

-- Registra que a condição foi vista. Devolve true quando o tráfego deve ser avisado (alerta novo ou ainda aberto);
-- false quando alguém já reconheceu.
create or replace function private.raise_ad_alert(p_org uuid, p_client uuid, p_kind text, p_subject text, p_title text, p_body text, p_href text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  update public.ad_alerts
     set title = left(p_title, 200), body = left(p_body, 1000), href = p_href, last_seen_at = clock_timestamp(), times_seen = times_seen + 1
   where organization_id = p_org and kind = p_kind and subject = p_subject and status <> 'resolvido'
  returning status into v_status;
  if found then return v_status = 'aberto'; end if;
  insert into public.ad_alerts (organization_id, client_id, kind, subject, title, body, href)
  values (p_org, p_client, p_kind, p_subject, left(p_title, 200), left(p_body, 1000), p_href);
  return true;
end;
$$;
revoke all on function private.raise_ad_alert(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

-- Resolve sozinhos os alertas destes tipos que a verificação iniciada em p_since não viu de novo.
create or replace function private.settle_ad_alerts(p_kinds text[], p_since timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.ad_alerts
     set status = 'resolvido', resolved_at = now(), resolved_by = null,
         resolution = 'A verificação automática não encontrou mais o problema.'
   where kind = any (p_kinds) and status <> 'resolvido' and last_seen_at < p_since;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.settle_ad_alerts(text[], timestamptz) from public, anon, authenticated;

-- Pode agir sobre o alerta? Com cliente: quem cuida do tráfego dele; sem cliente: quem conecta as integrações.
create or replace function private.can_act_ad_alert(p_alert public.ad_alerts)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_alert.organization_id = private.org_id()
     and case when p_alert.client_id is null then private.has_perm('ads.connect') else private.can_client('ads.manage', p_alert.client_id) end;
$$;
revoke all on function private.can_act_ad_alert(public.ad_alerts) from public, anon, authenticated;

create or replace function public.ack_ad_alert(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.ad_alerts;
begin
  select * into a from public.ad_alerts where id = p_id for update;
  if not found or a.organization_id is distinct from private.org_id() then
    raise exception 'Alerta não encontrado.' using errcode = 'P0002';
  end if;
  if not private.can_act_ad_alert(a) then
    raise exception 'Você não cuida do tráfego deste cliente.' using errcode = '42501';
  end if;
  if a.status <> 'aberto' then
    raise exception 'Este alerta já foi %.', case a.status when 'reconhecido' then 'reconhecido' else 'resolvido' end using errcode = 'P0001';
  end if;
  update public.ad_alerts set status = 'reconhecido', ack_by = auth.uid(), ack_at = now() where id = p_id;
end;
$$;
revoke all on function public.ack_ad_alert(uuid) from public, anon;
grant execute on function public.ack_ad_alert(uuid) to authenticated;

-- Resolver com a nota de como foi resolvido; avisa o restante do tráfego que recebeu o alerta.
create or replace function public.resolve_ad_alert(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.ad_alerts;
  v_note text := btrim(coalesce(p_note, ''));
  v_users uuid[];
  v_name text;
begin
  select * into a from public.ad_alerts where id = p_id for update;
  if not found or a.organization_id is distinct from private.org_id() then
    raise exception 'Alerta não encontrado.' using errcode = 'P0002';
  end if;
  if not private.can_act_ad_alert(a) then
    raise exception 'Você não cuida do tráfego deste cliente.' using errcode = '42501';
  end if;
  if a.status = 'resolvido' then
    raise exception 'Este alerta já foi resolvido.' using errcode = 'P0001';
  end if;
  if char_length(v_note) < 3 or char_length(v_note) > 500 then
    raise exception 'Conte em poucas palavras como foi resolvido (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.ad_alerts
     set status = 'resolvido', resolved_by = auth.uid(), resolved_at = now(), resolution = v_note,
         ack_by = coalesce(ack_by, auth.uid()), ack_at = coalesce(ack_at, now())
   where id = p_id;
  select array_agg(u) into v_users from unnest(private.ads_team(a.organization_id, a.client_id)) u where u is distinct from auth.uid();
  if v_users is not null then
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.notify_users(v_users, 'ad_alert', 'Alerta resolvido: ' || a.title,
      coalesce(nullif(v_name, ''), 'Alguém da equipe') || ': ' || v_note, '/trafego/alertas?situacao=resolvidos', null, auth.uid());
  end if;
end;
$$;
revoke all on function public.resolve_ad_alert(uuid, text) from public, anon;
grant execute on function public.resolve_ad_alert(uuid, text) to authenticated;

-- Alertas das sincronizações (mesmas regras de 20261117000400), agora com o ciclo de vida.
create or replace function private.ads_alerts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := private.today_sp();
  v_run timestamptz := clock_timestamp();
  v_title text;
  v_body text;
  v_href text;
begin
  -- 1. Saldo acabando (conta pré-paga): saldo ÷ gasto médio dos 7 dias completos ≤ 3.
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name, a.funds_cents,
           (select sum(i.spend_cents) / 7.0 from public.ad_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date >= v_today - 7 and i.date < v_today) as avg_day
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where a.is_enabled and a.is_prepay and a.funds_cents is not null
  loop
    continue when r.avg_day is null or r.avg_day <= 0 or r.funds_cents / r.avg_day > 3;
    v_title := 'Saldo acabando: ' || r.client_name;
    v_body := r.name || ': saldo de R$ ' || to_char(r.funds_cents / 100.0, 'FM999G999G990D00') || ', dá para cerca de ' || floor(r.funds_cents / r.avg_day)::int || ' dia(s) no ritmo atual. Avise o cliente para recarregar.';
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

  -- 3. Entrega parada: campanha ativa e nenhum gasto ontem.
  for r in
    select a.id, a.organization_id, a.name, a.client_id, c.name as client_name
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status = 'ativo'
     where a.is_enabled and a.synced_at > now() - interval '1 day' and coalesce(a.account_status_code, 1) = 1
       and exists (select 1 from public.ad_campaigns k where k.ad_account_id = a.id and k.effective_status = 'ACTIVE')
       and coalesce((select sum(i.spend_cents) from public.ad_insights_daily i where i.ad_account_id = a.id and i.level = 'account' and i.date = v_today - 1), 0) = 0
  loop
    v_title := 'Anúncios sem entrega: ' || r.client_name;
    v_body := r.name || ' tem campanha ativa, mas não gastou nada ontem. Confira saldo, pagamento e público.';
    v_href := '/clientes/' || r.client_id || '/anuncios';
    if private.raise_ad_alert(r.organization_id, r.client_id, 'entrega', r.id::text, v_title, v_body, v_href) then
      perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'ads-parada:' || r.id || ':' || v_today);
    end if;
  end loop;

  -- 4. Anúncio reprovado: entra no histórico de reprovações (o gatilho existente avisa o tráfego e quem pediu).
  insert into public.ad_rejections (client_id, platform, rejected_on, format, angle, reason, policy_text, ad_name, source, ad_external_id)
  select a.client_id, 'meta', v_today, null, left(ad.name, 300), 'outro',
         left(coalesce(nullif(ad.review_feedback, ''), 'Reprovado pela Meta. Abra o anúncio no Gerenciador para ver o motivo.'), 1000),
         left(ad.name, 200), 'sync', ad.external_id
    from public.ads ad
    join public.ad_accounts a on a.id = ad.ad_account_id and a.is_enabled and a.client_id is not null
    join public.clients c on c.id = a.client_id and c.deleted_at is null
   where ad.effective_status = 'DISAPPROVED' and char_length(ad.name) >= 2
  on conflict (client_id, ad_external_id) where ad_external_id is not null do nothing;

  -- No painel, só os reprovados em campanha ativa (os que importam agora); um alerta por anúncio.
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

  perform private.settle_ad_alerts(array['saldo', 'restricao', 'entrega', 'reprovado'], v_run);
end;
$$;
revoke all on function private.ads_alerts_tick() from public, anon, authenticated;

-- Metas (mesmas regras de 20261117000800), com o ciclo de vida. Na virada do mês, os alertas do mês anterior se resolvem.
create or replace function private.ad_goals_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := private.today_sp();
  v_month date := date_trunc('month', private.today_sp())::date;
  v_days int := extract(day from (date_trunc('month', private.today_sp()) + interval '1 month - 1 day'))::int;
  v_elapsed int := extract(day from private.today_sp())::int - 1; -- dias completos (até ontem)
  v_week text := to_char(private.today_sp(), 'IYYY-IW');
  v_run timestamptz := clock_timestamp();
  v_label text;
  v_title text;
  v_body text;
  v_href text;
begin
  if v_elapsed >= 5 then
    for r in
      select g.*, c.name as client_name,
             coalesce(sum(i.spend_cents), 0) as spend,
             coalesce(sum(case g.result_kind when 'leads' then i.leads when 'messages' then i.messages when 'purchases' then i.purchases else i.link_clicks end), 0) as results
        from public.ad_goals g
        join public.clients c on c.id = g.client_id and c.deleted_at is null and c.status = 'ativo'
        left join public.ad_accounts a on a.client_id = g.client_id and a.is_enabled
        left join public.ad_insights_daily i on i.ad_account_id = a.id and i.level = 'account' and i.date >= v_month and i.date < v_today
       where g.month = v_month
       group by g.id, c.name
    loop
      v_label := case r.result_kind when 'leads' then 'lead' when 'messages' then 'conversa' when 'purchases' then 'compra' else 'clique' end;
      v_href := '/clientes/' || r.client_id || '/anuncios#metas';
      if r.max_cost_cents is not null and r.results > 0 and r.spend / r.results > r.max_cost_cents then
        v_title := 'Custo por ' || v_label || ' acima da meta: ' || r.client_name;
        v_body := 'No mês: R$ ' || to_char(r.spend / r.results / 100.0, 'FM999G990D00') || ' por ' || v_label || ' (meta: até R$ ' || to_char(r.max_cost_cents / 100.0, 'FM999G990D00') || ').';
        if private.raise_ad_alert(r.organization_id, r.client_id, 'meta_custo', r.id::text, v_title, v_body, v_href) then
          perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'meta-custo:' || r.id || ':' || v_week);
        end if;
      end if;
      if r.results_target is not null and r.results * v_days / v_elapsed < r.results_target * 0.8 then
        v_title := 'Ritmo abaixo da meta: ' || r.client_name;
        v_body := r.results || ' ' || v_label || '(s) até ontem; no ritmo atual, ' || (r.results * v_days / v_elapsed) || ' no mês (meta: ' || r.results_target || ').';
        if private.raise_ad_alert(r.organization_id, r.client_id, 'meta_ritmo', r.id::text, v_title, v_body, v_href) then
          perform public.notify_client_ads_team(r.client_id, null, v_title, v_body, v_href, 'meta-ritmo:' || r.id || ':' || v_week);
        end if;
      end if;
    end loop;
  end if;
  perform private.settle_ad_alerts(array['meta_custo', 'meta_ritmo'], v_run);
end;
$$;
revoke all on function private.ad_goals_tick() from public, anon, authenticated;

-- Conexões paradas ou vencendo (mesmas regras de 20261117000100), com o ciclo de vida.
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
  v_title text;
  v_body text;
  v_stopped boolean;
  v_run timestamptz := clock_timestamp();
begin
  for r in
    select c.*, cl.name as client_name from public.integration_connections c
      left join public.clients cl on cl.id = c.client_id
     where c.owner_kind in ('agency', 'client')
       and (c.owner_kind = 'agency' or (cl.deleted_at is null and cl.status in ('ativo', 'onboarding', 'pausado')))
       and (c.status <> 'active'
            or (c.refresh_token_enc is null and c.expires_at is not null and c.expires_at < now() + interval '7 days'))
  loop
    v_name := case when r.owner_kind = 'client' then 'o Facebook de ' || r.client_name
                   when r.provider = 'meta' then 'Meta (Facebook e Instagram)' else 'Google Ads' end;
    v_href := case when r.owner_kind = 'client' then '/clientes/' || r.client_id || '/trafego#facebook' else '/configuracoes/integracoes' end;
    v_stopped := r.status <> 'active' or r.expires_at < now();
    v_title := case when v_stopped then 'Conexão com ' || v_name || ' parou'
                    else 'Conexão com ' || v_name || ' vence em ' || greatest(1, extract(day from r.expires_at - now())::int) || ' dias' end;
    v_body := coalesce(r.last_error, case when r.owner_kind = 'client'
        then 'Reconecte na aba Tráfego do cliente ou envie um novo link para o cliente autorizar.'
        else 'Reconecte em Configurações › Integrações para os dados continuarem chegando.' end);
    continue when not private.raise_ad_alert(r.organization_id, case when r.owner_kind = 'client' then r.client_id end, 'conexao', r.id::text, v_title, v_body, v_href);
    v_users := private.ads_team(r.organization_id, case when r.owner_kind = 'client' then r.client_id end);
    continue when v_users is null;
    perform public.notify_users(v_users, 'ad_alert', v_title, v_body, v_href,
      'integracao:' || r.id || ':' || case when v_stopped
        then 'parada:' || to_char(private.today_sp(), 'YYYY-MM-DD') else 'vence:' || to_char(r.expires_at, 'YYYY-MM-DD') end,
      null);
  end loop;
  perform private.settle_ad_alerts(array['conexao'], v_run);
end;
$$;
revoke all on function private.integrations_tick() from public, anon, authenticated;

-- Retenção: alertas resolvidos há mais de 180 dias saem junto com a limpeza das sincronizações.
create or replace function private.ad_sync_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ad_sync_runs where started_at < now() - interval '60 days';
  delete from public.ad_alerts where status = 'resolvido' and resolved_at < now() - interval '180 days';
$$;
revoke all on function private.ad_sync_cleanup() from public, anon, authenticated;
