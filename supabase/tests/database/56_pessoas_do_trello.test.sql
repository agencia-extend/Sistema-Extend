-- Pessoas do Trello a cadastrar: só quem gerencia usuários vê e liga os nomes. Ligar passa os cards (responsável
-- onde não há ninguém, participante onde já há) e o cliente para a pessoa. O convite aceito liga sozinho.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf71-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm.pt@extend.test', '{"full_name":"Adm PT"}', now()),
  ('00000000-0000-4000-bf71-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ed.pt@extend.test', '{"full_name":"Ed PT"}', now()),
  ('00000000-0000-4000-bf71-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nova.pt@extend.test', '{"full_name":"Nova PT"}', now());
update public.profiles set is_active = true where email in ('adm.pt@extend.test', 'ed.pt@extend.test');
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pt@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf71-000000000001'::uuid, 'admin'), ('00000000-0000-4000-bf71-000000000002'::uuid, 'editor_video')) x(u, k) on r.key = x.k;

insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf72-000000000001', id, 'PT Cliente', 'ativo' from public.organizations order by created_at limit 1;
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id)
select ('00000000-0000-4000-bf73-00000000000' || n)::uuid, organization_id, id, 'geral', 'PT card ' || n,
       case when n = 2 then '00000000-0000-4000-bf71-000000000001'::uuid end
  from public.clients, generate_series(1, 3) n where id = '00000000-0000-4000-bf72-000000000001';

insert into public.team_placeholders (id, organization_id, name, aliases, sector_id)
select '00000000-0000-4000-bf74-000000000001', organization_id, 'Ed do Trello', '{ED}', (select id from public.sectors where key = 'edicao')
  from public.clients where id = '00000000-0000-4000-bf72-000000000001';
insert into public.team_placeholders (id, organization_id, name, aliases)
select '00000000-0000-4000-bf74-000000000002', organization_id, 'Nova do Trello', '{NOVA}' from public.clients where id = '00000000-0000-4000-bf72-000000000001';
insert into public.team_placeholder_tasks (placeholder_id, task_id) values
  ('00000000-0000-4000-bf74-000000000001', '00000000-0000-4000-bf73-000000000001'),
  ('00000000-0000-4000-bf74-000000000001', '00000000-0000-4000-bf73-000000000002'),
  ('00000000-0000-4000-bf74-000000000002', '00000000-0000-4000-bf73-000000000003');
insert into public.team_placeholder_clients (placeholder_id, client_id, sector_id)
select '00000000-0000-4000-bf74-000000000001', '00000000-0000-4000-bf72-000000000001', id from public.sectors where key = 'edicao';

-- Quem não gerencia usuários não vê nem liga.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.team_placeholders where name like '%do Trello'), 0, 'editor não vê a lista');
select throws_ok($$select public.link_team_placeholder('00000000-0000-4000-bf74-000000000001', '00000000-0000-4000-bf71-000000000002')$$, '42501', null, 'editor não liga nomes');
select throws_ok($$insert into public.team_placeholders (organization_id, name) select private.org_id(), 'x'$$, '42501', null, 'ninguém grava direto na tabela');

-- Administrador liga o nome ao editor.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.team_placeholders where name like '%do Trello'), 2, 'administrador vê a lista');
select is(public.link_team_placeholder('00000000-0000-4000-bf74-000000000001', '00000000-0000-4000-bf71-000000000002'), 2, 'ligar devolve os 2 cards');
reset role;
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-bf73-000000000001'), '00000000-0000-4000-bf71-000000000002'::uuid, 'card sem ninguém ganha responsável');
select ok(exists (select 1 from public.task_participants where task_id = '00000000-0000-4000-bf73-000000000002' and profile_id = '00000000-0000-4000-bf71-000000000002')
          and (select assignee_id from public.tasks where id = '00000000-0000-4000-bf73-000000000002') = '00000000-0000-4000-bf71-000000000001', 'card com responsável: vira participante');
select ok(exists (select 1 from public.client_members where client_id = '00000000-0000-4000-bf72-000000000001' and profile_id = '00000000-0000-4000-bf71-000000000002'), 'entra na equipe do cliente');

-- Convite aceito liga o outro nome sozinho.
insert into public.invitations (id, organization_id, email, full_name, role_id, token_hash, expires_at, status, user_id, invited_by)
select '00000000-0000-4000-bf75-000000000001', organization_id, 'nova.pt@extend.test', 'Nova PT', (select id from public.roles where key = 'editor_video'),
       md5('pt'), now() + interval '1 day', 'pendente', '00000000-0000-4000-bf71-000000000003', '00000000-0000-4000-bf71-000000000001'
  from public.clients where id = '00000000-0000-4000-bf72-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf71-000000000001","role":"authenticated"}';
select public.set_team_placeholder_invitation('00000000-0000-4000-bf74-000000000002', '00000000-0000-4000-bf75-000000000001');
reset role;
select public.finalize_invitation('00000000-0000-4000-bf75-000000000001', 'Nova PT');
select is((select profile_id from public.team_placeholders where id = '00000000-0000-4000-bf74-000000000002'), '00000000-0000-4000-bf71-000000000003'::uuid, 'convite aceito liga o nome');
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-bf73-000000000003'), '00000000-0000-4000-bf71-000000000003'::uuid, 'e passa o card para a pessoa nova');

select * from finish();
rollback;
