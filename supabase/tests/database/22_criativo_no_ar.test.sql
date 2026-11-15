-- Criativo aprovado ou entregue há 2 dias úteis sem ir para "No ar" avisa quem pediu (docs/08, item 7).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

-- Luiz (gestor) pede; Gi (gestora) também está no tráfego do cliente; Pri (editora) produz.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b200-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luiz.na@extend.test', '{"full_name":"Luiz NA"}', now()),
  ('00000000-0000-4000-b200-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gi.na@extend.test', '{"full_name":"Gi NA"}', now()),
  ('00000000-0000-4000-b200-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pri.na@extend.test', '{"full_name":"Pri NA"}', now());
update public.profiles set is_active = true where email like '%.na@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.na@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b200-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b200-000000000002', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b200-000000000003', id from public.roles where key = 'editor_video';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-b210-000000000001', id, 'Loja No Ar', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id, is_default) select '00000000-0000-4000-b210-000000000001', id, '00000000-0000-4000-b200-000000000001', true from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id) select '00000000-0000-4000-b210-000000000001', id, '00000000-0000-4000-b200-000000000002' from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id, is_default) select '00000000-0000-4000-b210-000000000001', id, '00000000-0000-4000-b200-000000000003', true from public.sectors where key = 'edicao';

create temp table t_cr (k text primary key, id uuid) on commit drop;
grant all on t_cr to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b200-000000000001","role":"authenticated"}';
insert into t_cr select 'velho', public.create_creative_request(jsonb_build_object('client_id', '00000000-0000-4000-b210-000000000001', 'format', 'video', 'priority', 'alta',
  'campaign', 'Verão', 'objective', 'vendas', 'angle', 'Coleção nova', 'audience', 'Clientes', 'cta', 'Compre', 'due_at', (now() + interval '3 days')::text));
insert into t_cr select 'novo', public.create_creative_request(jsonb_build_object('client_id', '00000000-0000-4000-b210-000000000001', 'format', 'video', 'priority', 'alta',
  'campaign', 'Inverno', 'objective', 'vendas', 'angle', 'Frio', 'audience', 'Clientes', 'cta', 'Compre', 'due_at', (now() + interval '3 days')::text));
reset role;

-- Os dois vão para "Entregue" (como move_task faria); o velho entrou há 7 dias, o novo hoje.
update public.tasks t set workflow_step_id = s.id
  from public.workflow_steps s join public.workflows w on w.id = s.workflow_id and w.task_type = 'criativo'
 where t.id in (select id from t_cr) and s.name = 'Entregue' and w.organization_id = t.organization_id;
update public.task_stage_history set left_at = now() where task_id in (select id from t_cr) and left_at is null;
insert into public.task_stage_history (task_id, step_id, step_name, entered_at)
select id, workflow_step_id, 'Entregue', case when id = (select id from t_cr where k = 'velho') then now() - interval '7 days' else now() end
  from public.tasks where id in (select id from t_cr);
delete from public.notifications where user_id in (select id from public.profiles where email like '%.na@extend.test');

select private.creative_live_tick();
select is((select count(*)::int from public.notifications where kind = 'creative_live' and user_id = '00000000-0000-4000-b200-000000000001'), 1, 'quem pediu é avisado do criativo entregue há 2 dias úteis');
select is((select href from public.notifications where kind = 'creative_live'), '/criativos/' || (select id from t_cr where k = 'velho'), 'o aviso abre o criativo atrasado (o entregue hoje não avisa)');
select is((select count(*)::int from public.notifications where kind = 'creative_live' and user_id <> '00000000-0000-4000-b200-000000000001'), 0, 'só quem pediu, enquanto está ativo');

select private.creative_live_tick();
select is((select count(*)::int from public.notifications where kind = 'creative_live'), 1, 'não repete o aviso');

-- Quem pediu saiu: avisa a equipe de tráfego do cliente (Gi).
update public.profiles set is_active = false where id = '00000000-0000-4000-b200-000000000001';
update public.task_stage_history set entered_at = now() - interval '8 days' where task_id = (select id from t_cr where k = 'velho') and left_at is null;
select private.creative_live_tick();
select is((select count(*)::int from public.notifications where kind = 'creative_live' and user_id = '00000000-0000-4000-b200-000000000002'), 1, 'sem quem pediu, avisa o tráfego do cliente');

-- No ar: sai da lista.
update public.tasks t set workflow_step_id = s.id
  from public.workflow_steps s join public.workflows w on w.id = s.workflow_id and w.task_type = 'criativo'
 where t.id = (select id from t_cr where k = 'velho') and s.name = 'No ar' and w.organization_id = t.organization_id;
delete from public.notifications where kind = 'creative_live';
select private.creative_live_tick();
select is((select count(*)::int from public.notifications where kind = 'creative_live'), 0, 'criativo no ar não avisa');

select is((select count(*)::int from cron.job where jobname = 'extend-criativo-no-ar'), 1, 'job diário agendado');

select * from finish();
rollback;
