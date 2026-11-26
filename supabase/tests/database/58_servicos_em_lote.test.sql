-- Serviços em lote, "já neste mês": quem gerencia o cliente ajusta a quantidade do mês atual no lugar e as demandas do
-- mês são criadas na hora, sem duplicar; uma mudança agendada para o próximo mês deixa de valer e o serviço continua;
-- quem não gerencia não altera; cliente em onboarding é ajustado pela ficha.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bfc1-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ad.sl@extend.test', '{"full_name":"Ad SL"}', now()),
  ('00000000-0000-4000-bfc1-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'de.sl@extend.test', '{"full_name":"De SL"}', now());
update public.profiles set is_active = true where email like '%.sl@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.sl@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bfc1-000000000001'::uuid, 'admin'), ('00000000-0000-4000-bfc1-000000000002'::uuid, 'designer')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select v.id, o.id, v.name, v.status from public.organizations o,
  (values ('00000000-0000-4000-bfc2-000000000001'::uuid, 'Ativo SL', 'ativo'), ('00000000-0000-4000-bfc2-000000000002'::uuid, 'Onboarding SL', 'onboarding')) v(id, name, status)
 where o.id = (select id from public.organizations order by created_at limit 1);
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-bfc2-000000000001', id, 0, private.today_sp() from public.service_catalog where key = 'conteudo_mensal';
-- mudança já agendada para o próximo mês (como faz set_client_service em cliente ativo)
update public.client_services set ends_on = private.today_sp() + 29 where client_id = '00000000-0000-4000-bfc2-000000000001';
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-bfc2-000000000001', id, 2, private.today_sp() + 30 from public.service_catalog where key = 'conteudo_mensal';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfc1-000000000002","role":"authenticated"}';
select throws_ok($$select public.set_client_service_now('00000000-0000-4000-bfc2-000000000001', (select id from public.service_catalog where key = 'conteudo_mensal'), 4)$$,
  '42501', null, 'quem não gerencia o cliente não altera');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfc1-000000000001","role":"authenticated"}';
select is(public.set_client_service_now('00000000-0000-4000-bfc2-000000000001', (select id from public.service_catalog where key = 'conteudo_mensal'), 4), 4,
  'cria as 4 demandas do mês na hora');
select is(public.set_client_service_now('00000000-0000-4000-bfc2-000000000001', (select id from public.service_catalog where key = 'conteudo_mensal'), 4), 0,
  'rodar de novo não duplica');
select is((select string_agg(monthly_qty::text || '/' || coalesce(ends_on::text, 'sem fim'), ',') from public.client_services where client_id = '00000000-0000-4000-bfc2-000000000001'),
  '4/sem fim', 'a mudança agendada sai e o serviço continua com a quantidade nova');
select is((select count(*)::int from public.tasks where client_id = '00000000-0000-4000-bfc2-000000000001' and slot_month is not null and deleted_at is null), 4,
  'as demandas do mês ficam no cliente');
select throws_ok($$select public.set_client_service_now('00000000-0000-4000-bfc2-000000000002', (select id from public.service_catalog where key = 'conteudo_mensal'), 4)$$,
  'P0001', null, 'cliente em onboarding é ajustado pela ficha');
select throws_ok($$select public.set_client_service_now('00000000-0000-4000-bfc2-000000000001', (select id from public.service_catalog where key = 'conteudo_mensal'), 500)$$,
  'P0001', 'Quantidade inválida.', 'quantidade fora do limite');

select * from finish();
rollback;
