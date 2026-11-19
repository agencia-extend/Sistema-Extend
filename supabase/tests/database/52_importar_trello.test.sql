-- Importação do Trello (RF-TAR-11): só quem distribui as demandas do cliente importa; cria quadro, colunas, cards,
-- etiquetas, checklist, comentários e links; responsável só da equipe; um aviso por pessoa (sem um por card ou
-- comentário); o mesmo quadro não entra duas vezes; quem é de fora não vê; desfazer tira os cards e arquiva o quadro.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf95-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sm.tr@extend.test', '{"full_name":"Sm TR"}', now()),
  ('00000000-0000-4000-bf95-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'de.tr@extend.test', '{"full_name":"De TR"}', now()),
  ('00000000-0000-4000-bf95-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ou.tr@extend.test', '{"full_name":"Ou TR"}', now());
update public.profiles set is_active = true where email like '%.tr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.tr@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf95-000000000001'::uuid, 'social_media'), ('00000000-0000-4000-bf95-000000000002'::uuid, 'designer'),
  ('00000000-0000-4000-bf95-000000000003'::uuid, 'social_media')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf96-000000000001', id, 'Clínica TR', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf96-000000000001', s.id, '00000000-0000-4000-bf95-000000000001' from public.sectors s where s.key = 'gerenciamento';

create temp table board_json as select $j${
  "sourceId": "65a1b2c3000000000000aaaa", "sourceName": "Clínica TR — Conteúdo", "name": "Conteúdo (Trello)",
  "columns": [{"name": "A fazer", "color": "#64748B", "done": false}, {"name": "Concluído", "color": "#22C55E", "done": true}],
  "cards": [
    {"col": 0, "title": "Reels de março", "desc": "Roteiro no Drive", "due": "2026-12-01T15:00:00Z", "start": null,
     "created": "2026-01-10T12:00:00Z", "closedAt": null, "pos": 1000,
     "labels": [{"name": "Urgente TR", "color": "#EB5A46"}],
     "assignee": "00000000-0000-4000-bf95-000000000002", "participants": ["00000000-0000-4000-bf95-000000000001"],
     "checklist": [{"title": "Gancho", "done": true}, {"title": "Texto", "done": false}],
     "comments": [{"author": "Luiz", "at": "2026-10-01T15:00:00Z", "text": "Primeira versão"}],
     "links": [{"name": "Briefing", "url": "https://drive.google.com/x"}, {"name": "ruim", "url": "javascript:alert(1)"}]},
    {"col": 1, "title": "Post antigo", "desc": "", "due": null, "start": null, "created": null, "closedAt": "2026-11-01T10:00:00Z", "pos": 1000,
     "labels": [], "assignee": "00000000-0000-4000-bf9f-000000000099", "participants": [], "checklist": [], "comments": [], "links": []}
  ]}$j$::jsonb as b;
grant select on board_json to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf95-000000000002","role":"authenticated"}';
select throws_ok($$select public.import_trello_board('00000000-0000-4000-bf96-000000000001', (select b from board_json))$$, '42501', null,
  'quem não distribui as demandas do cliente não importa');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf95-000000000001","role":"authenticated"}';
select lives_ok($$select public.import_trello_board('00000000-0000-4000-bf96-000000000001', (select b from board_json))$$, 'social media do cliente importa');
reset role;

select is((select string_agg(c.name || ':' || c.is_done, ',' order by c.position) from public.board_columns c join public.boards b on b.id = c.board_id
  where b.client_id = '00000000-0000-4000-bf96-000000000001'), 'A fazer:false,Concluído:true', 'colunas na ordem, com a de concluído');
select is((select status || '/' || coalesce(assignee_id::text, '-') from public.tasks where title = 'Reels de março' and client_id = '00000000-0000-4000-bf96-000000000001'),
  'pendente/00000000-0000-4000-bf95-000000000002', 'card aberto com o responsável da equipe');
select is((select status || '/' || coalesce(assignee_id::text, '-') || '/' || to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD') from public.tasks where title = 'Post antigo' and client_id = '00000000-0000-4000-bf96-000000000001'),
  'concluido/-/2026-11-01', 'card da coluna de concluído entra concluído na data do Trello; responsável desconhecido fica em branco');
select is((select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') from public.tasks where title = 'Reels de março' and client_id = '00000000-0000-4000-bf96-000000000001'),
  '2026-01-10', 'mantém a data de criação do Trello');
select is((select count(*)::int from public.task_tags tt join public.tags t on t.id = tt.tag_id join public.tasks k on k.id = tt.task_id
  where t.name = 'Urgente TR' and k.client_id = '00000000-0000-4000-bf96-000000000001'), 1, 'etiqueta vira etiqueta do sistema');
select is((select count(*) filter (where done_at is not null)::text || '/' || count(*)::text from public.task_checklist_items i join public.tasks k on k.id = i.task_id
  where k.title = 'Reels de março' and k.client_id = '00000000-0000-4000-bf96-000000000001'), '1/2', 'checklist com o que já estava feito');
select ok((select body like 'Luiz no Trello, 01/10/2026 12:00:%Primeira versão' from public.task_comments c join public.tasks k on k.id = c.task_id
  where k.title = 'Reels de março' and k.client_id = '00000000-0000-4000-bf96-000000000001'), 'comentário com autor e data do Trello');
select is((select count(*)::int from public.task_attachments a join public.tasks k on k.id = a.task_id
  where k.client_id = '00000000-0000-4000-bf96-000000000001' and a.kind = 'link'), 1, 'só links http(s) entram');
select is((select count(*)::int from public.task_participants p join public.tasks k on k.id = p.task_id
  where k.client_id = '00000000-0000-4000-bf96-000000000001'), 1, 'outros membros entram como participantes');
select is((select string_agg(kind || ':' || title, ',') from public.notifications where user_id = '00000000-0000-4000-bf95-000000000002'),
  'assigned:1 card do Trello está com você', 'um aviso só por pessoa, sem um por card ou comentário');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf95-000000000001","role":"authenticated"}';
select throws_ok($$select public.import_trello_board('00000000-0000-4000-bf96-000000000001', (select b from board_json))$$, '23505', null,
  'o mesmo quadro do Trello não entra duas vezes');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf95-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.trello_imports where client_id = '00000000-0000-4000-bf96-000000000001'), 0, 'quem é de fora do cliente não vê a importação');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf95-000000000001","role":"authenticated"}';
select lives_ok($$select public.undo_trello_import((select id from public.trello_imports where client_id = '00000000-0000-4000-bf96-000000000001'))$$,
  'desfaz a importação');
reset role;
select is((select count(*) filter (where deleted_at is null)::text || '/' || bool_and(b.archived_at is not null)::text from public.tasks k join public.boards b on b.id = k.board_id
  where k.client_id = '00000000-0000-4000-bf96-000000000001'), '0/true', 'desfazer tira os cards e arquiva o quadro');

select * from finish();
rollback;
