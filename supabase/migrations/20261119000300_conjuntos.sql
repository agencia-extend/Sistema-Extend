-- Números por conjunto (aba Conjuntos do módulo Anúncios, como no HubSystem): a sincronização passa a gravar o nível
-- "adset" junto com conta, campanha e anúncio.
alter table public.ad_insights_daily drop constraint ad_insights_daily_level_check;
alter table public.ad_insights_daily add constraint ad_insights_daily_level_check check (level in ('account', 'campaign', 'adset', 'ad'));
