-- Dinheiro nos avisos de alertas e metas no padrão brasileiro (R$ 1.234,56): to_char com G e D segue a
-- configuração americana do banco; a vírgula e o ponto são trocados.

CREATE OR REPLACE FUNCTION private.ad_goals_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        v_body := 'No mês: R$ ' || translate(to_char(r.spend / r.results / 100.0, 'FM999G990D00'), ',.', '.,') || ' por ' || v_label || ' (meta: até R$ ' || translate(to_char(r.max_cost_cents / 100.0, 'FM999G990D00'), ',.', '.,') || ').';
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
$function$;

CREATE OR REPLACE FUNCTION private.ads_alerts_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    v_body := r.name || ': saldo de R$ ' || translate(to_char(r.funds_cents / 100.0, 'FM999G999G990D00'), ',.', '.,')
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
    v_body := r.name || ': R$ ' || translate(to_char(r.spend / 100.0, 'FM999G999G990D00'), ',.', '.,') || ' gastos hoje (limite: R$ '
      || translate(to_char(s.daily_spend_max_cents / 100.0, 'FM999G999G990D00'), ',.', '.,') || '). Confira orçamentos e lances.';
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
$function$;

