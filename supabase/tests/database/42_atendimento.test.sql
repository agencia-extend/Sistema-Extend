-- Atendimento (RF-WPP-03): mensagens de contato e de grupo viram conversas, não lidas e "aguardando resposta",
-- aviso de conversa nova, responsável, encerrar/reabrir e o vínculo com o lead do Comercial.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf07-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.at@extend.test', '{"full_name":"Ana AT"}', now()),
  ('00000000-0000-4000-bf07-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teo.at@extend.test', '{"full_name":"Teo AT"}', now());
update public.profiles set is_active = true where email like '%.at@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.at@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf07-000000000001'::uuid, 'comercial'), ('00000000-0000-4000-bf07-000000000002'::uuid, 'social_media')) x(u, k) on r.key = x.k;
-- Sessão própria do teste: não mexe numa conexão real (uma por organização).
delete from public.whatsapp_connections where organization_id = (select id from public.organizations order by created_at limit 1);
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status)
select '00000000-0000-4000-bf27-000000000001', id, 'http://127.0.0.1:3032', 'x.y.z', 'teste', 'x.y.z', 'WORKING' from public.organizations order by created_at limit 1;
delete from public.notifications where user_id = '00000000-0000-4000-bf07-000000000001';

insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at) values
  ('00000000-0000-4000-bf27-000000000001', 'g1', '120363000000000001@g.us', false, 'Cliente X', 'Oi grupo', now() - interval '3 minutes'),
  ('00000000-0000-4000-bf27-000000000001', 'm1', '5511987654321@c.us', false, 'Marina', 'Quero saber dos planos', now() - interval '2 minutes'),
  ('00000000-0000-4000-bf27-000000000001', 'm2', '5511987654321@c.us', false, 'Marina', 'Vocês fazem tráfego?', now() - interval '1 minute');

select is((select string_agg(kind || ':' || contact_name, ',' order by kind) from public.wa_conversations where connection_id = '00000000-0000-4000-bf27-000000000001'),
  'contato:Marina,grupo:', 'contato e grupo viram conversas (grupo com o nome do grupo, ainda vazio)');
select is((select contact_name || '/' || phone || '/' || unread_count || '/' || waiting_reply || '/' || last_preview from public.wa_conversations where chat_id = '5511987654321@c.us'),
  'Marina/5511987654321/2/true/Vocês fazem tráfego?', 'nome, telefone, 2 não lidas, aguardando, última mensagem');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf07-000000000001' and kind = 'inbox'), 1,
  'conversa nova sem responsável avisa quem atende (uma vez)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf07-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.wa_conversations where chat_id = '5511987654321@c.us'), 0, 'social media não vê o atendimento');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf07-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.wa_conversations where chat_id = '5511987654321@c.us'), 1, 'comercial vê a conversa');
select throws_ok($$select public.assign_conversation((select id from public.wa_conversations where chat_id = '5511987654321@c.us'), '00000000-0000-4000-bf07-000000000002')$$,
  'P0001', 'Esta pessoa não atende o WhatsApp.', 'responsável precisa atender o WhatsApp');
select lives_ok($$select public.assign_conversation((select id from public.wa_conversations where chat_id = '5511987654321@c.us'), '00000000-0000-4000-bf07-000000000001')$$, 'assume a conversa');
select lives_ok($$select public.mark_conversation_read((select id from public.wa_conversations where chat_id = '5511987654321@c.us'))$$, 'marca como lida');
select throws_ok($$select public.create_lead_from_conversation((select id from public.wa_conversations where chat_id = '5511987654321@c.us'), 'M')$$,
  '22023', 'Informe o nome do lead.', 'nome do lead obrigatório');
select lives_ok($$select public.create_lead_from_conversation((select id from public.wa_conversations where chat_id = '5511987654321@c.us'), 'Marina Souza')$$, 'cria o lead no funil');
reset role;
set local request.jwt.claims = '';
select is((select l.name || '/' || l.source || '/' || l.phone || '/' || (l.owner_id = '00000000-0000-4000-bf07-000000000001')::text
             from public.wa_conversations c join public.leads l on l.id = c.lead_id where c.chat_id = '5511987654321@c.us'),
  'Marina Souza/whatsapp/5511987654321/true', 'lead com origem WhatsApp, telefone e dono = responsável');

-- Resposta da Extend: deixa de aguardar e zera as não lidas.
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, body, sent_at)
values ('00000000-0000-4000-bf27-000000000001', 'm3', '5511987654321@c.us', true, 'Fazemos sim!', now());
select is((select waiting_reply::text || '/' || unread_count from public.wa_conversations where chat_id = '5511987654321@c.us'), 'false/0', 'respondeu: não aguarda mais');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf07-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_conversation_status((select id from public.wa_conversations where chat_id = '5511987654321@c.us'), 'encerrada')$$, 'encerra');
reset role;
set local request.jwt.claims = '';
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf27-000000000001', 'm4', '5511987654321@c.us', false, 'Marina', 'Mais uma dúvida', now() + interval '1 second');
select is((select status || '/' || waiting_reply from public.wa_conversations where chat_id = '5511987654321@c.us'), 'aberta/true', 'contato escreveu de novo: reabre');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf07-000000000001' and kind = 'inbox' and title like 'Conversa reaberta%'), 1,
  'e avisa a responsável');

-- Lead cadastrado depois com o telefone de uma conversa: liga sozinho.
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf27-000000000001', 'n1', '5548999990000@c.us', false, 'Caio', 'Oi', now());
insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source)
select p.organization_id, p.id, (select s.id from public.pipeline_stages s where s.pipeline_id = p.id order by s.position limit 1), 'Caio Lima', '5548999990000', 'indicacao'
  from public.pipelines p where p.organization_id = (select id from public.organizations order by created_at limit 1) order by p.is_default desc limit 1;
select is((select l.name from public.wa_conversations c join public.leads l on l.id = c.lead_id where c.chat_id = '5548999990000@c.us'), 'Caio Lima', 'lead novo com o telefone liga à conversa');

select * from finish();
rollback;
