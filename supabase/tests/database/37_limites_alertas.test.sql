-- Limites dos alertas (RF-ALE-01): padrão da agência e por cliente, gasto do dia acima do limite e fadiga de criativo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf02-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.la@extend.test', '{"full_name":"Ana LA"}', now()),
  ('00000000-0000-4000-bf02-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gui.la@extend.test', '{"full_name":"Gui LA"}', now()),
  ('00000000-0000-4000-bf02-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cid.la@extend.test', '{"full_name":"Cid LA"}', now());
update public.profiles set is_active = true where email like '%.la@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.la@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf02-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf02-000000000002'::uuid, 'gerente_trafego'),
  ('00000000-0000-4000-bf02-000000000003'::uuid, 'coord_conteudo')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select x.id, o.id, x.name, 'ativo' from (select id from public.organizations order by created_at limit 1) o,
  (values ('00000000-0000-4000-bf12-000000000001'::uuid, 'LA Pizzaria'), ('00000000-0000-4000-bf12-000000000002'::uuid, 'LA Outra')) x(id, name);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf12-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bf02-000000000001'::uuid), ('gerenciamento', '00000000-0000-4000-bf02-000000000003'::uuid)) x(k, u) on s.key = x.k;
-- Conta pré-paga: R$ 50 por dia nos últimos 7 dias, R$ 80 de saldo e R$ 40 gastos hoje.
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled, is_prepay, funds_cents)
select '00000000-0000-4000-bf22-000000000001', organization_id, 'meta', 'act_78001', 'LA Conta', id, true, true, 8000 from public.clients where id = '00000000-0000-4000-bf12-000000000001';
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents)
select '00000000-0000-4000-bf22-000000000001', 'account', 'act_78001', private.today_sp() - d, case when d = 0 then 4000 else 5000 end from generate_series(0, 7) d;
-- Anúncio ativo com frequência 3,0 em 7 dias; CTR de 2% nos 7 dias anteriores e de 1% nos últimos 3.
insert into public.ads (id, ad_account_id, external_id, name, effective_status, frequency_7d, frequency_at)
values ('00000000-0000-4000-bf32-000000000001', '00000000-0000-4000-bf22-000000000001', 'adla1', 'Vídeo pizza no forno', 'ACTIVE', 3.0, now());
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, impressions, clicks)
select '00000000-0000-4000-bf22-000000000001', 'ad', 'adla1', private.today_sp() - d, 1000, case when d <= 3 then 10 else 20 end from generate_series(1, 10) d;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf02-000000000001","role":"authenticated"}';
select throws_ok($$select public.save_alert_limits(null, 5, null, null, true, true, 3.0, 25)$$, '42501', null, 'gestor não muda o padrão da agência');
select throws_ok($$select public.set_ad_frequency('00000000-0000-4000-bf22-000000000001', '[]')$$, '42501', null, 'só a sincronização grava a frequência');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf02-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_alert_limits(null, 5, null, null, true, true, 3.0, 25)$$, 'gerente de tráfego define o padrão da agência');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf02-000000000003","role":"authenticated"}';
select throws_ok($$select public.save_alert_limits('00000000-0000-4000-bf12-000000000001', 0, 10000, 3000, false, true, 2.5, 20)$$,
  '42501', null, 'quem só lê os anúncios não muda os limites do cliente');
select is((select count(*)::int from public.ad_alert_settings where client_id is null), 1, 'mas vê o padrão da agência');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf02-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_alert_limits('00000000-0000-4000-bf12-000000000001', 0, 10000, 3000, false, true, 2.5, 20)$$, 'gestor do cliente define os limites dele');
select lives_ok($$select public.save_alert_limits('00000000-0000-4000-bf12-000000000001', 0, 10000, 3000, false, true, 2.5, 20)$$, 'salvar de novo atualiza');
reset role;
set local request.jwt.claims = '';

select is((select count(*)::int from public.ad_alert_settings where client_id = '00000000-0000-4000-bf12-000000000001'), 1, 'uma linha por cliente');
select is(((private.alert_limits((select organization_id from public.clients where id = '00000000-0000-4000-bf12-000000000001'), '00000000-0000-4000-bf12-000000000002')).funds_days), 5,
  'cliente sem limites próprios usa o padrão da agência');

select private.ads_alerts_tick();
select is((select string_agg(kind, ',' order by kind) from public.ad_alerts where client_id = '00000000-0000-4000-bf12-000000000001' and status = 'aberto'),
  'fadiga,gasto,saldo', 'saldo abaixo de R$ 100, gasto de hoje acima de R$ 30 e criativo cansado (frequência 3 e CTR caiu 50%)');
select ok((select body from public.ad_alerts where kind = 'fadiga' and client_id = '00000000-0000-4000-bf12-000000000001') like 'Vídeo pizza no forno: frequência de 3,0 em 7 dias e CTR de 1,00%%',
  'o aviso de fadiga diz a frequência e o CTR');

-- Volta ao padrão da agência: sem limite de gasto, o alerta de gasto se resolve sozinho; saldo para 1,6 dia (≤ 5) continua.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf02-000000000001","role":"authenticated"}';
select lives_ok($$select public.reset_alert_limits('00000000-0000-4000-bf12-000000000001')$$, 'gestor volta o cliente ao padrão');
reset role;
set local request.jwt.claims = '';
select private.ads_alerts_tick();
select is((select status || ':' || coalesce(resolved_by::text, 'auto') from public.ad_alerts where kind = 'gasto' and client_id = '00000000-0000-4000-bf12-000000000001'),
  'resolvido:auto', 'sem limite de gasto, o alerta se resolve sozinho');
select is((select count(*)::int from public.ad_alerts where client_id = '00000000-0000-4000-bf12-000000000001' and status = 'aberto' and kind in ('saldo', 'fadiga')), 2,
  'saldo (padrão de 5 dias) e fadiga (3,0 e 25%) continuam abertos');

select * from finish();
rollback;
