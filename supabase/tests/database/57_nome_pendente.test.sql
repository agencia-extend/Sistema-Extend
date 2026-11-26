-- Nome do Trello no card e na equipe do cliente enquanto a pessoa não tem conta: aparece no card; descartar o nome tira;
-- ligar o nome a uma pessoa passa o card para ela e o nome some; a equipe pendente do cliente só aparece para quem vê o cliente.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bfb1-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ad.np@extend.test', '{"full_name":"Ad NP"}', now()),
  ('00000000-0000-4000-bfb1-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ed.np@extend.test', '{"full_name":"Ed NP"}', now()),
  ('00000000-0000-4000-bfb1-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ou.np@extend.test', '{"full_name":"Ou NP"}', now());
update public.profiles set is_active = true where email like '%.np@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.np@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bfb1-000000000001'::uuid, 'admin'), ('00000000-0000-4000-bfb1-000000000002'::uuid, 'editor_video'),
  ('00000000-0000-4000-bfb1-000000000003'::uuid, 'social_media')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bfb2-000000000001', id, 'Cliente NP', 'ativo' from public.organizations order by created_at limit 1;
insert into public.tasks (id, organization_id, client_id, type, title, status, workflow_step_id)
select '00000000-0000-4000-bfb3-000000000001', o.id, '00000000-0000-4000-bfb2-000000000001', 'geral', 'Card do Trello NP', 'pendente', null
  from public.organizations o order by o.created_at limit 1;
insert into public.team_placeholders (id, organization_id, name, sector_id)
select '00000000-0000-4000-bfb4-000000000001', o.id, 'Fulana NP', (select id from public.sectors where key = 'edicao')
  from public.organizations o order by o.created_at limit 1;
insert into public.team_placeholder_tasks (placeholder_id, task_id) values ('00000000-0000-4000-bfb4-000000000001', '00000000-0000-4000-bfb3-000000000001');
insert into public.team_placeholder_clients (placeholder_id, client_id, sector_id)
select '00000000-0000-4000-bfb4-000000000001', '00000000-0000-4000-bfb2-000000000001', id from public.sectors where key = 'edicao';
update public.tasks set pending_assignee = 'Fulana NP', assignee_id = null, sector_id = (select id from public.sectors where key = 'edicao') where id = '00000000-0000-4000-bfb3-000000000001';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bfb2-000000000001', id, '00000000-0000-4000-bfb1-000000000002' from public.sectors where key = 'edicao';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfb1-000000000001","role":"authenticated"}';
select is((select pending_assignee from public.tasks where id = '00000000-0000-4000-bfb3-000000000001'), 'Fulana NP', 'quem vê o card vê o nome do Trello');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfb1-000000000002","role":"authenticated"}';
select is((select string_agg(name, ',') from public.client_pending_team('00000000-0000-4000-bfb2-000000000001')), 'Fulana NP', 'equipe pendente aparece para quem é do cliente');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfb1-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.client_pending_team('00000000-0000-4000-bfb2-000000000001')), 0, 'quem não é do cliente não vê a equipe pendente');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfb1-000000000001","role":"authenticated"}';
select lives_ok($$select public.dismiss_team_placeholder('00000000-0000-4000-bfb4-000000000001', true)$$, 'descarta o nome');
select is((select pending_assignee from public.tasks where id = '00000000-0000-4000-bfb3-000000000001'), null, 'nome descartado some do card');
select public.dismiss_team_placeholder('00000000-0000-4000-bfb4-000000000001', false);
select lives_ok($$select public.link_team_placeholder('00000000-0000-4000-bfb4-000000000001', '00000000-0000-4000-bfb1-000000000002')$$, 'liga o nome à pessoa');
select is((select coalesce(assignee_id::text, '-') || '/' || coalesce(pending_assignee, '-') from public.tasks where id = '00000000-0000-4000-bfb3-000000000001'),
  '00000000-0000-4000-bfb1-000000000002/-', 'o card passa para a pessoa e o nome pendente some');

select * from finish();
rollback;
