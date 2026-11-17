-- RF-ALE-01/02 e RF-ADS-10: alertas a partir da sincronização e reprovações automáticas.
-- Rodam 20 minutos depois de cada sincronização. Avisam o tráfego do cliente (notify_client_ads_team),
-- no máximo uma vez por dia por conta/regra (dedupe). Limites fixos nesta versão:
--   saldo para 3 dias ou menos (gasto médio dos 7 dias completos), conta com restrição,
--   conta com campanha ativa e sem gasto ontem, anúncio reprovado.

-- Reprovação vinda da sincronização: formato desconhecido (a Meta não diz), ligada ao anúncio.
alter table public.ad_rejections alter column format drop not null;
alter table public.ad_rejections add constraint ad_rejections_format_manual check (source = 'sync' or format is not null);
alter table public.ad_rejections add column ad_external_id text;
create unique index ad_rejections_ad on public.ad_rejections (client_id, ad_external_id) where ad_external_id is not null;

create or replace function private.ads_alerts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := private.today_sp();
  v_href text;
begin
  -- 1. Saldo acabando (conta pré-paga): saldo ÷ gasto médio dos 7 dias completos ≤ 3.
  for r in
    select a.id, a.name, a.client_id, c.name as client_name, a.funds_cents,
           (select sum(i.spend_cents) / 7.0 from public.ad_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date >= v_today - 7 and i.date < v_today) as avg_day
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where a.is_enabled and a.is_prepay and a.funds_cents is not null
  loop
    continue when r.avg_day is null or r.avg_day <= 0 or r.funds_cents / r.avg_day > 3;
    perform public.notify_client_ads_team(r.client_id, null,
      'Saldo acabando: ' || r.client_name,
      r.name || ': saldo de R$ ' || to_char(r.funds_cents / 100.0, 'FM999G999G990D00') || ', dá para cerca de ' || floor(r.funds_cents / r.avg_day)::int || ' dia(s) no ritmo atual. Avise o cliente para recarregar.',
      '/clientes/' || r.client_id || '/anuncios', 'ads-saldo:' || r.id || ':' || v_today);
  end loop;

  -- 2. Conta com restrição (desativada, pagamento pendente, em análise…).
  for r in
    select a.id, a.name, a.client_id, c.name as client_name, a.account_status_code
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     where a.is_enabled and a.account_status_code is not null and a.account_status_code <> 1
  loop
    perform public.notify_client_ads_team(r.client_id, null,
      'Conta de anúncio com restrição: ' || r.client_name,
      r.name || ' está ' || case r.account_status_code when 2 then 'desativada' when 3 then 'com pagamento pendente' when 7 then 'em análise' when 8 then 'com pagamento pendente'
        when 9 then 'em período de carência' when 101 then 'encerrada' else 'com restrição' end || ' na Meta. Os anúncios podem estar parados.',
      '/clientes/' || r.client_id || '/anuncios', 'ads-restricao:' || r.id || ':' || v_today);
  end loop;

  -- 3. Entrega parada: campanha ativa e nenhum gasto ontem.
  for r in
    select a.id, a.name, a.client_id, c.name as client_name
      from public.ad_accounts a join public.clients c on c.id = a.client_id and c.deleted_at is null and c.status = 'ativo'
     where a.is_enabled and a.synced_at > now() - interval '1 day' and coalesce(a.account_status_code, 1) = 1
       and exists (select 1 from public.ad_campaigns k where k.ad_account_id = a.id and k.effective_status = 'ACTIVE')
       and coalesce((select sum(i.spend_cents) from public.ad_insights_daily i where i.ad_account_id = a.id and i.level = 'account' and i.date = v_today - 1), 0) = 0
  loop
    perform public.notify_client_ads_team(r.client_id, null,
      'Anúncios sem entrega: ' || r.client_name,
      r.name || ' tem campanha ativa, mas não gastou nada ontem. Confira saldo, pagamento e público.',
      '/clientes/' || r.client_id || '/anuncios', 'ads-parada:' || r.id || ':' || v_today);
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
end;
$$;
revoke all on function private.ads_alerts_tick() from public, anon, authenticated;

select cron.schedule('extend-anuncios-alertas', '25 0,3,9,12,15,18,21 * * *', $$select private.ads_alerts_tick()$$);
