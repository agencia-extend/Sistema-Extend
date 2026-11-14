-- Criativos: pedido, quem produz, versões, revisão interna, link do cliente, biblioteca e visibilidade.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-af00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luiz.cr@extend.test', '{"full_name":"Luiz CR"}', now()),
  ('00000000-0000-4000-af00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priscila.cr@extend.test', '{"full_name":"Priscila CR"}', now()),
  ('00000000-0000-4000-af00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro.cr@extend.test', '{"full_name":"Outro CR"}', now());
update public.profiles set is_active = true where email like '%.cr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.cr@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000002', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000003', id from public.roles where key = 'editor_video';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-af10-000000000001', id, 'Teste Imobiliária CR', 'ativo' from public.organizations limit 1;
insert into public.client_members (client_id, sector_id, profile_id, is_default) select '00000000-0000-4000-af10-000000000001', id, '00000000-0000-4000-af00-000000000001', true from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id, is_default) select '00000000-0000-4000-af10-000000000001', id, '00000000-0000-4000-af00-000000000002', true from public.sectors where key = 'edicao';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
select throws_ok($$select public.create_creative_request(jsonb_build_object('client_id', '00000000-0000-4000-af10-000000000001', 'format', 'video', 'priority', 'alta',
  'campaign', 'Lançamento', 'objective', 'mensagens', 'angle', 'Dor do aluguel', 'audience', 'Inquilinos 25-40', 'cta', 'Chamar no WhatsApp'))$$, 'P0001', 'Informe o prazo.', 'sem prazo é recusado');
create temp table t_cr (id uuid) on commit drop;
grant all on t_cr to authenticated;
insert into t_cr select public.create_creative_request(jsonb_build_object('client_id', '00000000-0000-4000-af10-000000000001', 'format', 'video', 'priority', 'alta',
  'campaign', 'Lançamento', 'objective', 'mensagens', 'angle', 'Dor do aluguel', 'audience', 'Inquilinos 25-40', 'cta', 'Chamar no WhatsApp',
  'copy_suggestion', 'Cansou de pagar aluguel?', 'due_at', (now() + interval '3 days')::text));

reset role;
select is((select assignee_id from public.tasks where id = (select id from t_cr)), '00000000-0000-4000-af00-000000000002'::uuid, 'vídeo vai para a Edição do cliente');
select is((select s.name from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = (select id from t_cr)), 'Solicitado', 'começa em Solicitado');
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-af00-000000000002'), 'quem produz é avisado');

-- Outro editor não vê o pedido nem envia versão.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.creative_requests where task_id = (select id from t_cr)), 0, 'editor de outro cliente não vê o pedido');
select throws_ok($$select public.add_delivery((select id from t_cr), 'v1', '[{"kind":"link","name":"Vídeo","url":"https://drive.google.com/x"}]'::jsonb)$$, '42501', null, 'nem envia versão');

-- A mídia envia a v1: vai para revisão e avisa quem pediu.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000002","role":"authenticated"}';
select is(public.add_delivery((select id from t_cr), 'Primeira versão', '[{"kind":"link","name":"Vídeo v1","url":"https://drive.google.com/v1"}]'::jsonb), 1, 'v1 criada');
reset role;
select is((select s.name from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = (select id from t_cr)), 'Em revisão', 'entrega vai para Em revisão');
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-af00-000000000001' and kind = 'creative_ready'), 'quem pediu recebe "criativo pronto"');

-- Luiz pede ajuste (comentário obrigatório), a mídia manda v2, Luiz aprova e manda ao cliente.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
select throws_ok($$select public.review_creative((select id from t_cr), 'ajustes', '')$$, 'P0001', 'Descreva o que precisa mudar.', 'ajuste exige comentário');
select lives_ok($$select public.review_creative((select id from t_cr), 'ajustes', 'Trocar a trilha')$$, 'pede ajuste');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000002","role":"authenticated"}';
select is(public.add_delivery((select id from t_cr), null, '[{"kind":"link","name":"Vídeo v2","url":"https://drive.google.com/v2"}]'::jsonb), 2, 'v2 criada');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
select public.review_creative((select id from t_cr), 'cliente', null);
select isnt(public.create_approval_link((select id from t_cr), repeat('a', 64), 7), null, 'gera o link do cliente');
select throws_ok($$select public.decide_approval(repeat('a', 64), 'aprovado', null, 'Cliente', '1.1.1.1')$$, '42501', null, 'decisão do link só pelo servidor');

-- O servidor registra a decisão do cliente.
reset role;
select is(public.decide_approval(repeat('a', 64), 'aprovado', null, 'Dona Ana', '200.1.2.3'), 'ok', 'cliente aprova pelo link');
select is((select s.name from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = (select id from t_cr)), 'Aprovado', 'vai para Aprovado');
select is((select primary_text from public.creative_library where task_id = (select id from t_cr)), 'Cansou de pagar aluguel?', 'entra na biblioteca com a copy');
select is(public.decide_approval(repeat('a', 64), 'ajustes', 'mudei de ideia', 'Dona Ana', '200.1.2.3'), 'usado', 'link já decidido não aceita nova decisão');

select * from finish();
rollback;
