-- Metas de anúncios (RF-T2-04): quem define e vê; alertas de custo acima da meta e de ritmo abaixo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.mt@extend.test', '{"full_name":"Gil MT"}', now()),
  ('00000000-0000-4000-bf00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ivo.mt@extend.test', '{"full_name":"Ivo MT"}', now()),
  ('00000000-0000-4000-bf00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cora.mt@extend.test', '{"full_name":"Cora MT"}', now());
update public.profiles set is_active = true where email like '%.mt@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.mt@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf00-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf00-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bf00-000000000003'::uuid, 'coord_conteudo')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf10-000000000001', id, 'MT Clínica', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf10-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bf00-000000000001'::uuid), ('gerenciamento', '00000000-0000-4000-bf00-000000000003'::uuid)) x(k, u) on s.key = x.k;
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bf20-000000000001', organization_id, 'meta', 'act_66001', 'MT Conta', id, true from public.clients where id = '00000000-0000-4000-bf10-000000000001';
-- Todos os dias completos do mês: R$ 50 e 1 lead por dia (custo R$ 50).
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents, leads)
select '00000000-0000-4000-bf20-000000000001', 'account', 'act_66001', d::date, 5000, 1
  from generate_series(date_trunc('month', private.today_sp()), private.today_sp() - 1, interval '1 day') d;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf00-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.ad_goals (client_id, month, result_kind, results_target, max_cost_cents)
  values ('00000000-0000-4000-bf10-000000000001', date_trunc('month', private.today_sp())::date, 'leads', 100, 2500)$$, 'gestor do cliente define a meta do mês');
select throws_ok($$insert into public.ad_goals (client_id, month, result_kind, results_target) values ('00000000-0000-4000-bf10-000000000001', '2026-11-15', 'leads', 10)$$,
  '23514', null, 'o mês é sempre o dia 1');
select throws_ok($$insert into public.ad_goals (client_id, month, result_kind) values ('00000000-0000-4000-bf10-000000000001', '2026-12-01', 'leads')$$,
  '23514', null, 'precisa de pelo menos uma meta');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf00-000000000003","role":"authenticated"}';
select is((select results_target from public.ad_goals where client_id = '00000000-0000-4000-bf10-000000000001'), 100, 'quem lê os anúncios do cliente vê a meta');
select throws_ok($$insert into public.ad_goals (client_id, month, result_kind, results_target) values ('00000000-0000-4000-bf10-000000000001', '2027-01-01', 'leads', 10)$$,
  '42501', null, 'mas não define');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf00-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.ad_goals where client_id = '00000000-0000-4000-bf10-000000000001'), 0, 'gestor de fora não vê');
reset role;

select private.ad_goals_tick();
select private.ad_goals_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf00-000000000001' and title = 'Custo por lead acima da meta: MT Clínica'),
  case when extract(day from private.today_sp()) > 5 then 1 else 0 end, 'custo de R$ 50 com meta de R$ 25 avisa uma vez (a partir do 6º dia)');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf00-000000000001' and title = 'Ritmo abaixo da meta: MT Clínica'),
  case when extract(day from private.today_sp()) > 5 then 1 else 0 end, 'cerca de 30 leads no mês para meta de 100 avisa o ritmo');

select * from finish();
rollback;
