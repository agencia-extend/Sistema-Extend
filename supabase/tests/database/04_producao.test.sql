-- Etapa 03 · fluxo com troca de responsável, menções, tempo, atrasos e visibilidade.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jacque.p@extend.test', '{"full_name":"Jacque P"}', now()),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grav.p@extend.test', '{"full_name":"Gravacao P"}', now()),
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pri.p@extend.test', '{"full_name":"Priscila P"}', now()),
  ('00000000-0000-4000-d000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro.p@extend.test', '{"full_name":"Outro P"}', now());
update public.profiles set is_active = true where email like '%.p@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.p@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-d000-000000000001', id from public.roles where key = 'coord_conteudo';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-d000-000000000002', id from public.roles where key = 'gravacao';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-d000-000000000003', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-d000-000000000004', id from public.roles where key = 'editor_video';

-- Cliente ativo com equipe por setor.
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-d100-000000000001', id, 'Cliente Produção', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-d100-000000000001', s.id, x.p from public.sectors s
join (values ('conteudo', '00000000-0000-4000-d000-000000000001'::uuid), ('gravacao', '00000000-0000-4000-d000-000000000002'::uuid), ('edicao', '00000000-0000-4000-d000-000000000003'::uuid)) x(k, p) on x.k = s.key;

-- Card de vídeo: entra no Briefing com a Jacque (setor conteúdo).
insert into public.tasks (id, organization_id, client_id, type, title)
select '00000000-0000-4000-d200-000000000001', id, '00000000-0000-4000-d100-000000000001', 'video', 'Vídeo 1/4' from public.organizations order by created_at limit 1;
select is((select s.name from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = '00000000-0000-4000-d200-000000000001'), 'Briefing', 'card novo entra na primeira etapa');
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-d200-000000000001'), '00000000-0000-4000-d000-000000000001'::uuid, 'responsável = pessoa do setor da etapa');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-d000-000000000001","role":"authenticated"}';
select lives_ok($$select public.move_task('00000000-0000-4000-d200-000000000001',
  (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id where w.task_type = 'video' and s.name = 'Gravação'), null, null)$$,
  'coordenação move para Gravação');
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-d200-000000000001'), '00000000-0000-4000-d000-000000000002'::uuid, 'responsável muda para a gravação');
reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-d000-000000000002' and kind = 'stage_changed'), 'pessoa da gravação é avisada');
select is((select count(*)::int from public.task_stage_history where task_id = '00000000-0000-4000-d200-000000000001'), 2, 'histórico de etapas registra a passagem');
set local role authenticated;

select public.move_task('00000000-0000-4000-d200-000000000001',
  (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id where w.task_type = 'video' and s.name = 'Edição'), null, null);
select is((select assignee_id from public.tasks where id = '00000000-0000-4000-d200-000000000001'), '00000000-0000-4000-d000-000000000003'::uuid, 'Edição vai para a Priscila');

-- Priscila: cronômetro e comentário com menção.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-d000-000000000003","role":"authenticated"}';
select lives_ok($$select public.start_timer('00000000-0000-4000-d200-000000000001')$$, 'Priscila inicia o cronômetro');
select lives_ok($$select public.stop_timer()$$, 'Priscila pausa');
select is((select count(*)::int from public.task_time_entries where task_id = '00000000-0000-4000-d200-000000000001' and ended_at is not null), 1, 'tempo registrado');
insert into public.task_comments (task_id, author_id, body, mentions)
values ('00000000-0000-4000-d200-000000000001', '00000000-0000-4000-d000-000000000003', '@Jacque revisar', array['00000000-0000-4000-d000-000000000001'::uuid]);
reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-d000-000000000001' and kind = 'comment'), 'menção avisa a Jacque');

-- Atraso: card vencido notifica o responsável.
update public.tasks set due_at = now() - interval '1 hour' where id = '00000000-0000-4000-d200-000000000001';
select private.tasks_due_tick();
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-d000-000000000003' and kind = 'overdue'), 'atraso avisa o responsável');

-- Visibilidade: editor de outro cliente não vê o card.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-d000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id = '00000000-0000-4000-d200-000000000001'), 0, 'editor não responsável não vê o card');
select throws_ok($$select public.move_task('00000000-0000-4000-d200-000000000001', null, null, 1)$$, '42501', null, 'editor não responsável não move o card');

select * from finish();
rollback;
