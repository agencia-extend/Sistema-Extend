-- Painel de alertas (RF-ALE-03): ciclo aberto → reconhecido → resolvido, resolução automática e quem pode agir.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf01-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.pa@extend.test', '{"full_name":"Ana PA"}', now()),
  ('00000000-0000-4000-bf01-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bia.pa@extend.test', '{"full_name":"Bia PA"}', now()),
  ('00000000-0000-4000-bf01-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cid.pa@extend.test', '{"full_name":"Cid PA"}', now()),
  ('00000000-0000-4000-bf01-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'davi.pa@extend.test', '{"full_name":"Davi PA"}', now());
update public.profiles set is_active = true where email like '%.pa@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pa@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf01-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf01-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bf01-000000000003'::uuid, 'coord_conteudo'), ('00000000-0000-4000-bf01-000000000004'::uuid, 'gestor_trafego')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf11-000000000001', id, 'PA Ótica', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf11-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bf01-000000000001'::uuid), ('trafego', '00000000-0000-4000-bf01-000000000004'::uuid),
  ('gerenciamento', '00000000-0000-4000-bf01-000000000003'::uuid)) x(k, u) on s.key = x.k;
-- Conta pré-paga: R$ 50 por dia nos últimos 7 dias e R$ 50 de saldo (1 dia).
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled, is_prepay, funds_cents)
select '00000000-0000-4000-bf21-000000000001', organization_id, 'meta', 'act_77001', 'PA Conta', id, true, true, 5000 from public.clients where id = '00000000-0000-4000-bf11-000000000001';
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents)
select '00000000-0000-4000-bf21-000000000001', 'account', 'act_77001', private.today_sp() - d, 5000 from generate_series(1, 7) d;

select private.ads_alerts_tick();
select private.ads_alerts_tick();
select is((select count(*)::int from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001' and kind = 'saldo' and status = 'aberto'), 1,
  'saldo para 1 dia abre um alerta, e a verificação seguinte não duplica');
select is((select times_seen from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'), 2, 'conta quantas vezes a condição foi vista');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf01-000000000001' and title = 'Saldo acabando: PA Ótica'), 1,
  'o tráfego do cliente recebe o aviso uma vez no dia');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf01-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'), 1, 'quem lê os anúncios do cliente vê o alerta');
select throws_ok($$select public.ack_ad_alert((select id from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'))$$,
  '42501', null, 'mas não reconhece');
select throws_ok($$insert into public.ad_alerts (organization_id, kind, subject, title) select organization_id, 'saldo', 'x', 'x' from public.clients limit 1$$,
  '42501', null, 'ninguém grava alerta direto');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf01-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'), 0, 'gestor de fora não vê');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf01-000000000001","role":"authenticated"}';
select lives_ok($$select public.ack_ad_alert((select id from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'))$$, 'gestor do cliente reconhece');
select is((select status || ':' || (ack_by = '00000000-0000-4000-bf01-000000000001')::text from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'),
  'reconhecido:true', 'fica reconhecido, com quem reconheceu');
select throws_ok($$select public.ack_ad_alert((select id from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'))$$,
  'P0001', 'Este alerta já foi reconhecido.', 'não reconhece duas vezes');
reset role;

select is(private.raise_ad_alert((select organization_id from public.clients where id = '00000000-0000-4000-bf11-000000000001'), '00000000-0000-4000-bf11-000000000001',
  'saldo', '00000000-0000-4000-bf21-000000000001', 'Saldo acabando: PA Ótica', 'x', null), false, 'reconhecido não avisa de novo');

-- Recarregou: a verificação seguinte resolve sozinha.
update public.ad_accounts set funds_cents = 500000 where id = '00000000-0000-4000-bf21-000000000001';
select private.ads_alerts_tick();
select is((select status || ':' || coalesce(resolved_by::text, 'auto') from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001'),
  'resolvido:auto', 'saldo recarregado resolve o alerta sozinho');

-- Acabou de novo: alerta novo, resolvido à mão com a nota.
update public.ad_accounts set funds_cents = 4000 where id = '00000000-0000-4000-bf21-000000000001';
select private.ads_alerts_tick();
select is((select count(*)::int from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001' and status = 'aberto'), 1, 'a condição de volta abre um alerta novo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf01-000000000001","role":"authenticated"}';
select throws_ok($$select public.resolve_ad_alert((select id from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001' and status = 'aberto'), ' a ')$$,
  '22023', null, 'resolver pede como foi resolvido');
select lives_ok($$select public.resolve_ad_alert((select id from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001' and status = 'aberto'), 'Cliente recarregou R$ 500 no Pix.')$$,
  'gestor resolve com a nota');
reset role;
select is((select resolution from public.ad_alerts where client_id = '00000000-0000-4000-bf11-000000000001' and resolved_by = '00000000-0000-4000-bf01-000000000001'),
  'Cliente recarregou R$ 500 no Pix.', 'fica quem resolveu e como');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf01-000000000004' and title = 'Alerta resolvido: Saldo acabando: PA Ótica'), 1,
  'o restante do tráfego do cliente fica sabendo');

select * from finish();
rollback;
