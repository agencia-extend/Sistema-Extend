-- Sincronização dos anúncios: quem vê campanhas, anúncios, números e o registro das sincronizações.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- Gil (gestor) cuida do cliente A; Ivo (gestor) não; Gerson (gerente de tráfego) vê todas.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bc00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.sy@extend.test', '{"full_name":"Gil SY"}', now()),
  ('00000000-0000-4000-bc00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ivo.sy@extend.test', '{"full_name":"Ivo SY"}', now()),
  ('00000000-0000-4000-bc00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gerson.sy@extend.test', '{"full_name":"Gerson SY"}', now());
update public.profiles set is_active = true where email like '%.sy@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.sy@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bc00-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bc00-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bc00-000000000003'::uuid, 'gerente_trafego')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bc10-000000000001', id, 'SY Cliente A', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bc10-000000000001', id, '00000000-0000-4000-bc00-000000000001' from public.sectors where key = 'trafego';

insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select ('00000000-0000-4000-bc20-00000000000' || n)::uuid, organization_id, 'meta', 'act_5500' || n, 'SY Conta ' || n, case when n = 1 then id end, n = 1
  from public.clients cross join generate_series(1, 2) n where id = '00000000-0000-4000-bc10-000000000001';
insert into public.ad_campaigns (id, ad_account_id, external_id, name) values
  ('00000000-0000-4000-bc30-000000000001', '00000000-0000-4000-bc20-000000000001', 'c1', 'SY Campanha A'),
  ('00000000-0000-4000-bc30-000000000002', '00000000-0000-4000-bc20-000000000002', 'c2', 'SY Campanha sem cliente');
insert into public.ads (ad_account_id, campaign_id, external_id, name) values ('00000000-0000-4000-bc20-000000000001', '00000000-0000-4000-bc30-000000000001', 'a1', 'SY Anúncio');
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents) values
  ('00000000-0000-4000-bc20-000000000001', 'campaign', 'c1', '2026-11-10', 1000),
  ('00000000-0000-4000-bc20-000000000002', 'campaign', 'c2', '2026-11-10', 2000);
insert into public.ad_sync_runs (ad_account_id, trigger, ok) values ('00000000-0000-4000-bc20-000000000001', 'cron', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bc00-000000000001","role":"authenticated"}';
select is((select array_agg(name order by name) from public.ad_campaigns where name like 'SY %'), array['SY Campanha A'], 'gestor vê as campanhas do cliente dele');
select is((select sum(spend_cents)::int from public.ad_insights_daily where object_external_id in ('c1', 'c2')), 1000, 'e só os números das contas do cliente');
select is((select count(*)::int from public.ads where name = 'SY Anúncio'), 1, 'e os anúncios');
select is((select count(*)::int from public.ad_sync_runs where ad_account_id = '00000000-0000-4000-bc20-000000000001'), 1, 'e as sincronizações');
select throws_ok($$insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date) values ('00000000-0000-4000-bc20-000000000001', 'account', 'x', '2026-11-11')$$, '42501', null, 'ninguém grava números pela tela');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bc00-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.ad_campaigns where name like 'SY %'), 0, 'gestor de fora não vê nada');
select is((select count(*)::int from public.ad_insights_daily where object_external_id in ('c1', 'c2')), 0, 'nem os números');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bc00-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.ad_campaigns where name like 'SY %'), 2, 'gerente de tráfego vê todas, inclusive sem cliente');
reset role;

select * from finish();
rollback;
