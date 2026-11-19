-- Quadros no estilo Trello: quem distribui as demandas do cliente cria e edita os quadros dele (não os de outros
-- clientes nem os livres); colunas reordenam; arrastar em Minhas tarefas muda a situação pela etapa do fluxo, pela
-- coluna do quadro ou direto (demanda solta), e quem não pode mover não move.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf61-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sm.qt@extend.test', '{"full_name":"Sm QT"}', now()),
  ('00000000-0000-4000-bf61-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ed.qt@extend.test', '{"full_name":"Ed QT"}', now());
update public.profiles set is_active = true where email like '%.qt@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.qt@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf61-000000000001'::uuid, 'social_media'), ('00000000-0000-4000-bf61-000000000002'::uuid, 'leitura')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select ('00000000-0000-4000-bf62-00000000000' || n)::uuid, id, 'QT Cliente ' || n, 'ativo' from public.organizations, generate_series(1, 2) n
 where id = (select id from public.organizations order by created_at limit 1);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf62-000000000001', id, '00000000-0000-4000-bf61-000000000001' from public.sectors where key = 'gerenciamento';

-- Social media (distribui as demandas dos clientes dela).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf61-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.boards (id, organization_id, name, client_id) select '00000000-0000-4000-bf63-000000000001', private.org_id(), 'Campanha QT', '00000000-0000-4000-bf62-000000000001'$$,
  'cria quadro para o cliente dela');
select throws_ok($$insert into public.boards (organization_id, name, client_id) select private.org_id(), 'De outro', '00000000-0000-4000-bf62-000000000002'$$,
  '42501', null, 'não cria quadro para cliente de outro');
select throws_ok($$insert into public.boards (organization_id, name) select private.org_id(), 'Livre QT'$$, '42501', null, 'não cria quadro livre sem "Configurar quadros"');
select lives_ok($$insert into public.board_columns (board_id, name, position, is_done) values
  ('00000000-0000-4000-bf63-000000000001', 'A fazer', 1, false), ('00000000-0000-4000-bf63-000000000001', 'Revisão', 2, false), ('00000000-0000-4000-bf63-000000000001', 'Feito', 3, true)$$,
  'cria as colunas do quadro dela');
select lives_ok($$select public.move_board_column((select id from public.board_columns where board_id = '00000000-0000-4000-bf63-000000000001' and name = 'Revisão'), 'left')$$, 'reordena colunas');
select is((select string_agg(name, ',' order by position) from public.board_columns where board_id = '00000000-0000-4000-bf63-000000000001'), 'Revisão,A fazer,Feito', 'Revisão foi para a primeira posição');
reset role;

-- Demandas: uma de fluxo (geral: A fazer → Fazendo → Feito), uma do quadro e uma da social media.
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id)
select '00000000-0000-4000-bf64-000000000001', organization_id, id, 'geral', 'Fluxo QT', '00000000-0000-4000-bf61-000000000001' from public.clients where id = '00000000-0000-4000-bf62-000000000001';
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id, board_id, board_column_id)
select '00000000-0000-4000-bf64-000000000002', organization_id, id, 'geral', 'Quadro QT', '00000000-0000-4000-bf61-000000000001', '00000000-0000-4000-bf63-000000000001',
       (select bc.id from public.board_columns bc where bc.board_id = '00000000-0000-4000-bf63-000000000001' and bc.name = 'A fazer')
  from public.clients where id = '00000000-0000-4000-bf62-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf61-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_task_status('00000000-0000-4000-bf64-000000000001', 'em_andamento', null)$$, 'arrasta a demanda de fluxo para Fazendo');
select is((select s.name || '/' || t.status from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = '00000000-0000-4000-bf64-000000000001'),
  'Fazendo/em_andamento', 'foi para a etapa com essa situação');
select throws_ok($$select public.set_task_status('00000000-0000-4000-bf64-000000000001', 'aguardando_aprovacao', null)$$, 'P0001', null, 'fluxo sem etapa de aprovação avisa');
select lives_ok($$select public.set_task_status('00000000-0000-4000-bf64-000000000002', 'concluido', null)$$, 'arrasta a demanda do quadro para Concluídas');
select is((select c.name || '/' || t.status from public.tasks t join public.board_columns c on c.id = t.board_column_id where t.id = '00000000-0000-4000-bf64-000000000002'),
  'Feito/concluido', 'foi para a coluna de concluído');
select throws_ok($$select public.set_task_status('00000000-0000-4000-bf64-000000000001', 'cancelado', null)$$, 'P0001', 'Situação inválida.', 'situação fora do quadro não entra');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf61-000000000002","role":"authenticated"}';
select throws_ok($$select public.set_task_status('00000000-0000-4000-bf64-000000000001', 'pendente', null)$$, '42501', null, 'quem só lê não move');
reset role;

select * from finish();
rollback;
