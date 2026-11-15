-- RF-PER-10: desativar alguém passa as demandas e responsabilidades abertas para outra pessoa.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- Ana (admin) desativa Leo (comercial). Cris (comercial) assume; Sam (social media) não pode assumir leads.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b100-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.r@extend.test', '{"full_name":"Ana R"}', now()),
  ('00000000-0000-4000-b100-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leo.r@extend.test', '{"full_name":"Leo R"}', now()),
  ('00000000-0000-4000-b100-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cris.r@extend.test', '{"full_name":"Cris R"}', now()),
  ('00000000-0000-4000-b100-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.r@extend.test', '{"full_name":"Sam R"}', now()),
  ('00000000-0000-4000-b100-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zed.r@extend.test', '{"full_name":"Zed R"}', now());
update public.profiles set is_active = true where email like '%.r@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.r@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000001', id from public.roles where key = 'admin';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000002', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000003', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000004', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000005', id from public.roles where key = 'designer';

insert into public.clients (id, organization_id, name, status, owner_id)
select '00000000-0000-4000-b110-000000000001', id, 'Cliente Repasse', 'ativo', '00000000-0000-4000-b100-000000000002' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b110-000000000001', id, '00000000-0000-4000-b100-000000000002' from public.sectors where key = 'gerenciamento';

-- Uma demanda aberta com Leo, uma em que ele edita e uma concluída (não muda).
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id)
select ('00000000-0000-4000-b120-00000000000' || n)::uuid, organization_id, id, 'geral', 'Demanda ' || n, '00000000-0000-4000-b100-000000000002'
  from public.clients cross join generate_series(1, 3) n where id = '00000000-0000-4000-b110-000000000001';
update public.tasks set assignee_id = '00000000-0000-4000-b100-000000000004' where id = '00000000-0000-4000-b120-000000000002';
insert into public.task_content (task_id, editor_id) values ('00000000-0000-4000-b120-000000000002', '00000000-0000-4000-b100-000000000002')
  on conflict (task_id) do update set editor_id = excluded.editor_id;
update public.tasks set status = 'concluido', completed_at = now() where id = '00000000-0000-4000-b120-000000000003';

insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source, owner_id, created_by)
select p.organization_id, p.id, (select s.id from public.pipeline_stages s where s.pipeline_id = p.id order by position limit 1),
       'Lead do Leo', '51999990777', 'indicacao', '00000000-0000-4000-b100-000000000002', '00000000-0000-4000-b100-000000000002'
  from public.pipelines p where p.is_default limit 1;
delete from public.notifications where user_id in (select id from public.profiles where email like '%.r@extend.test');

-- Quem não gerencia usuários não vê nem desativa.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b100-000000000004","role":"authenticated"}';
select throws_ok($$select public.admin_open_work('00000000-0000-4000-b100-000000000002')$$, '42501', null, 'sem users.manage não consulta o trabalho em aberto');
select throws_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000002', '00000000-0000-4000-b100-000000000004')$$, '42501', null, 'sem users.manage não desativa');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b100-000000000001","role":"authenticated"}';
select is(public.admin_open_work('00000000-0000-4000-b100-000000000002') - array['repeats', 'step_defaults', 'checklist', 'proposals', 'marketing'],
  '{"tasks":2,"teams":1,"owned_clients":1,"leads":1}'::jsonb, 'conta demandas abertas (responsável e quem edita), equipe, cliente e lead');
select throws_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000002', null)$$, 'P0001', 'Escolha quem assume o trabalho em aberto.', 'com trabalho em aberto, exige quem assume');
select throws_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000002', '00000000-0000-4000-b100-000000000002')$$, 'P0001', null, 'a própria pessoa não assume');
select throws_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000002', '00000000-0000-4000-b100-000000000004')$$, 'P0001', null, 'leads abertos exigem alguém com acesso ao Comercial');
select is((select is_active from public.profiles where id = '00000000-0000-4000-b100-000000000002'), true, 'recusado, nada muda');

select lives_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000002', '00000000-0000-4000-b100-000000000003')$$, 'desativa passando para Cris');
reset role;
select is((select is_active from public.profiles where id = '00000000-0000-4000-b100-000000000002'), false, 'Leo fica sem acesso');
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-b120-000000000001'), '00000000-0000-4000-b100-000000000003'::uuid, 'demanda aberta passa para Cris');
select is((select editor_id from public.task_content where task_id = '00000000-0000-4000-b120-000000000002'), '00000000-0000-4000-b100-000000000003'::uuid, 'quem edita passa para Cris');
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-b120-000000000003'), '00000000-0000-4000-b100-000000000002'::uuid, 'demanda concluída mantém o histórico');
select is((select array_agg(profile_id) from public.client_members where client_id = '00000000-0000-4000-b110-000000000001'),
  array['00000000-0000-4000-b100-000000000003'::uuid], 'Cris entra na equipe do cliente no lugar de Leo');
select is((select owner_id from public.clients where id = '00000000-0000-4000-b110-000000000001'), '00000000-0000-4000-b100-000000000003'::uuid, 'responsável pela comunicação passa para Cris');
select is((select owner_id from public.leads where name = 'Lead do Leo'), '00000000-0000-4000-b100-000000000003'::uuid, 'lead aberto passa para Cris');
select is((select array_agg(title) from public.notifications where user_id = '00000000-0000-4000-b100-000000000003'),
  array['Você assumiu o trabalho de Leo R'], 'Cris recebe um aviso só, com o resumo');
select is((select href from public.notifications where user_id = '00000000-0000-4000-b100-000000000003'), '/comercial', 'sem acesso a tarefas, o aviso leva ao Comercial');

-- Sem nada em aberto, desativa sem escolher ninguém.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b100-000000000001","role":"authenticated"}';
select lives_ok($$select public.admin_deactivate_user('00000000-0000-4000-b100-000000000005', null)$$, 'sem trabalho em aberto, não precisa de quem assume');

select * from finish();
rollback;
