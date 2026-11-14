-- Privacidade (LGPD): pedidos dos titulares, ciência da política, exportação e retenção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-a800-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu.p@extend.test', '{"full_name":"Madu P"}', now()),
  ('00000000-0000-4000-a800-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.p@extend.test', '{"full_name":"Admin P"}', now()),
  ('00000000-0000-4000-a800-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bia.p@extend.test', '{"full_name":"Bia P"}', now());
update public.profiles set is_active = true where email like '%.p@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.p@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a800-000000000001', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a800-000000000003', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a800-000000000002', id from public.roles where key = 'admin';

set local role authenticated;

-- Madu registra ciência e faz um pedido.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a800-000000000001","role":"authenticated"}';
insert into public.privacy_consents (profile_id, version) values (auth.uid(), '2026-11-13');
select throws_ok($$insert into public.privacy_consents (profile_id, version) values ('00000000-0000-4000-a800-000000000003', '2026-11-13')$$, '42501', null, 'ninguém registra ciência por outra pessoa');
insert into public.privacy_requests (id, kind, details) values ('00000000-0000-4000-a810-000000000001', 'correcao', 'Meu telefone mudou.');
select is((select due_on from public.privacy_requests where id = '00000000-0000-4000-a810-000000000001'), private.today_sp() + 15, 'prazo legal de 15 dias');
select throws_ok($$insert into public.privacy_requests (kind, status) values ('acesso', 'concluido')$$, '42501', null, 'quem pede não cria pedido já concluído');
select throws_ok($$insert into public.privacy_requests (profile_id, kind) values ('00000000-0000-4000-a800-000000000003', 'acesso')$$, '42501', null, 'nem pede em nome de outra pessoa');
update public.privacy_requests set status = 'concluido', response = 'Feito por mim' where id = '00000000-0000-4000-a810-000000000001';
select is((select status from public.privacy_requests where id = '00000000-0000-4000-a810-000000000001'), 'aberto', 'quem pede não marca o próprio pedido como atendido');
select throws_ok($$insert into public.privacy_settings (organization_id, legal_name) values (private.org_id(), 'X')$$, '42501', null, 'social media não edita os dados do controlador');

-- Exportação: só os próprios dados.
select is((public.my_personal_data() -> 'perfil' ->> 'email'), 'madu.p@extend.test', 'exporta o próprio perfil');
select is(jsonb_array_length(public.my_personal_data() -> 'pedidos_de_privacidade'), 1, 'e os próprios pedidos');

-- Bia não vê o pedido nem a ciência da Madu.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a800-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.privacy_requests), 0, 'outra pessoa não vê o pedido');
select is((select count(*)::int from public.privacy_consents), 0, 'nem a ciência dos outros');

-- Admin foi avisado, vê, responde e preenche o controlador.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a800-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'privacy' and title like 'Pedido de privacidade:%'), 1, 'admin é avisado do pedido');
select is((select count(*)::int from public.privacy_requests where id = '00000000-0000-4000-a810-000000000001'), 1, 'admin vê o pedido');
select throws_ok($$update public.privacy_requests set status = 'concluido', response = null where id = '00000000-0000-4000-a810-000000000001'$$, '23514', null, 'concluir exige resposta');
update public.privacy_requests set status = 'concluido', response = 'Telefone corrigido no seu perfil.' where id = '00000000-0000-4000-a810-000000000001';
select isnt((select resolved_at from public.privacy_requests where id = '00000000-0000-4000-a810-000000000001'), null, 'registra quando foi atendido');
insert into public.privacy_settings (organization_id, legal_name, dpo_email) values (private.org_id(), 'Agência Extend Ltda', 'privacidade@agenciaextend.com.br')
  on conflict (organization_id) do update set legal_name = excluded.legal_name, dpo_email = excluded.dpo_email;
select is((select legal_name from public.privacy_settings where organization_id = private.org_id()), 'Agência Extend Ltda', 'admin edita o controlador');

reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-a800-000000000001' and kind = 'privacy' and title = 'Seu pedido de privacidade foi atendido'),
  'quem pediu é avisado da resposta');

-- Retenção apaga aviso lido há mais de 180 dias e mantém o recente.
insert into public.notifications (organization_id, user_id, kind, title, read_at, created_at)
select organization_id, id, 'teste', 'antigo', now() - interval '200 days', now() - interval '210 days' from public.profiles where id = '00000000-0000-4000-a800-000000000003';
select set_config('request.jwt.claims', '', true);
select private.privacy_retention_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-a800-000000000003' and title = 'antigo'), 0, 'aviso lido há mais de 180 dias é apagado');

select * from finish();
rollback;
