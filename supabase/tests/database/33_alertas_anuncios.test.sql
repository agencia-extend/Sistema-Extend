-- Alertas da sincronização (RF-ALE-01/02) e reprovação automática (RF-ADS-10).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bd00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.al@extend.test', '{"full_name":"Gil AL"}', now());
update public.profiles set is_active = true where email = 'gil.al@extend.test';
delete from public.user_roles where user_id = '00000000-0000-4000-bd00-000000000001';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-bd00-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bd10-000000000001', id, 'AL Clínica', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bd10-000000000001', id, '00000000-0000-4000-bd00-000000000001' from public.sectors where key = 'trafego';

-- Conta 1: pré-paga, R$ 50 de saldo, R$ 20/dia nos últimos 7 dias → ~2 dias; anúncio reprovado.
-- Conta 2: desativada; campanha ativa e nada gasto ontem.
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled, is_prepay, funds_cents, account_status_code, synced_at)
select ('00000000-0000-4000-bd20-00000000000' || n)::uuid, organization_id, 'meta', 'act_7700' || n, 'AL Conta ' || n, id, true, n = 1,
       case when n = 1 then 5000 end, case when n = 1 then 1 else 2 end, now()
  from public.clients cross join generate_series(1, 2) n where id = '00000000-0000-4000-bd10-000000000001';
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents)
select '00000000-0000-4000-bd20-000000000001', 'account', 'act_77001', private.today_sp() - d, 2000 from generate_series(1, 7) d;
insert into public.ad_campaigns (ad_account_id, external_id, name, effective_status) values ('00000000-0000-4000-bd20-000000000002', 'k2', 'AL Campanha', 'ACTIVE');
insert into public.ads (ad_account_id, external_id, name, effective_status, review_feedback) values
  ('00000000-0000-4000-bd20-000000000001', 'x1', 'AL Antes e depois', 'DISAPPROVED', 'Before & After: imagens de antes e depois não são permitidas.');

-- Conta 2 também deve dar "parada" (está com restrição, então só o aviso de restrição): ligamos a regra de
-- entrega numa conta 3 ativa sem gasto ontem.
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled, account_status_code, synced_at)
select '00000000-0000-4000-bd20-000000000003', organization_id, 'meta', 'act_77003', 'AL Conta 3', id, true, 1, now()
  from public.clients where id = '00000000-0000-4000-bd10-000000000001';
insert into public.ad_campaigns (ad_account_id, external_id, name, effective_status) values ('00000000-0000-4000-bd20-000000000003', 'k3', 'AL Campanha 3', 'ACTIVE');

select private.ads_alerts_tick();
select private.ads_alerts_tick(); -- de novo no mesmo dia: não repete

select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bd00-000000000001' and title = 'Saldo acabando: AL Clínica'), 1, 'saldo para ~2 dias avisa uma vez');
select ok((select body like '%cerca de 2 dia(s)%' from public.notifications where user_id = '00000000-0000-4000-bd00-000000000001' and title = 'Saldo acabando: AL Clínica'), 'com a previsão de dias');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bd00-000000000001' and title = 'Conta de anúncio com restrição: AL Clínica'), 1, 'conta desativada avisa');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bd00-000000000001' and title = 'Anúncios sem entrega: AL Clínica'), 1, 'campanha ativa sem gasto ontem avisa (só a conta sem restrição)');
select is((select count(*)::int from public.ad_rejections where client_id = '00000000-0000-4000-bd10-000000000001' and source = 'sync'), 1, 'anúncio reprovado entra no histórico uma vez');
select is((select policy_text from public.ad_rejections where client_id = '00000000-0000-4000-bd10-000000000001'), 'Before & After: imagens de antes e depois não são permitidas.', 'com o que a Meta disse');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bd00-000000000001' and title = 'Anúncio reprovado: AL Clínica'), 1, 'e o tráfego é avisado da reprovação');
select throws_ok($$insert into public.ad_rejections (client_id, angle, reason, policy_text) values ('00000000-0000-4000-bd10-000000000001', 'xx', 'outro', 'manual sem formato')$$, '23514', null, 'registro manual continua exigindo o formato');

select * from finish();
rollback;
