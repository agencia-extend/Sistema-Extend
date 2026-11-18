-- Programar publicações (RF-CON-03): quem programa, perfis prontos (permissões da conexão), regras de formato e
-- horário, cancelar/reagendar, fila do servidor e o aviso do resultado.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf06-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.pb@extend.test', '{"full_name":"Sol PB"}', now()),
  ('00000000-0000-4000-bf06-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui.pb@extend.test', '{"full_name":"Rui PB"}', now()),
  ('00000000-0000-4000-bf06-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.pb@extend.test', '{"full_name":"Gil PB"}', now());
update public.profiles set is_active = true where email like '%.pb@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pb@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf06-000000000001'::uuid, 'social_media'), ('00000000-0000-4000-bf06-000000000002'::uuid, 'social_media'),
  ('00000000-0000-4000-bf06-000000000003'::uuid, 'gestor_trafego')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf16-000000000001', id, 'PB Doceria', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf16-000000000001', s.id, x.u from public.sectors s join (values
  ('conteudo', '00000000-0000-4000-bf06-000000000001'::uuid), ('trafego', '00000000-0000-4000-bf06-000000000003'::uuid)) x(k, u) on s.key = x.k;
-- Conexão com permissão de publicar no Facebook, mas sem a do Instagram.
insert into public.integration_connections (id, organization_id, provider, purpose, owner_kind, profile_id, scopes, token_enc)
select '00000000-0000-4000-bf26-000000000001', id, 'meta', 'ads', 'user', '00000000-0000-4000-bf06-000000000003',
       array['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'], 'x.y.z'
  from public.organizations order by created_at limit 1;
insert into public.social_profiles (id, organization_id, connection_id, platform, external_id, page_external_id, name, username, client_id)
select x.id, o.id, '00000000-0000-4000-bf26-000000000001', x.platform, x.ext, x.page, 'PB Doceria', x.u, '00000000-0000-4000-bf16-000000000001'
  from (select id from public.organizations order by created_at limit 1) o, (values
  ('00000000-0000-4000-bf36-000000000001'::uuid, 'facebook', 'pg9101', null, null),
  ('00000000-0000-4000-bf36-000000000002'::uuid, 'instagram', 'ig9101', 'pg9101', 'pb_doceria')) x(id, platform, ext, page, u);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf06-000000000001","role":"authenticated"}';
select is((select string_agg(platform || ':' || array_to_string(missing, '+'), ',' order by platform) from public.publish_targets('00000000-0000-4000-bf16-000000000001')),
  'facebook:,instagram:instagram_basic+instagram_content_publish', 'Facebook pronto; Instagram mostra o que falta');
select throws_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000002'::uuid], 'feed', 'Oi',
  array['clientes/00000000-0000-4000-bf16-000000000001/publicacoes/a.png'], null, null, now() + interval '1 day', null)$$,
  'P0001', 'Ainda não dá para publicar em @pb_doceria: falta instagram_basic, instagram_content_publish.', 'Instagram sem permissão recusa');
select throws_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'feed', 'Oi',
  '{}', 'clientes/00000000-0000-4000-bf16-000000000001/publicacoes/v.mp4', null, now() + interval '1 day', null)$$,
  '22023', 'Feed leva de 1 a 10 imagens. Para vídeo, use Reels ou Vídeo.', 'feed com vídeo recusa');
select throws_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'feed', 'Oi',
  array['clientes/00000000-0000-4000-bf16-000000000001/publicacoes/a.png'], null, null, now() + interval '1 minute', null)$$,
  '22023', 'Escolha um horário a partir de 5 minutos daqui.', 'horário em menos de 5 minutos recusa');
select throws_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'feed', 'Oi',
  array['clientes/00000000-0000-4000-bf99-000000000099/publicacoes/a.png'], null, null, now() + interval '1 day', null)$$,
  'P0001', 'Arquivo inválido para este cliente.', 'arquivo de outro cliente recusa');
select lives_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'feed', 'Bolo do dia',
  array['clientes/00000000-0000-4000-bf16-000000000001/publicacoes/a.png', 'clientes/00000000-0000-4000-bf16-000000000001/publicacoes/b.png'], null, null, now() + interval '1 day', null)$$,
  'social media do cliente programa um carrossel no Facebook');
select lives_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'stories', 'some',
  '{}', null, '1AbCdEfGhIjKlmno', now() + interval '2 days', null)$$, 'e um Stories com vídeo do Drive');
select is((select caption from public.post_schedules where format = 'stories' and client_id = '00000000-0000-4000-bf16-000000000001'), '', 'Stories fica sem legenda');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf06-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.post_schedules where client_id = '00000000-0000-4000-bf16-000000000001'), 0, 'social media de fora do cliente não vê');
select throws_ok($$select public.schedule_post('00000000-0000-4000-bf16-000000000001', array['00000000-0000-4000-bf36-000000000001'::uuid], 'feed', 'x',
  array['clientes/00000000-0000-4000-bf16-000000000001/publicacoes/a.png'], null, null, now() + interval '1 day', null)$$, '42501', null, 'nem programa');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf06-000000000003","role":"authenticated"}';
select throws_ok($$select public.cancel_post((select id from public.post_schedules where format = 'feed' limit 1))$$, 'P0002', null, 'tráfego (sem programar) não vê nem cancela');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf06-000000000001","role":"authenticated"}';
select lives_ok($$select public.cancel_post((select id from public.post_schedules where format = 'stories' and client_id = '00000000-0000-4000-bf16-000000000001'))$$, 'cancela o Stories');
select lives_ok($$select public.reschedule_post((select id from public.post_schedules where format = 'stories' and client_id = '00000000-0000-4000-bf16-000000000001'), now() + interval '3 days')$$,
  'reagendar o cancelado volta para a fila');
select throws_ok($$select public.claim_due_posts(10)$$, '42501', null, 'só o servidor pega a fila');
reset role;
set local request.jwt.claims = '';

-- Fila: vence o carrossel; o servidor pega, publica e avisa quem programou.
update public.post_schedules set scheduled_at = now() - interval '1 minute' where format = 'feed' and client_id = '00000000-0000-4000-bf16-000000000001';
select is((select count(*)::int from public.claim_due_posts(10) c where c.client_id = '00000000-0000-4000-bf16-000000000001'), 1, 'a fila pega só o que venceu');
select public.finish_post((select id from public.post_schedules where format = 'feed' and client_id = '00000000-0000-4000-bf16-000000000001'),
  'publicado', '123_456', 'https://www.facebook.com/123_456', null, null);
select is((select status || '/' || permalink from public.post_schedules where format = 'feed' and client_id = '00000000-0000-4000-bf16-000000000001'),
  'publicado/https://www.facebook.com/123_456', 'fica publicado com o link');
select is((select title from public.notifications where user_id = '00000000-0000-4000-bf06-000000000001' and kind = 'post'), 'Publicado em PB Doceria', 'quem programou é avisado');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf06-000000000001","role":"authenticated"}';
select throws_ok($$select public.cancel_post((select id from public.post_schedules where format = 'feed' and client_id = '00000000-0000-4000-bf16-000000000001'))$$,
  'P0001', 'Esta publicação já foi publicado e não pode ser cancelada.', 'publicada não cancela');
reset role;

select * from finish();
rollback;
