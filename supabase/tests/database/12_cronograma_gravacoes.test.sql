-- Gravações por diária e capa do post: permissões, efeitos nos conteúdos e avisos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ad00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gravacao.g@extend.test', '{"full_name":"Gravação G"}', now()),
  ('00000000-0000-4000-ad00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editora.g@extend.test', '{"full_name":"Editora G"}', now()),
  ('00000000-0000-4000-ad00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leitura.g@extend.test', '{"full_name":"Leitura G"}', now());
update public.profiles set is_active = true where email like '%.g@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.g@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ad00-000000000001', id from public.roles where key = 'admin';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ad00-000000000002', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ad00-000000000003', id from public.roles where key = 'leitura';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-ad10-000000000001', id, 'Cliente Gravação', 'ativo' from public.organizations limit 1;
insert into public.tasks (id, organization_id, client_id, type, title) select '00000000-0000-4000-ad20-000000000001', organization_id, id, 'video', 'Vídeo depoimento' from public.clients where id = '00000000-0000-4000-ad10-000000000001';
insert into public.task_content (task_id, editor_id) values ('00000000-0000-4000-ad20-000000000001', '00000000-0000-4000-ad00-000000000002')
  on conflict (task_id) do update set editor_id = excluded.editor_id;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ad00-000000000001","role":"authenticated"}';
select isnt(public.save_recording(jsonb_build_object(
  'client_id', '00000000-0000-4000-ad10-000000000001', 'recorded_on', private.today_sp()::text, 'location', 'Clínica',
  'raw_url', 'https://drive.google.com/brutos', 'people', jsonb_build_array('00000000-0000-4000-ad00-000000000001'),
  'tasks', jsonb_build_array('00000000-0000-4000-ad20-000000000001'))), null, 'registra a diária');
select is((select recording_on from public.task_content where task_id = '00000000-0000-4000-ad20-000000000001'), private.today_sp(), 'conteúdo recebe a data da gravação');
select is((select raw_url from public.task_content where task_id = '00000000-0000-4000-ad20-000000000001'), 'https://drive.google.com/brutos', 'e o link dos brutos');
select is((select recorder_id from public.task_content where task_id = '00000000-0000-4000-ad20-000000000001'), '00000000-0000-4000-ad00-000000000001'::uuid, 'e quem gravou');
select throws_ok($$select public.save_recording(jsonb_build_object('client_id', '00000000-0000-4000-ad10-000000000001', 'recorded_on', private.today_sp()::text, 'people', '[]'::jsonb))$$,
  'P0001', 'Marque quem gravou.', 'precisa de quem gravou');
select throws_ok($$select public.set_content_cover('00000000-0000-4000-ad20-000000000001', 'clientes/00000000-0000-4000-ad10-000000000999/capas/x.jpg')$$,
  'P0001', null, 'capa de outro cliente é recusada');
select lives_ok($$select public.set_content_cover('00000000-0000-4000-ad20-000000000001', 'clientes/00000000-0000-4000-ad10-000000000001/capas/x.jpg')$$, 'capa do próprio cliente entra');

-- Somente leitura não registra gravação nem escreve direto na tabela.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ad00-000000000003","role":"authenticated"}';
select throws_ok($$select public.save_recording(jsonb_build_object('client_id', '00000000-0000-4000-ad10-000000000001', 'recorded_on', private.today_sp()::text, 'people', jsonb_build_array('00000000-0000-4000-ad00-000000000003')))$$,
  '42501', null, 'somente leitura não registra gravação');
select throws_ok($$insert into public.recording_sessions (client_id, recorded_on) values ('00000000-0000-4000-ad10-000000000001', current_date)$$, '42501', null, 'nem escreve direto na tabela');

reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-ad00-000000000002' and title = 'Brutos da gravação de Cliente Gravação disponíveis'), 'quem edita é avisado dos brutos');

select * from finish();
rollback;
