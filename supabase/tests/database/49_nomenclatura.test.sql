-- Nomenclatura padrão (RF-PLA-03): quem conecta as contas salva; o gestor e quem vê anúncios leem; quem não vê
-- anúncios não lê; caracteres estranhos não entram.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf71-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ge.nm@extend.test', '{"full_name":"Ge NM"}', now()),
  ('00000000-0000-4000-bf71-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gs.nm@extend.test', '{"full_name":"Gs NM"}', now()),
  ('00000000-0000-4000-bf71-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ed.nm@extend.test', '{"full_name":"Ed NM"}', now());
update public.profiles set is_active = true where email like '%.nm@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.nm@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf71-000000000001'::uuid, 'gerente_trafego'), ('00000000-0000-4000-bf71-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bf71-000000000003'::uuid, 'editor_video')) x(u, k) on r.key = x.k;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_naming_convention('{CLIENTE}_{OBJETIVO}', '{PUBLICO}', '{FORMATO}')$$, '42501', null, 'gestor não muda a nomenclatura');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_naming_convention('{CLIENTE}_{OBJETIVO}_{AAAA-MM}', '{PUBLICO}_{IDADE}', '{FORMATO}_{CR}_{V#}')$$, 'gerente de tráfego salva');
select throws_ok($$select public.save_naming_convention('{CLIENTE};drop', '{PUBLICO}', '{FORMATO}')$$, '23514', null, 'caractere estranho não entra');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000002","role":"authenticated"}';
select is((select ad from public.naming_conventions), '{FORMATO}_{CR}_{V#}', 'gestor lê o padrão');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.naming_conventions), 0, 'quem não vê anúncios não lê');
reset role;
select is((select updated_by from public.naming_conventions), '00000000-0000-4000-bf71-000000000001'::uuid, 'guarda quem mudou');

select * from finish();
rollback;
