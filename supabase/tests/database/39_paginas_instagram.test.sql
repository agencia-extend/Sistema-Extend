-- Páginas e Instagram dos clientes (RF-CON-02): quem liga ao cliente, quem vê os perfis e as publicações,
-- e o link que entra em "Contas e acessos".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf04-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gal.sp@extend.test', '{"full_name":"Gal SP"}', now()),
  ('00000000-0000-4000-bf04-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.sp@extend.test', '{"full_name":"Sol SP"}', now()),
  ('00000000-0000-4000-bf04-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui.sp@extend.test', '{"full_name":"Rui SP"}', now());
update public.profiles set is_active = true where email like '%.sp@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.sp@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf04-000000000001'::uuid, 'gerente_trafego'), ('00000000-0000-4000-bf04-000000000002'::uuid, 'social_media'),
  ('00000000-0000-4000-bf04-000000000003'::uuid, 'social_media')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf14-000000000001', id, 'SP Restaurante', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf14-000000000001', s.id, '00000000-0000-4000-bf04-000000000002' from public.sectors s where s.key = 'conteudo';

insert into public.social_profiles (id, organization_id, platform, external_id, page_external_id, name, username)
select x.id, o.id, x.platform, x.ext, x.page, x.name, x.username from (select id from public.organizations order by created_at limit 1) o, (values
  ('00000000-0000-4000-bf24-000000000001'::uuid, 'facebook', 'pg9001', null, 'SP Restaurante', null),
  ('00000000-0000-4000-bf24-000000000002'::uuid, 'instagram', 'ig9001', 'pg9001', 'SP Restaurante', 'sp_restaurante')) x(id, platform, ext, page, name, username);
insert into public.social_posts (profile_id, external_id, caption, published_at)
values ('00000000-0000-4000-bf24-000000000002', 'm1', 'Prato do dia', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf04-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.social_profiles where external_id like '%9001'), 0, 'sem cliente, a social media não vê os perfis');
select throws_ok($$select public.save_social_profile('00000000-0000-4000-bf24-000000000002', '00000000-0000-4000-bf14-000000000001')$$,
  '42501', null, 'social media não liga perfis a clientes');
select is(public.can_refresh_social('00000000-0000-4000-bf14-000000000001'), true, 'mas pode pedir a atualização do cliente dela');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf04-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.social_profiles where external_id like '%9001'), 2, 'gerente de tráfego vê os perfis sem cliente');
select throws_ok($$select public.save_social_profile('00000000-0000-4000-bf24-000000000002', '00000000-0000-4000-bf99-000000000099')$$,
  'P0002', 'Cliente não encontrado.', 'cliente inexistente');
select lives_ok($$select public.save_social_profile('00000000-0000-4000-bf24-000000000002', '00000000-0000-4000-bf14-000000000001')$$, 'gerente liga o Instagram ao cliente');
select lives_ok($$select public.save_social_profile('00000000-0000-4000-bf24-000000000001', '00000000-0000-4000-bf14-000000000001')$$, 'e a página');
select lives_ok($$select public.save_social_profile('00000000-0000-4000-bf24-000000000002', '00000000-0000-4000-bf14-000000000001')$$, 'salvar de novo não duplica');
reset role;
set local request.jwt.claims = '';
select is((select string_agg(kind || '=' || value, ',' order by kind) from public.client_accounts where client_id = '00000000-0000-4000-bf14-000000000001'),
  'instagram=https://www.instagram.com/sp_restaurante,page=https://www.facebook.com/pg9001', 'os links entram em Contas e acessos uma vez');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf04-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.social_profiles where client_id = '00000000-0000-4000-bf14-000000000001'), 2, 'a social media do cliente vê os perfis');
select is((select caption from public.social_posts where external_id = 'm1'), 'Prato do dia', 'e as publicações');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf04-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.social_posts where external_id = 'm1'), 0, 'quem não é do cliente não vê as publicações');
reset role;

select * from finish();
rollback;
