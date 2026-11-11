-- Etapa 01 · RLS e travas de acesso. Roda dentro de uma transação com ROLLBACK
-- (npm run db:test). Simula usuários com "set local role authenticated" + JWT.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

-- Usuários de teste (o trigger cria os perfis). IDs fixos para legibilidade.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at)
values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.teste@extend.test', '{"full_name":"Admin Teste"}', now()),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor.teste@extend.test', '{"full_name":"Editor Teste"}', now()),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rh.teste@extend.test', '{"full_name":"RH Teste"}', now());

update public.profiles set is_active = true where id in (
  '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003');

-- Papéis definidos como superusuário (sem auth.uid(), a trava não se aplica).
delete from public.user_roles where user_id in (
  '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003');
insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000001', id from public.roles where key = 'admin';
insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000002', id from public.roles where key = 'editor_video';
-- "RH": papel personalizado que gerencia usuários mas não é administrador.
insert into public.roles (organization_id, key, name, is_system)
select id, 'rh_teste', 'RH Teste', false from public.organizations order by created_at limit 1;
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, k, 'all' from public.roles r, unnest(array['users.manage', 'roles.manage', 'tasks.read']) k where r.key = 'rh_teste';
insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000003', id from public.roles where key = 'rh_teste';

-- ---------------------------------------------------------------- Editor
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';

select is((select scope::text from public.my_permissions() where permission_key = 'tasks.read'), 'own', 'editor: tasks.read com escopo own');
select ok(not exists (select 1 from public.my_permissions() where permission_key = 'users.manage'), 'editor: sem users.manage');
select is((select count(*)::int from public.user_roles where user_id <> auth.uid()), 0, 'editor: não vê papéis de outras pessoas');
select is((select count(*)::int from public.role_permissions), 0, 'editor: não vê a matriz de papéis');
select is((select count(*)::int from public.invitations), 0, 'editor: não vê convites');
select is((select count(*)::int from public.audit_logs), 0, 'editor: não vê auditoria');
select throws_ok(
  $$insert into public.user_permission_overrides (user_id, permission_key, effect, scope)
    values ('00000000-0000-4000-a000-000000000002', 'users.manage', 'grant', 'all')$$,
  '42501', null, 'editor: não se concede permissão por exceção');
select throws_ok(
  $$insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a000-000000000002', id from public.roles where key = 'admin'$$,
  '42501', null, 'editor: não se dá o papel Administrador');
select throws_ok(
  $$select public.admin_set_user_active('00000000-0000-4000-a000-000000000001', false)$$,
  '42501', null, 'editor: não desativa ninguém');
select throws_ok(
  $$select public.user_effective_permissions('00000000-0000-4000-a000-000000000001')$$,
  '42501', null, 'editor: não usa o "Ver como"');
update public.profiles set full_name = 'Editor Alterado' where id = '00000000-0000-4000-a000-000000000001';
select is((select full_name from public.profiles where id = '00000000-0000-4000-a000-000000000001'), 'Admin Teste', 'editor: não altera o perfil de outra pessoa');

-- ---------------------------------------------------------------- RH (não admin)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-a000-000000000002', (select id from public.roles where key = 'admin'))$$,
  '42501', null, 'RH: não atribui o papel Administrador');
select throws_ok(
  $$insert into public.user_permission_overrides (user_id, permission_key, effect, scope)
    values ('00000000-0000-4000-a000-000000000003', 'audit.read', 'grant', 'all')$$,
  '42501', null, 'RH: não se dá permissão');
select throws_ok(
  $$insert into public.user_permission_overrides (user_id, permission_key, effect, scope)
    values ('00000000-0000-4000-a000-000000000002', 'audit.read', 'grant', 'all')$$,
  '42501', null, 'RH: não concede ao outro o que ele mesmo não tem');
select lives_ok(
  $$insert into public.user_permission_overrides (user_id, permission_key, effect, scope)
    values ('00000000-0000-4000-a000-000000000002', 'tasks.read', 'grant', 'all')$$,
  'RH: concede ao outro o que ele tem, no mesmo escopo');
select throws_ok(
  $$select public.admin_set_user_active('00000000-0000-4000-a000-000000000001', false)$$,
  '42501', null, 'RH: não desativa um administrador');

-- ---------------------------------------------------------------- Admin
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';

select is((select scope::text from public.user_effective_permissions('00000000-0000-4000-a000-000000000002') where permission_key = 'tasks.read'),
  'all', 'admin: "Ver como" mostra a exceção concedida (tasks.read = all)');
select lives_ok(
  $$insert into public.user_permission_overrides (user_id, permission_key, effect, scope)
    values ('00000000-0000-4000-a000-000000000002', 'tasks.manage', 'deny', 'all')$$,
  'admin: bloqueia permissão por exceção');
select ok(not exists (select 1 from public.user_effective_permissions('00000000-0000-4000-a000-000000000002') where permission_key = 'tasks.manage'),
  'admin: bloqueio vale na hora');
select ok(exists (select 1 from public.audit_logs where entity_type = 'user_permission_overrides' and actor_id = auth.uid()),
  'auditoria registra a exceção com o autor');
select lives_ok($$select public.send_test_notification('00000000-0000-4000-a000-000000000002')$$, 'admin: envia notificação de teste');
select lives_ok($$select public.admin_set_user_active('00000000-0000-4000-a000-000000000002', false)$$, 'admin: desativa o editor');

select * from finish();
rollback;
