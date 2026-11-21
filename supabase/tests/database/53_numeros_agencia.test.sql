-- Números da agência (RF-DSH-01): só quem tem "Ver painéis"; a coordenação vê o total da mídia gerenciada mesmo sem
-- acesso às contas do cliente; conta sem cliente não entra; alertas resolvidos não contam.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf97-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co.ag@extend.test', '{"full_name":"Co AG"}', now()),
  ('00000000-0000-4000-bf97-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'de.ag@extend.test', '{"full_name":"De AG"}', now());
update public.profiles set is_active = true where email like '%.ag@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.ag@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf97-000000000001'::uuid, 'coord_conteudo'), ('00000000-0000-4000-bf97-000000000002'::uuid, 'designer')) x(u, k) on r.key = x.k;

insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf98-000000000001', id, 'Cliente AG', 'pausado' from public.organizations order by created_at limit 1;
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bf99-000000000001', id, 'meta', 'act_ag1', 'Conta AG', '00000000-0000-4000-bf98-000000000001', true from public.organizations order by created_at limit 1;
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bf99-000000000002', id, 'meta', 'act_ag2', 'Conta solta AG', null, false from public.organizations order by created_at limit 1;
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents) values
  ('00000000-0000-4000-bf99-000000000001', 'account', 'act_ag1', '2001-01-10', 12345),
  ('00000000-0000-4000-bf99-000000000001', 'campaign', 'c1', '2001-01-10', 99999),
  ('00000000-0000-4000-bf99-000000000002', 'account', 'act_ag2', '2001-01-10', 50000),
  ('00000000-0000-4000-bf99-000000000001', 'account', 'act_ag1', '2001-02-10', 70000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf97-000000000002","role":"authenticated"}';
select throws_ok($$select public.agency_totals('2001-01-01', '2001-01-31')$$, '42501', null, 'quem não vê painéis não recebe os números');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf97-000000000001","role":"authenticated"}';
select is((public.agency_totals('2001-01-01', '2001-01-31') ->> 'spendCents')::bigint, 12345::bigint,
  'mídia gerenciada: só a conta ligada a cliente, no nível da conta e dentro do período');
select ok((select count(*) from public.ad_insights_daily where ad_account_id = '00000000-0000-4000-bf99-000000000001') = 0,
  'a coordenação não lê as contas do cliente diretamente');
select ok((public.agency_totals('2001-01-01', '2001-01-31') ->> 'paused')::int >= 1, 'conta clientes pausados');
select ok((public.agency_totals('2001-01-01', '2001-01-31') ? 'openAlerts'), 'traz os alertas abertos');

select * from finish();
rollback;
