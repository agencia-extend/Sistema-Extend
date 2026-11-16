-- Histórico de reprovações da Meta (RF-T2-02): quem lê, quem registra, criativo marcado como reprovado, avisos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- Ana e Bia (gestoras) no tráfego do cliente; Dani (designer) no design do cliente e produziu o criativo;
-- Edu (gestor) e Vic (editor) fora do cliente.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b700-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.rp@extend.test', '{"full_name":"Ana RP"}', now()),
  ('00000000-0000-4000-b700-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bia.rp@extend.test', '{"full_name":"Bia RP"}', now()),
  ('00000000-0000-4000-b700-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dani.rp@extend.test', '{"full_name":"Dani RP"}', now()),
  ('00000000-0000-4000-b700-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.rp@extend.test', '{"full_name":"Edu RP"}', now()),
  ('00000000-0000-4000-b700-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vic.rp@extend.test', '{"full_name":"Vic RP"}', now());
update public.profiles set is_active = true where email like '%.rp@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.rp@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-b700-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-b700-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-b700-000000000003'::uuid, 'designer'), ('00000000-0000-4000-b700-000000000004'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-b700-000000000005'::uuid, 'editor_video')) x(u, k) on r.key = x.k;

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-b710-000000000001', id, 'Clínica Reprovação', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b710-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-b700-000000000001'::uuid), ('trafego', '00000000-0000-4000-b700-000000000002'::uuid),
  ('design', '00000000-0000-4000-b700-000000000003'::uuid)) x(k, u) on s.key = x.k;

-- Criativo pedido pela Bia, produzido pela Dani, aprovado na biblioteca.
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id)
select '00000000-0000-4000-b720-000000000001', organization_id, id, 'criativo', 'Antes e depois do clareamento', '00000000-0000-4000-b700-000000000003'
  from public.clients where id = '00000000-0000-4000-b710-000000000001';
insert into public.creative_requests (task_id, client_id, requested_by, campaign, objective, format, angle, audience, cta)
values ('00000000-0000-4000-b720-000000000001', '00000000-0000-4000-b710-000000000001', '00000000-0000-4000-b700-000000000002',
  'Clareamento', 'mensagens', 'imagem', 'Antes e depois do clareamento', 'Mulheres 25-45', 'Chamar no WhatsApp');
insert into public.creative_library (id, task_id, client_id, campaign, format, angle)
values ('00000000-0000-4000-b730-000000000001', '00000000-0000-4000-b720-000000000001', '00000000-0000-4000-b710-000000000001', 'Clareamento', 'imagem', 'Antes e depois do clareamento');
delete from public.notifications where user_id in (select id from public.profiles where email like '%.rp@extend.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.ad_rejections (client_id, library_id, format, angle, reason, policy_text, lesson)
  values ('00000000-0000-4000-b710-000000000001', '00000000-0000-4000-b730-000000000001', 'imagem', 'Antes e depois do clareamento', 'antes_depois',
          'Anúncios não podem mostrar imagens de antes e depois.', 'Mostrar o sorriso só depois, sem comparação')$$, 'gestora registra a reprovação');
select throws_ok($$insert into public.ad_rejections (client_id, format, angle, reason, policy_text, source)
  values ('00000000-0000-4000-b710-000000000001', 'video', 'Teste', 'outro', 'Forjar origem', 'sync')$$, '42501', null, 'a origem não vem do formulário');
select throws_ok($$insert into public.ad_rejections (client_id, rejected_on, format, angle, reason, policy_text)
  values ('00000000-0000-4000-b710-000000000001', private.today_sp() + 1, 'video', 'Teste', 'outro', 'Data futura')$$, 'P0001', 'A data da reprovação não pode ser no futuro.', 'data futura é recusada');
select throws_ok($$insert into public.ad_rejections (client_id, library_id, format, angle, reason, policy_text)
  values ('00000000-0000-4000-b710-000000000001', gen_random_uuid(), 'video', 'Teste', 'outro', 'Criativo de outro cliente')$$, 'P0001', 'Este criativo não é deste cliente.', 'criativo de outro cliente é recusado');
select is((select created_by from public.ad_rejections where reason = 'antes_depois'), '00000000-0000-4000-b700-000000000001'::uuid, 'o autor é quem está logado');

-- Dani (designer do cliente) vê para saber o que evitar, mas não registra.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.ad_rejections), 1, 'quem produz criativos para o cliente vê as reprovações');
select throws_ok($$insert into public.ad_rejections (client_id, format, angle, reason, policy_text)
  values ('00000000-0000-4000-b710-000000000001', 'video', 'Teste', 'outro', 'Designer tentando')$$, '42501', null, 'designer não registra');

-- Fora do cliente: nada.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.ad_rejections), 0, 'gestor de fora do cliente não vê');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.ad_rejections), 0, 'editor de fora do cliente não vê');

-- Bia (outra gestora do cliente) registra o desfecho.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000002","role":"authenticated"}';
update public.ad_rejections set outcome = 'corrigido' where client_id = '00000000-0000-4000-b710-000000000001';
select is((select outcome from public.ad_rejections where client_id = '00000000-0000-4000-b710-000000000001'), 'corrigido', 'quem otimiza o cliente registra o desfecho');
reset role;

select is((select status from public.creative_library where id = '00000000-0000-4000-b730-000000000001'), 'reprovado_meta', 'o criativo da biblioteca fica "Reprovado pela Meta"');
select is((select count(*)::int from public.client_timeline where client_id = '00000000-0000-4000-b710-000000000001' and kind = 'trafego' and title like 'Anúncio reprovado pela Meta: antes e depois%'), 1, 'entra no histórico do cliente');
select is((select array_agg(user_id order by user_id) from public.notifications where title = 'Anúncio reprovado: Clínica Reprovação'),
  array['00000000-0000-4000-b700-000000000002', '00000000-0000-4000-b700-000000000003']::uuid[], 'avisa a outra gestora (que pediu) e a designer (que produziu); quem registrou, não');

select is((select href from public.notifications where title = 'Anúncio reprovado: Clínica Reprovação' and user_id = '00000000-0000-4000-b700-000000000003'), '/criativos/00000000-0000-4000-b720-000000000001', 'a designer abre o criativo (não tem a aba Tráfego)');

-- Reprovação detectada na sincronização não é alterada nem apagada pela tela.
set local request.jwt.claims = '{}';
insert into public.ad_rejections (client_id, format, angle, reason, policy_text, source)
values ('00000000-0000-4000-b710-000000000001', 'video', 'Depoimento', 'saude', 'Alegação de saúde', 'sync');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b700-000000000001","role":"authenticated"}';
update public.ad_rejections set outcome = 'descartado' where source = 'sync';
delete from public.ad_rejections where source = 'sync';
select is((select outcome from public.ad_rejections where source = 'sync'), null, 'a automática não muda');
select is((select count(*)::int from public.ad_rejections where source = 'sync'), 1, 'nem é apagada');
select lives_ok($$delete from public.ad_rejections where source = 'manual'$$, 'a manual pode ser apagada por quem otimiza o cliente');
reset role;
select is((select count(*)::int from public.ad_rejections where source = 'manual'), 0, 'apagada');

select * from finish();
rollback;
