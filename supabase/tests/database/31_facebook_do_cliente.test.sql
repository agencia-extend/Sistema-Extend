-- Facebook do cliente: conexão por cliente, link para o cliente autorizar e quem gerencia.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

-- Gil (gestor de tráfego) cuida do cliente A; Ivo (gestor) não; Cora (coordenação de conteúdo) só lê anúncios do cliente A.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bb00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.fc@extend.test', '{"full_name":"Gil FC"}', now()),
  ('00000000-0000-4000-bb00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ivo.fc@extend.test', '{"full_name":"Ivo FC"}', now()),
  ('00000000-0000-4000-bb00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cora.fc@extend.test', '{"full_name":"Cora FC"}', now());
update public.profiles set is_active = true where email like '%.fc@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.fc@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bb00-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bb00-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bb00-000000000003'::uuid, 'coord_conteudo')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bb10-000000000001', id, 'FC Cliente A', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bb10-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bb00-000000000001'::uuid), ('gerenciamento', '00000000-0000-4000-bb00-000000000003'::uuid)) x(k, u) on s.key = x.k;

-- Conexão do cliente (feita pelo servidor) e uma conta encontrada por ela.
insert into public.integration_connections (id, organization_id, provider, purpose, owner_kind, client_id, account_name, token_enc, expires_at, connected_by)
select '00000000-0000-4000-bb20-000000000001', organization_id, 'meta', 'ads', 'client', id, 'Dona do Cliente A', 'iv.tag.segredo', now() + interval '60 days', '00000000-0000-4000-bb00-000000000001'
  from public.clients where id = '00000000-0000-4000-bb10-000000000001';
insert into public.ad_accounts (id, organization_id, provider, external_id, name, connection_id, client_id)
select '00000000-0000-4000-bb30-000000000001', organization_id, 'meta', 'act_77001', 'Conta FC', '00000000-0000-4000-bb20-000000000001', id
  from public.clients where id = '00000000-0000-4000-bb10-000000000001';

select throws_ok($$insert into public.integration_connections (organization_id, provider, purpose, owner_kind, client_id, token_enc)
  select organization_id, 'meta', 'ads', 'client', id, 'x' from public.clients where id = '00000000-0000-4000-bb10-000000000001'$$, '23505', null, 'um Facebook por cliente');
select throws_ok($$insert into public.integration_connections (organization_id, provider, purpose, owner_kind, token_enc)
  select id, 'meta', 'ads', 'client', 'x' from public.organizations limit 1$$, '23514', null, 'conexão do cliente exige o cliente');
select throws_ok($$insert into public.integration_connections (organization_id, provider, purpose, owner_kind, client_id, token_enc)
  select organization_id, 'google', 'ads', 'client', id, 'x' from public.clients where id = '00000000-0000-4000-bb10-000000000001'$$, '23514', null, 'Facebook do cliente é só da Meta');

create temp table t_fc (id uuid) on commit drop;
grant all on t_fc to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bb00-000000000001","role":"authenticated"}';
select is(public.can_manage_client_ads('00000000-0000-4000-bb10-000000000001'), true, 'gestor do cliente pode conectar o Facebook dele');
select is((select client_name from public.integration_status() where owner_kind = 'client' and client_id = '00000000-0000-4000-bb10-000000000001'), 'FC Cliente A', 'e vê a situação da conexão do cliente');
insert into t_fc select public.create_client_connect_link('00000000-0000-4000-bb10-000000000001', repeat('a', 64), 7);
select public.create_client_connect_link('00000000-0000-4000-bb10-000000000001', repeat('b', 64), 7);
select is((select count(*)::int from public.client_connect_links where client_id = '00000000-0000-4000-bb10-000000000001' and revoked_at is null), 1, 'gerar outro link cancela o anterior');
select is((select revoked_at is not null from public.client_connect_links where id = (select id from t_fc)), true, 'o primeiro fica cancelado');
select lives_ok($$select public.toggle_client_ad_account('00000000-0000-4000-bb30-000000000001', true)$$, 'gestor liga a conta do cliente');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bb00-000000000002","role":"authenticated"}';
select is(public.can_manage_client_ads('00000000-0000-4000-bb10-000000000001'), false, 'gestor de fora do cliente não pode');
select throws_ok($$select public.create_client_connect_link('00000000-0000-4000-bb10-000000000001', repeat('c', 64), 7)$$, '42501', null, 'nem gerar link');
select throws_ok($$select public.toggle_client_ad_account('00000000-0000-4000-bb30-000000000001', false)$$, '42501', null, 'nem ligar ou desligar a conta');
select is((select count(*)::int from public.client_connect_links where client_id = '00000000-0000-4000-bb10-000000000001'), 0, 'nem vê os links do cliente');
select is((select count(*)::int from public.integration_status() where owner_kind = 'client' and client_id = '00000000-0000-4000-bb10-000000000001'), 0, 'nem a conexão do cliente');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bb00-000000000003","role":"authenticated"}';
select throws_ok($$select public.create_client_connect_link('00000000-0000-4000-bb10-000000000001', repeat('d', 64), 7)$$, '42501', null, 'quem só lê anúncios não gera link');
reset role;

select * from finish();
rollback;
