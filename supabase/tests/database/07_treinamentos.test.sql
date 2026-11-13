-- Treinamentos: quem vê, quem edita, progresso e avisos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-a700-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu.t@extend.test', '{"full_name":"Madu T"}', now()),
  ('00000000-0000-4000-a700-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joana.t@extend.test', '{"full_name":"Joana T"}', now());
update public.profiles set is_active = true where email like '%.t@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.t@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a700-000000000001', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a700-000000000002', id from public.roles where key = 'coord_conteudo';

select ok(exists (select 1 from public.trainings where title = 'Primeiros passos no Sistema Extend' and is_published), 'o treinamento do sistema já vem publicado');

-- Coordenação cria um rascunho com duas aulas e atribui à Madu.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a700-000000000002","role":"authenticated"}';
insert into public.trainings (id, organization_id, title, category, is_published, created_by)
select '00000000-0000-4000-a710-000000000001', private.org_id(), 'Briefing de clientes', 'processos', false, auth.uid();
insert into public.training_lessons (id, training_id, position, title) values
  ('00000000-0000-4000-a720-000000000001', '00000000-0000-4000-a710-000000000001', 1, 'O que perguntar'),
  ('00000000-0000-4000-a720-000000000002', '00000000-0000-4000-a710-000000000001', 2, 'Onde registrar');
insert into public.training_assignments (training_id, profile_id, due_on, assigned_by)
values ('00000000-0000-4000-a710-000000000001', '00000000-0000-4000-a700-000000000001', private.today_sp() - 1, auth.uid());
select is((select count(*)::int from public.trainings where id = '00000000-0000-4000-a710-000000000001'), 1, 'coordenação vê o próprio rascunho');

-- Madu: não vê rascunho nem as aulas dele e não foi avisada ainda.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a700-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.trainings where id = '00000000-0000-4000-a710-000000000001'), 0, 'social media não vê rascunho');
select is((select count(*)::int from public.training_lessons where training_id = '00000000-0000-4000-a710-000000000001'), 0, 'nem as aulas do rascunho');
select is((select count(*)::int from public.notifications where kind = 'training'), 0, 'rascunho atribuído ainda não avisa');
select throws_ok($$insert into public.trainings (organization_id, title) values (private.org_id(), 'Meu curso')$$, '42501', null, 'social media não cria treinamento');
select throws_ok($$insert into public.training_progress (lesson_id, profile_id) values ('00000000-0000-4000-a720-000000000001', auth.uid())$$, '42501', null, 'nem marca aula de rascunho');

-- Coordenação publica → Madu é avisada.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a700-000000000002","role":"authenticated"}';
update public.trainings set is_published = true where id = '00000000-0000-4000-a710-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a700-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.notifications where kind = 'training' and title like 'Novo treinamento%'), 1, 'publicou → a pessoa atribuída é avisada');
select is((select count(*)::int from public.training_lessons where training_id = '00000000-0000-4000-a710-000000000001'), 2, 'publicado: ela vê as aulas');

-- Madu não altera o próprio prazo nem a conclusão.
update public.training_assignments set due_on = private.today_sp() + 30 where profile_id = auth.uid();
select is((select due_on from public.training_assignments where profile_id = auth.uid() and training_id = '00000000-0000-4000-a710-000000000001'),
  private.today_sp() - 1, 'quem recebe não muda o próprio prazo');
select throws_ok($$update public.training_assignments set completed_at = now() where profile_id = auth.uid()$$, '42501', null, 'nem marca como concluído na mão');

-- Concluir as duas aulas fecha a atribuição e avisa a coordenação.
insert into public.training_progress (lesson_id, profile_id) values ('00000000-0000-4000-a720-000000000001', auth.uid());
select is((select completed_at from public.training_assignments where profile_id = auth.uid() and training_id = '00000000-0000-4000-a710-000000000001'), null, 'uma de duas: ainda não concluiu');
insert into public.training_progress (lesson_id, profile_id) values ('00000000-0000-4000-a720-000000000002', auth.uid());
select isnt((select completed_at from public.training_assignments where profile_id = auth.uid() and training_id = '00000000-0000-4000-a710-000000000001'), null, 'última aula → concluído');
select is((select count(*)::int from public.training_progress), 2, 'ela só vê o próprio progresso');

reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-a700-000000000002' and kind = 'training' and title like 'Madu T concluiu%'),
  'quem atribuiu é avisado da conclusão');

-- Prazo vencido: avisa uma vez só (o cron roda sem usuário logado).
select set_config('request.jwt.claims', '', true);
insert into public.trainings (id, organization_id, title, is_published) select '00000000-0000-4000-a710-000000000002', id, 'Atendimento no WhatsApp', true from public.organizations order by created_at limit 1;
insert into public.training_lessons (training_id, title) values ('00000000-0000-4000-a710-000000000002', 'Tom de voz');
insert into public.training_assignments (training_id, profile_id, due_on) values ('00000000-0000-4000-a710-000000000002', '00000000-0000-4000-a700-000000000001', private.today_sp() - 2);
select private.trainings_tick();
select private.trainings_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-a700-000000000001' and title like 'Treinamento atrasado%'), 1, 'atraso avisa uma vez (o concluído não avisa)');

select * from finish();
rollback;
