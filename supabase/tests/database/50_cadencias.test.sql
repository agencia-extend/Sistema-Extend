-- Cadências (RF-CRM-06): quem configura o funil cria modelos; iniciar cria as próximas ações no dia e hora de São
-- Paulo com {nome}; uma por lead; pausar guarda e retomar devolve os prazos; responder no WhatsApp pausa e avisa;
-- "não quer mais contato" encerra e bloqueia; terminar os passos conclui; o envio automático é só do servidor.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf81-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co.cd@extend.test', '{"full_name":"Co CD"}', now()),
  ('00000000-0000-4000-bf81-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'at.cd@extend.test', '{"full_name":"At CD"}', now());
update public.profiles set is_active = true where email like '%.cd@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.cd@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf81-000000000001'::uuid, 'comercial'), ('00000000-0000-4000-bf81-000000000002'::uuid, 'atendimento')) x(u, k) on r.key = x.k;
insert into public.leads (id, organization_id, pipeline_id, stage_id, name, company, phone, source, owner_id)
select '00000000-0000-4000-bf82-000000000001', o.id, p.id, (select s.id from public.pipeline_stages s where s.pipeline_id = p.id order by s.position limit 1),
       'Carla Mendes CD', 'Clínica Sorriso', '5511977771111', 'site', '00000000-0000-4000-bf81-000000000001'
  from public.organizations o join public.pipelines p on p.organization_id = o.id where o.id = (select id from public.organizations order by created_at limit 1)
 order by p.is_default desc limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf81-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_cadence(null, 'Da atendente CD', '', '[{"day":0,"time":"09:00","kind":"ligacao","title":"Ligar"}]')$$, '42501', null, 'quem não configura o funil não cria cadência');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf81-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_cadence(null, 'Teste CD', 'para o teste', '[
  {"day":0,"time":"23:59","kind":"mensagem","title":"Boas-vindas","message":"Oi, {nome}! Tudo bem na {empresa}?","auto":true},
  {"day":2,"time":"10:00","kind":"ligacao","title":"Ligar"}]')$$, 'comercial cria cadência com 2 passos');
select throws_ok($$select public.save_cadence(null, 'teste cd', '', '[{"day":0,"time":"09:00","kind":"ligacao","title":"Ligar"}]')$$, 'P0001', 'Já existe uma cadência com este nome.', 'nome não repete');
select throws_ok($$select public.save_cadence(null, 'Sem texto CD', '', '[{"day":0,"time":"09:00","kind":"ligacao","title":"Ligar","auto":true}]')$$, '23514', null, 'só mensagem com texto sai sozinha');

select lives_ok($$select public.enroll_lead('00000000-0000-4000-bf82-000000000001', (select id from public.cadence_templates where name = 'Teste CD'), private.today_sp())$$, 'inicia no lead');
select is((select count(*)::int from public.lead_activities where enrollment_id is not null and lead_id = '00000000-0000-4000-bf82-000000000001'), 2, 'cada passo vira uma próxima ação');
select is((select auto_message from public.lead_activities where enrollment_id is not null and kind = 'mensagem' and lead_id = '00000000-0000-4000-bf82-000000000001'),
  'Oi, Carla! Tudo bem na Clínica Sorriso?', 'mensagem com primeiro nome e empresa');
select is((select to_char(due_at at time zone 'America/Sao_Paulo', 'HH24:MI') from public.lead_activities where enrollment_id is not null and kind = 'ligacao' and lead_id = '00000000-0000-4000-bf82-000000000001'),
  '10:00', 'horário de São Paulo');
select throws_ok($$select public.enroll_lead('00000000-0000-4000-bf82-000000000001', (select id from public.cadence_templates where name = 'Teste CD'), private.today_sp())$$,
  'P0001', 'Este lead já tem uma cadência em andamento. Cancele antes de começar outra.', 'uma cadência por vez');

select lives_ok($$select public.change_cadence((select id from public.cadence_enrollments where lead_id = '00000000-0000-4000-bf82-000000000001'), 'pausar')$$, 'pausa');
select is((select count(*)::int from public.lead_activities where enrollment_id is not null and due_at is null and held_due_at is not null), 2, 'pausada guarda os prazos');
select lives_ok($$select public.change_cadence((select id from public.cadence_enrollments where lead_id = '00000000-0000-4000-bf82-000000000001'), 'retomar')$$, 'retoma');
reset role;

-- Respondeu no WhatsApp: pausa e avisa o responsável (a mensagem chega pelo servidor, sem pessoa logada).
set local request.jwt.claims = '{}';
delete from public.whatsapp_connections where organization_id = (select id from public.organizations order by created_at limit 1);
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status)
select '00000000-0000-4000-bf83-000000000001', id, 'http://127.0.0.1:3032', 'x.y.z', 'teste', 'x.y.z', 'WORKING' from public.organizations order by created_at limit 1;
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf83-000000000001', 'cd1', '5511977771111@c.us', false, 'Carla', 'Oi! Tenho interesse sim', now() + interval '1 second');
select is((select status || '/' || reason from public.cadence_enrollments where lead_id = '00000000-0000-4000-bf82-000000000001'), 'pausada/Respondeu no WhatsApp', 'responder no WhatsApp pausa');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf81-000000000001' and title like 'Respondeu:%'), 1, 'o responsável é avisado');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf81-000000000001","role":"authenticated"}';
select public.set_lead_opt_out('00000000-0000-4000-bf82-000000000001', true, 'Pediu para parar');
select is((select status || '/' || (select count(*) from public.lead_activities where enrollment_id = e.id and done_at is null) from public.cadence_enrollments e where lead_id = '00000000-0000-4000-bf82-000000000001'),
  'cancelada/0', 'não quer mais contato encerra e tira os passos');
select throws_ok($$select * from public.cadence_due_messages(10)$$, '42501', null, 'só o servidor pega as mensagens automáticas');
reset role;

select * from finish();
rollback;
