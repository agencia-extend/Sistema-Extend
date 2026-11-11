-- Etapa 01 · Notificações: cada um vê só as suas; notify não avisa quem fez a ação; deduplica.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at)
values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a.notif@extend.test', '{}', now()),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b.notif@extend.test', '{}', now());
update public.profiles set is_active = true where id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002');

-- notify chamado "como" o usuário A (auth.uid() = A): B recebe, A não.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';
select is(private.notify(array['00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002']::uuid[],
  'assigned', 'Teste', null, '/inicio', 'teste:1'), 1, 'notify não avisa quem fez a ação');
select is(private.notify(array['00000000-0000-4000-b000-000000000002']::uuid[], 'assigned', 'Teste', null, '/inicio', 'teste:1'), 0, 'notify deduplica pela chave');

insert into public.notification_preferences (user_id, kind, in_app, push) values ('00000000-0000-4000-b000-000000000002', 'comment', true, false);
select private.notify(array['00000000-0000-4000-b000-000000000002']::uuid[], 'comment', 'Sem push', null, null, 'teste:2');
select is((select push_status from public.notifications where dedupe_key = 'teste:2'), 'skipped', 'preferência sem push marca skipped');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.notifications), 2, 'B vê as próprias notificações');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.notifications), 0, 'A não vê as notificações de B');
select throws_ok($$insert into public.notifications (organization_id, user_id, kind, title)
  select organization_id, id, 'system', 'x' from public.profiles where id = auth.uid()$$, '42501', null, 'usuário não cria notificação direto');

select * from finish();
rollback;
