-- Cliente sem retorno: conteúdo parado na aprovação do cliente avisa o responsável pela comunicação
-- e quem está com a demanda, uma vez por marco; tipos de reunião e serviços novos do catálogo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-af00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dona.r@extend.test', '{"full_name":"Dona R"}', now()),
  ('00000000-0000-4000-af00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resp.r@extend.test', '{"full_name":"Resp R"}', now());
update public.profiles set is_active = true where email like '%.r@extend.test';

insert into public.clients (id, organization_id, name, status, owner_id)
select '00000000-0000-4000-af10-000000000001', id, 'Teste Sem Retorno', 'ativo', '00000000-0000-4000-af00-000000000001' from public.organizations limit 1;

-- Duas demandas na aprovação do cliente: uma com versão enviada, outra sem nada para o cliente ver.
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id)
select ('00000000-0000-4000-af20-00000000000' || n)::uuid, o.id, '00000000-0000-4000-af10-000000000001', 'conteudo', 'Post ' || n, '00000000-0000-4000-af00-000000000002'
  from public.organizations o cross join generate_series(1, 2) n limit 2;
insert into public.task_deliveries (id, task_id, version, created_by)
values ('00000000-0000-4000-af21-000000000001', '00000000-0000-4000-af20-000000000001', 1, '00000000-0000-4000-af00-000000000002');
update public.tasks set workflow_step_id = (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id
                                             where w.task_type = 'conteudo' and s.name = 'Aprovação do cliente' and w.organization_id = tasks.organization_id)
 where id in ('00000000-0000-4000-af20-000000000001', '00000000-0000-4000-af20-000000000002');
-- Como move_task: fecha a etapa anterior e registra a entrada na nova.
update public.task_stage_history set left_at = now()
 where task_id in ('00000000-0000-4000-af20-000000000001', '00000000-0000-4000-af20-000000000002') and left_at is null;
insert into public.task_stage_history (task_id, step_id, step_name)
select id, workflow_step_id, 'Aprovação do cliente' from public.tasks
 where id in ('00000000-0000-4000-af20-000000000001', '00000000-0000-4000-af20-000000000002');
select is((select count(*)::int from public.task_stage_history where task_id = '00000000-0000-4000-af20-000000000001' and left_at is null), 1, 'a etapa do cliente fica registrada no histórico');

-- Recém-enviada: ainda não é "sem retorno".
select private.client_waiting_tick();
select is((select count(*)::int from public.notifications where kind = 'client_waiting'), 0, 'no mesmo dia do envio ninguém é avisado');

-- Parada há três semanas.
update public.task_stage_history set entered_at = now() - interval '21 days' where task_id in ('00000000-0000-4000-af20-000000000001', '00000000-0000-4000-af20-000000000002') and left_at is null;
select private.client_waiting_tick();
select is((select count(*)::int from public.notifications where kind = 'client_waiting' and user_id = '00000000-0000-4000-af00-000000000001'), 1, 'avisa o responsável pela comunicação');
select is((select count(*)::int from public.notifications where kind = 'client_waiting' and user_id = '00000000-0000-4000-af00-000000000002'), 1, 'avisa quem está com a demanda');
select ok((select bool_and(href = '/tarefas/00000000-0000-4000-af20-000000000001') from public.notifications where kind = 'client_waiting'), 'só a demanda com versão enviada conta como sem retorno');
select private.client_waiting_tick();
select is((select count(*)::int from public.notifications where kind = 'client_waiting'), 2, 'rodar de novo não repete o aviso');

-- Cliente pausado não gera cobrança.
delete from public.notifications where kind = 'client_waiting';
update public.clients set status = 'pausado' where id = '00000000-0000-4000-af10-000000000001';
select private.client_waiting_tick();
select is((select count(*)::int from public.notifications where kind = 'client_waiting'), 0, 'cliente pausado não gera aviso');

-- Reuniões e catálogo.
select lives_ok($$insert into public.client_meetings (client_id, held_at, kind, title) values ('00000000-0000-4000-af10-000000000001', now(), 'estrategia', 'Aprovação da estratégia')$$, 'reunião de aprovação de estratégia');
select is((select count(*)::int from public.service_catalog where key in ('consultoria_perfil', 'google_meu_negocio')), 2, 'catálogo tem Consultoria de perfil e Google Meu Negócio');

select * from finish();
rollback;
