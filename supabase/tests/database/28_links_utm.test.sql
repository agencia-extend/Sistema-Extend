-- Links com UTM (RF-ADS-11): quem lê, quem gera, conferência do link e sem duplicar.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-- Ana (gestora) no tráfego do cliente; Edu (gestor) fora; Vic (editor) no design do cliente.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b800-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.utm@extend.test', '{"full_name":"Ana UTM"}', now()),
  ('00000000-0000-4000-b800-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.utm@extend.test', '{"full_name":"Edu UTM"}', now()),
  ('00000000-0000-4000-b800-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vic.utm@extend.test', '{"full_name":"Vic UTM"}', now());
update public.profiles set is_active = true where email like '%.utm@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.utm@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-b800-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-b800-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-b800-000000000003'::uuid, 'editor_video')) x(u, k) on r.key = x.k;

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-b810-000000000001', id, 'Clínica UTM', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b810-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-b800-000000000001'::uuid), ('edicao', '00000000-0000-4000-b800-000000000003'::uuid)) x(k, u) on s.key = x.k;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b800-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url)
  values ('00000000-0000-4000-b810-000000000001', 'Bio do Instagram', 'outro', 'https://clinica.com.br/', 'instagram', 'bio', 'perfil',
          'https://clinica.com.br/?utm_source=instagram&utm_medium=bio&utm_campaign=perfil')$$, 'gestora gera o link');
select is((select created_by from public.utm_links), '00000000-0000-4000-b800-000000000001'::uuid, 'o autor é quem está logado');
select throws_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url)
  values ('00000000-0000-4000-b810-000000000001', 'Bio de novo', 'outro', 'https://clinica.com.br/', 'instagram', 'bio', 'perfil',
          'https://clinica.com.br/?utm_source=instagram&utm_medium=bio&utm_campaign=perfil')$$, '23505', null, 'o mesmo link não é gerado duas vezes');
select throws_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url)
  values ('00000000-0000-4000-b810-000000000001', 'Golpe', 'outro', 'https://clinica.com.br/', 'instagram', 'bio', 'perfil',
          'https://outro-site.com/?utm_source=instagram&utm_medium=bio&utm_campaign=perfil')$$, 'P0001', 'O link não corresponde ao destino e às UTMs informadas.', 'o link precisa partir do destino');
select throws_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url)
  values ('00000000-0000-4000-b810-000000000001', 'Sem UTM', 'outro', 'https://clinica.com.br/', 'instagram', 'bio', 'perfil', 'https://clinica.com.br/')$$,
  'P0001', 'O link não corresponde ao destino e às UTMs informadas.', 'o link precisa ter as UTMs');
select throws_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url, created_by)
  values ('00000000-0000-4000-b810-000000000001', 'Autor', 'outro', 'https://clinica.com.br/', 'a', 'b', 'c', 'https://clinica.com.br/?utm_source=a&utm_medium=b&utm_campaign=c', '00000000-0000-4000-b800-000000000002')$$,
  '42501', null, 'o autor não vem do formulário');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b800-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.utm_links), 0, 'gestor de fora do cliente não vê');
select throws_ok($$insert into public.utm_links (client_id, label, platform, base_url, source, medium, campaign, url)
  values ('00000000-0000-4000-b810-000000000001', 'Fora', 'outro', 'https://clinica.com.br/', 'a', 'b', 'c', 'https://clinica.com.br/?utm_source=a&utm_medium=b&utm_campaign=c')$$,
  '42501', null, 'gestor de fora do cliente não gera');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b800-000000000003","role":"authenticated"}';
delete from public.utm_links;
select is((select count(*)::int from public.utm_links), 0, 'editor do cliente não vê o tráfego');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b800-000000000001","role":"authenticated"}';
delete from public.utm_links;
reset role;
select is((select count(*)::int from public.utm_links where client_id = '00000000-0000-4000-b810-000000000001'), 0, 'quem otimiza o cliente apaga');

select * from finish();
rollback;
