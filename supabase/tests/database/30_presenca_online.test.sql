-- Presença "quem está online": só a equipe ativa da organização entra no canal privado.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ba00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lia.po@extend.test', '{"full_name":"Lia PO"}', now()),
  ('00000000-0000-4000-ba00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ex.po@extend.test', '{"full_name":"Ex PO"}', now());
update public.profiles set is_active = true where email = 'lia.po@extend.test';
update public.profiles set is_active = false where email = 'ex.po@extend.test';

create temp table t_po (topic text) on commit drop;
insert into t_po select 'equipe:' || id from public.organizations order by created_at limit 1;
grant select on t_po to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ba00-000000000001","role":"authenticated"}';
select set_config('realtime.topic', (select topic from t_po), true);
select lives_ok($$insert into realtime.messages (topic, extension, private) values ((select topic from t_po), 'presence', true)$$, 'pessoa da equipe anuncia presença no canal da organização');
select is((select count(*)::int from realtime.messages where topic = (select topic from t_po) and extension = 'presence'), 1, 'e vê a presença do canal');
select throws_ok($$insert into realtime.messages (topic, extension, private) values ((select topic from t_po), 'broadcast', true)$$, '42501', null, 'o canal é só de presença');

select set_config('realtime.topic', 'equipe:00000000-0000-0000-0000-000000000000', true);
select throws_ok($$insert into realtime.messages (topic, extension, private) values ('equipe:00000000-0000-0000-0000-000000000000', 'presence', true)$$, '42501', null, 'canal de outra organização é negado');
select is((select count(*)::int from realtime.messages), 0, 'não vê presença de outra organização');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-ba00-000000000002","role":"authenticated"}';
select set_config('realtime.topic', (select topic from t_po), true);
select throws_ok($$insert into realtime.messages (topic, extension, private) values ((select topic from t_po), 'presence', true)$$, '42501', null, 'pessoa desativada não entra');
reset role;

select * from finish();
rollback;
