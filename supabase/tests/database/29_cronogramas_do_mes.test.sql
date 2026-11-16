-- Cronogramas do mês (RF-CON-01, visão do setor de gerenciamento): contagens e quem vê.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

-- Sol (social media) cuida do Cliente A; Rui (social media) do Cliente B; Coral (coordenação de conteúdo) vê todos;
-- Ana (gestora de tráfego) não tem o cronograma.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b900-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.cm@extend.test', '{"full_name":"Sol CM"}', now()),
  ('00000000-0000-4000-b900-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui.cm@extend.test', '{"full_name":"Rui CM"}', now()),
  ('00000000-0000-4000-b900-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coral.cm@extend.test', '{"full_name":"Coral CM"}', now()),
  ('00000000-0000-4000-b900-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.cm@extend.test', '{"full_name":"Ana CM"}', now());
update public.profiles set is_active = true where email like '%.cm@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.cm@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-b900-000000000001'::uuid, 'social_media'), ('00000000-0000-4000-b900-000000000002'::uuid, 'social_media'),
  ('00000000-0000-4000-b900-000000000003'::uuid, 'coord_conteudo'), ('00000000-0000-4000-b900-000000000004'::uuid, 'gestor_trafego')) x(u, k) on r.key = x.k;

insert into public.clients (id, organization_id, name, status)
select x.id, o.id, x.name, 'ativo' from (select id from public.organizations order by created_at limit 1) o cross join (values
  ('00000000-0000-4000-b910-000000000001'::uuid, 'CM Cliente A'), ('00000000-0000-4000-b910-000000000002'::uuid, 'CM Cliente B'),
  ('00000000-0000-4000-b910-000000000003'::uuid, 'CM Só Anúncios'), ('00000000-0000-4000-b910-000000000004'::uuid, 'CM Encerrou')) x(id, name);
insert into public.client_services (client_id, service_id, monthly_qty, ends_on)
select x.c, s.id, x.q, x.e from public.service_catalog s join (values
  ('00000000-0000-4000-b910-000000000001'::uuid, 'gerenciamento', 4, null::date),
  ('00000000-0000-4000-b910-000000000002'::uuid, 'gerenciamento', 2, null),
  ('00000000-0000-4000-b910-000000000003'::uuid, 'meta_ads', 0, null),
  ('00000000-0000-4000-b910-000000000004'::uuid, 'gerenciamento', 4, '2026-11-30')) x(c, k, q, e) on s.key = x.k;
insert into public.client_members (client_id, sector_id, profile_id)
select x.c, s.id, x.u from public.sectors s join (values
  ('00000000-0000-4000-b910-000000000001'::uuid, 'gerenciamento', '00000000-0000-4000-b900-000000000001'::uuid),
  ('00000000-0000-4000-b910-000000000002'::uuid, 'gerenciamento', '00000000-0000-4000-b900-000000000002'::uuid),
  ('00000000-0000-4000-b910-000000000001'::uuid, 'trafego', '00000000-0000-4000-b900-000000000004'::uuid)) x(c, k, u) on s.key = x.k;
delete from public.tasks where client_id::text like '00000000-0000-4000-b910-%';

-- Cliente A em dezembro: 2 com data (1 postado), 1 marcado para o cronograma sem data, 1 cancelado e 1 de janeiro (não contam).
insert into public.tasks (id, organization_id, client_id, type, title, status)
select x.id, c.organization_id, c.id, 'conteudo', x.t, x.st from public.clients c cross join (values
  ('00000000-0000-4000-b920-000000000001'::uuid, 'Post 1', 'pendente'), ('00000000-0000-4000-b920-000000000002'::uuid, 'Post 2', 'pendente'),
  ('00000000-0000-4000-b920-000000000003'::uuid, 'Post 3', 'pendente'), ('00000000-0000-4000-b920-000000000004'::uuid, 'Post 4', 'cancelado'),
  ('00000000-0000-4000-b920-000000000005'::uuid, 'Post 5', 'pendente')) x(id, t, st)
 where c.id = '00000000-0000-4000-b910-000000000001';
insert into public.task_content (task_id, post_on, post_url, destination) values
  ('00000000-0000-4000-b920-000000000001', '2026-12-03', 'https://instagram.com/p/abc', '{}'),
  ('00000000-0000-4000-b920-000000000002', '2026-12-10', null, '{}'),
  ('00000000-0000-4000-b920-000000000003', null, null, '{cronograma}'),
  ('00000000-0000-4000-b920-000000000004', '2026-12-12', null, '{}'),
  ('00000000-0000-4000-b920-000000000005', '2027-01-05', null, '{}')
on conflict (task_id) do update set post_on = excluded.post_on, post_url = excluded.post_url, destination = excluded.destination;
update public.tasks set status = 'cancelado' where id = '00000000-0000-4000-b920-000000000004';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b900-000000000001","role":"authenticated"}';
select is((select array_agg(client_name order by client_name) from public.schedule_overview('2026-12-01', '2026-12-31') where client_name like 'CM %'),
  array['CM Cliente A'], 'social media vê só os clientes dela com gerenciamento');
select is((select row(contracted, scheduled, posted, undated)::text from public.schedule_overview('2026-12-01', '2026-12-31') where client_name = 'CM Cliente A'),
  '(4,2,1,1)', 'contratados, programados no mês, postados e sem data');
select is((select mine from public.schedule_overview('2026-12-01', '2026-12-31') where client_name = 'CM Cliente A'), true, 'marca os clientes da pessoa');
select is((select social from public.schedule_overview('2026-12-01', '2026-12-31') where client_name = 'CM Cliente A'), array['Sol CM'], 'mostra quem cuida no gerenciamento');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b900-000000000003","role":"authenticated"}';
select is((select array_agg(client_name order by client_name) from public.schedule_overview('2026-12-01', '2026-12-31') where client_name like 'CM %'),
  array['CM Cliente A', 'CM Cliente B'], 'coordenação vê todos; só anúncios e contrato encerrado não entram');
select is((select row(contracted, scheduled, mine)::text from public.schedule_overview('2026-12-01', '2026-12-31') where client_name = 'CM Cliente B'), '(2,0,f)', 'cliente sem nada programado');
select is((select count(*)::int from public.schedule_overview('2026-11-01', '2026-11-30') where client_name = 'CM Encerrou'), 1, 'em novembro o contrato encerrado ainda conta');
select is((select count(*)::int from public.schedule_overview('2026-01-01', '2026-12-31')), 0, 'período longo demais não volta nada');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b900-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.schedule_overview('2026-12-01', '2026-12-31') where client_name like 'CM %'), 0, 'gestora de tráfego não vê o cronograma');
reset role;

select * from finish();
rollback;
