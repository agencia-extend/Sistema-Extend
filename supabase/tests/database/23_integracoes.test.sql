-- Integrações: tokens fora do alcance dos usuários, situação sem tokens, contas por cliente e avisos de conexão.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- Gil (gerente de tráfego) conecta; Ana (gestora) está na equipe do Cliente A; Sol (social media) não tem tráfego.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b300-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.in@extend.test', '{"full_name":"Gil IN"}', now()),
  ('00000000-0000-4000-b300-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.in@extend.test', '{"full_name":"Ana IN"}', now()),
  ('00000000-0000-4000-b300-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.in@extend.test', '{"full_name":"Sol IN"}', now());
update public.profiles set is_active = true where email like '%.in@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.in@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b300-000000000001', id from public.roles where key = 'gerente_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b300-000000000002', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b300-000000000003', id from public.roles where key = 'social_media';

insert into public.clients (id, organization_id, name, status)
select ('00000000-0000-4000-b310-00000000000' || n)::uuid, id, 'Cliente Integra ' || n, 'ativo' from public.organizations cross join generate_series(1, 2) n;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b310-000000000001', id, '00000000-0000-4000-b300-000000000002' from public.sectors where key = 'trafego';

-- Conexão da agência (Meta, vence em 3 dias) e a agenda da Sol (feitas pelo servidor).
delete from public.integration_connections;
insert into public.integration_connections (id, organization_id, provider, purpose, owner_kind, account_name, token_enc, expires_at, connected_by)
select '00000000-0000-4000-b320-000000000001', id, 'meta', 'ads', 'agency', 'Gil IN', 'iv.tag.segredo', now() + interval '3 days', '00000000-0000-4000-b300-000000000001' from public.organizations order by created_at limit 1;
insert into public.integration_connections (id, organization_id, provider, purpose, owner_kind, profile_id, account_name, token_enc, refresh_token_enc)
select '00000000-0000-4000-b320-000000000002', id, 'google', 'calendar', 'user', '00000000-0000-4000-b300-000000000003', 'sol@gmail.com', 'iv.tag.x', 'iv.tag.y' from public.organizations order by created_at limit 1;
select throws_ok($$insert into public.integration_connections (organization_id, provider, purpose, owner_kind, token_enc) select id, 'meta', 'ads', 'agency', 'x' from public.organizations limit 1$$,
  '23505', null, 'uma conexão Meta por agência');

insert into public.ad_accounts (id, organization_id, provider, external_id, name, connection_id)
select ('00000000-0000-4000-b330-00000000000' || n)::uuid, id, 'meta', 'act_90' || n, 'Conta ' || n, '00000000-0000-4000-b320-000000000001'
  from public.organizations cross join generate_series(1, 2) n;
insert into public.client_accounts (client_id, kind, value) values ('00000000-0000-4000-b310-000000000001', 'ad_account_meta', '901');

set local role authenticated;
-- Tokens: ninguém lê a tabela.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b300-000000000001","role":"authenticated"}';
select throws_ok($$select token_enc from public.integration_connections$$, '42501', null, 'nem quem conecta lê os tokens');
select is((select count(*)::int from public.integration_status() where owner_kind = 'agency'), 1, 'gerente vê a situação da conexão da agência');
select is((select count(*)::int from public.integration_status() where owner_kind = 'user'), 0, 'e não vê a agenda conectada de outra pessoa');
select is((select count(*)::int from public.ad_accounts where external_id like 'act_90%'), 2, 'gerente vê todas as contas encontradas');

-- Gestora: não liga conta; vê só as contas ligadas aos clientes dela.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b300-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_ad_account('00000000-0000-4000-b330-000000000001', true, '00000000-0000-4000-b310-000000000001')$$, '42501', null, 'gestora não liga conta a cliente');
select is((select count(*)::int from public.ad_accounts), 0, 'conta sem cliente não aparece para a gestora');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b300-000000000001","role":"authenticated"}';
select throws_ok($$select public.save_ad_account('00000000-0000-4000-b330-000000000001', true, null)$$, 'P0001', 'Escolha o cliente antes de incluir a conta.', 'incluir exige cliente');
select lives_ok($$select public.save_ad_account('00000000-0000-4000-b330-000000000001', true, '00000000-0000-4000-b310-000000000001')$$, 'gerente liga a conta ao Cliente A');
select lives_ok($$select public.save_ad_account('00000000-0000-4000-b330-000000000002', false, '00000000-0000-4000-b310-000000000002')$$, 'e a outra ao Cliente B, fora do sistema');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b300-000000000002","role":"authenticated"}';
select is((select array_agg(name) from public.ad_accounts), array['Conta 1'], 'gestora vê só a conta do cliente dela');
select is((select count(*)::int from public.integration_status() where owner_kind = 'agency'), 1, 'e a situação da conexão da agência');

-- Social media: nada de tráfego; vê a própria agenda.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b300-000000000003","role":"authenticated"}';
select is((select array_agg(provider || ':' || owner_kind) from public.integration_status()), array['google:user'], 'social media vê só a própria agenda conectada');
select is((select count(*)::int from public.ad_accounts), 0, 'e nenhuma conta de anúncio');
select throws_ok($$select public.notify_perm_holders(null, 'ads.connect', 'system', 'x', null, '/inicio', 'x', null)$$, '42501', null, 'usuário não chama o aviso em massa');
reset role;

select is((select count(*)::int from public.client_accounts where client_id = '00000000-0000-4000-b310-000000000001' and kind = 'ad_account_meta'), 1,
  'conta já cadastrada no cliente não duplica (901 = act_901)');
select is((select value from public.client_accounts where client_id = '00000000-0000-4000-b310-000000000002' and kind = 'ad_account_meta'), 'act_902',
  'conta nova vai para Contas e acessos do cliente');

-- Aviso de conexão vencendo: uma vez; parada: avisa de novo.
delete from public.notifications where user_id in (select id from public.profiles where email like '%.in@extend.test');
select private.integrations_tick();
select private.integrations_tick();
select is((select array_agg(title) from public.notifications where user_id = '00000000-0000-4000-b300-000000000001'),
  array['Conexão com Meta (Facebook e Instagram) vence em 3 dias'], 'quem conecta é avisado uma vez do vencimento');
update public.integration_connections set status = 'expired', last_error = 'A conexão com a Meta expirou ou foi revogada. Conecte de novo.' where id = '00000000-0000-4000-b320-000000000001';
select private.integrations_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b300-000000000001' and title = 'Conexão com Meta (Facebook e Instagram) parou'), 1,
  'conexão parada avisa (a gestora, sem ads.connect, não)');

select * from finish();
rollback;
