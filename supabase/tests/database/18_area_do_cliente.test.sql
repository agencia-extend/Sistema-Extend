-- Área do cliente: o usuário do cliente vê só o próprio cliente, só pelas funções do portal,
-- sem valores nem comentários internos; aprova pelo portal; a equipe gerencia o acesso.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

-- Equipe: Madu (social media, na equipe do Cliente A), Edu (editor, na equipe do Cliente A).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ae00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu.p@extend.test', '{"full_name":"Madu P"}', now()),
  ('00000000-0000-4000-ae00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.p@extend.test', '{"full_name":"Edu P"}', now());
update public.profiles set is_active = true where email like '%.p@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.p@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000001', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000002', id from public.roles where key = 'editor_video';

insert into public.clients (id, organization_id, name, status, monthly_fee_cents, notes)
select '00000000-0000-4000-ae10-000000000001', id, 'Teste Imobiliária', 'ativo', 987654, 'nota interna secreta' from public.organizations limit 1;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-ae10-000000000002', id, 'Outro Cliente', 'ativo' from public.organizations limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-ae10-000000000001', id, '00000000-0000-4000-ae00-000000000001' from public.sectors where key = 'gerenciamento';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-ae10-000000000001', id, '00000000-0000-4000-ae00-000000000002' from public.sectors where key = 'edicao';

-- Convite do cliente: o perfil nasce inativo, marcado com o cliente e sem papel.
insert into public.invitations (id, organization_id, email, full_name, portal_client_id, token_hash, invited_by)
select '00000000-0000-4000-ae30-000000000001', id, 'carol.p@cliente.test', 'Carol Cliente', '00000000-0000-4000-ae10-000000000001',
       repeat('a', 64), '00000000-0000-4000-ae00-000000000001' from public.organizations limit 1;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ae00-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol.p@cliente.test',
   '{"full_name":"Carol Cliente","invitation_id":"00000000-0000-4000-ae30-000000000001"}', now());
update public.invitations set user_id = '00000000-0000-4000-ae00-000000000010' where id = '00000000-0000-4000-ae30-000000000001';
select is((select portal_client_id from public.profiles where id = '00000000-0000-4000-ae00-000000000010'), '00000000-0000-4000-ae10-000000000001'::uuid, 'perfil do convite já nasce marcado com o cliente');
select public.finalize_invitation('00000000-0000-4000-ae30-000000000001', 'Carol Cliente');
select ok((select is_active from public.profiles where id = '00000000-0000-4000-ae00-000000000010'), 'aceitar o convite ativa o acesso');
select is((select count(*)::int from public.user_roles where user_id = '00000000-0000-4000-ae00-000000000010'), 0, 'usuário do cliente não tem papel');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000001' and kind = 'portal'), 1, 'quem convidou é avisado do aceite');

-- Usuário de outro cliente.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ae00-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto.p@cliente.test', '{"full_name":"Beto Outro"}', now());
delete from public.user_roles where user_id = '00000000-0000-4000-ae00-000000000011';
update public.profiles set is_active = true, portal_client_id = '00000000-0000-4000-ae10-000000000002' where id = '00000000-0000-4000-ae00-000000000011';

-- Nada interno entra para o usuário do cliente.
select throws_ok($$insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000010', id from public.roles where key = 'admin'$$, 'P0001', null, 'não recebe papel');
select throws_ok($$insert into public.client_members (client_id, sector_id, profile_id) select '00000000-0000-4000-ae10-000000000001', id, '00000000-0000-4000-ae00-000000000010' from public.sectors where key = 'gerenciamento'$$, 'P0001', null, 'não entra na equipe do cliente');

-- Conteúdo do Cliente A aguardando aprovação, com comentário interno.
insert into public.tasks (id, organization_id, client_id, type, title)
select '00000000-0000-4000-ae20-000000000001', id, '00000000-0000-4000-ae10-000000000001', 'conteudo', 'Post de lançamento' from public.organizations limit 1;
select throws_ok($$update public.tasks set assignee_id = '00000000-0000-4000-ae00-000000000010' where id = '00000000-0000-4000-ae20-000000000001'$$, 'P0001', null, 'não vira responsável por demanda');
insert into public.task_comments (task_id, author_id, body) values ('00000000-0000-4000-ae20-000000000001', '00000000-0000-4000-ae00-000000000001', 'comentario interno da equipe');
update public.tasks set workflow_step_id = (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id where w.task_type = 'conteudo' and s.name = 'Aprovação do cliente' and w.organization_id = tasks.organization_id)
 where id = '00000000-0000-4000-ae20-000000000001';
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000010'), 0, 'sem versão para ver, o cliente ainda não é avisado');
insert into public.task_deliveries (id, task_id, version, note, created_by) values ('00000000-0000-4000-ae21-000000000001', '00000000-0000-4000-ae20-000000000001', 1, 'nota interna da entrega', '00000000-0000-4000-ae00-000000000001');
insert into public.delivery_assets (id, delivery_id, kind, name, storage_path) values ('00000000-0000-4000-ae22-000000000001', '00000000-0000-4000-ae21-000000000001', 'arquivo', 'post.png', 'tarefas/00000000-0000-4000-ae20-000000000001/entregas/post.png');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000010' and kind = 'portal' and href = '/portal/aprovacoes'), 1, 'versão na etapa do cliente avisa o cliente (no sistema e push)');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000011'), 0, 'o usuário do outro cliente não é avisado');

insert into public.client_files (id, client_id, storage_path, name, uploaded_by, folder) values
  ('00000000-0000-4000-ae40-000000000001', '00000000-0000-4000-ae10-000000000001', 'clientes/00000000-0000-4000-ae10-000000000001/rel.pdf', 'Relatório outubro.pdf', '00000000-0000-4000-ae00-000000000001', 'relatorios'),
  ('00000000-0000-4000-ae40-000000000002', '00000000-0000-4000-ae10-000000000001', 'clientes/00000000-0000-4000-ae10-000000000001/int.pdf', 'Interno.pdf', '00000000-0000-4000-ae00-000000000001', 'geral');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000010' and href = '/portal/relatorios'), 1, 'relatório novo avisa o cliente');

-- Como o usuário do cliente.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000010","role":"authenticated"}';
select is(private.org_id(), null, 'para as regras internas, o usuário do cliente não é da organização');
select is((select count(*)::int from public.my_permissions()), 0, 'e não tem nenhuma permissão');
select is((select count(*)::int from public.clients), 0, 'consulta direta: não lê clientes');
select is((select count(*)::int from public.tasks), 0, 'nem demandas');
select is((select count(*)::int from public.task_comments), 0, 'nem comentários internos');
select is((select count(*)::int from public.client_files), 0, 'nem a tabela de arquivos');
select is((select count(*)::int from public.profiles), 1, 'de perfis, só o próprio');
select ok((public.portal_home('00000000-0000-4000-ae10-000000000001') -> 'client' ->> 'name') = 'Teste Imobiliária', 'vê a visão geral do próprio cliente');
select ok(public.portal_home('00000000-0000-4000-ae10-000000000001')::text !~ '987654|nota interna', 'a visão geral não traz valores do contrato nem notas internas');
select throws_ok($$select public.portal_home('00000000-0000-4000-ae10-000000000002')$$, '42501', null, 'outro cliente: negado');
select ok(public.portal_approvals('00000000-0000-4000-ae10-000000000001')::text !~ 'comentario interno|nota interna da entrega', 'aprovações sem comentários nem notas internas');
select is(jsonb_array_length(public.portal_approvals('00000000-0000-4000-ae10-000000000001') -> 'pending'), 1, 'vê o conteúdo aguardando aprovação');
select is(jsonb_array_length(public.portal_files('00000000-0000-4000-ae10-000000000001') -> 'files'), 1, 'arquivos: só os compartilhados (relatórios e "para o cliente")');
select is(public.portal_file_path('00000000-0000-4000-ae10-000000000001', 'arquivo', '00000000-0000-4000-ae40-000000000002'), null, 'não baixa documento interno');
select public.portal_decide('00000000-0000-4000-ae20-000000000001', 'aprovado', null);

reset role;
select isnt((select s.name from public.tasks t join public.workflow_steps s on s.id = t.workflow_step_id where t.id = '00000000-0000-4000-ae20-000000000001'), 'Aprovação do cliente', 'aprovar pelo portal faz o fluxo interno seguir');
select is((select reviewer_name from public.approval_links where task_id = '00000000-0000-4000-ae20-000000000001' and decision = 'aprovado'), 'Carol Cliente', 'a decisão fica registrada com o nome de quem aprovou');

-- Como a equipe.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000001","role":"authenticated"}';
select throws_ok($$select public.portal_decide('00000000-0000-4000-ae20-000000000001', 'aprovado', null)$$, '42501', null, 'a equipe não aprova no lugar do cliente');
select public.save_client_strategy('00000000-0000-4000-ae10-000000000001', 'Planejamento do trimestre: foco em captação de leads.', true);
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000002","role":"authenticated"}';
select throws_ok($$insert into public.client_files (client_id, storage_path, name, uploaded_by, folder) values ('00000000-0000-4000-ae10-000000000001', 'clientes/00000000-0000-4000-ae10-000000000001/x.pdf', 'x.pdf', '00000000-0000-4000-ae00-000000000002', 'cliente')$$, '42501', null, 'quem não gerencia a área do cliente não compartilha arquivos com ele');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000001","role":"authenticated"}';
select public.set_portal_user_active('00000000-0000-4000-ae00-000000000010', false);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000010","role":"authenticated"}';
select throws_ok($$select public.portal_strategy('00000000-0000-4000-ae10-000000000001')$$, '42501', null, 'acesso pausado: não vê mais nada');

reset role;
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000010' and href = '/portal/estrategia'), 1, 'estratégia publicada avisa o cliente');

select * from finish();
rollback;
