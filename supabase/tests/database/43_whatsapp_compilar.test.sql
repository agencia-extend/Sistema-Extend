-- "Compilar conversas": o histórico entra sem avisar ninguém, monta a conversa (encerrada se antiga, aguardando se o
-- contato falou por último há pouco), não duplica, liga o lead pelo telefone, grava o grupo com o nome; só o servidor
-- importa; a compilação só é vista por quem conecta. Grupo novo pelo webhook não avisa; o nome do grupo passa à conversa.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf08-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.wc@extend.test', '{"full_name":"Ana WC"}', now()),
  ('00000000-0000-4000-bf08-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ate.wc@extend.test', '{"full_name":"Ate WC"}', now());
update public.profiles set is_active = true where email like '%.wc@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.wc@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf08-000000000001'::uuid, 'comercial'), ('00000000-0000-4000-bf08-000000000002'::uuid, 'atendimento')) x(u, k) on r.key = x.k;
delete from public.whatsapp_connections where organization_id = (select id from public.organizations order by created_at limit 1);
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status)
select '00000000-0000-4000-bf28-000000000001', id, 'http://127.0.0.1:3032', 'x.y.z', 'teste', 'x.y.z', 'WORKING' from public.organizations order by created_at limit 1;
delete from public.notifications where user_id in ('00000000-0000-4000-bf08-000000000001', '00000000-0000-4000-bf08-000000000002');
insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source)
select p.organization_id, p.id, (select s.id from public.pipeline_stages s where s.pipeline_id = p.id order by s.position limit 1), 'Lia Antiga', '5511900000001', 'indicacao'
  from public.pipelines p where p.organization_id = (select id from public.organizations order by created_at limit 1) order by p.is_default desc limit 1;

-- Contato recente (falou por último há 1 hora) e contato antigo (há 60 dias).
select is(public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '5511900000001@c.us', 'contato', '5511900000001', 'Lia', jsonb_build_array(
    jsonb_build_object('wamid', 'h1', 'from_me', false, 'author_name', 'Lia', 'body', 'Oi, tudo bem?', 'kind', 'text', 'sent_at', now() - interval '2 hours'),
    jsonb_build_object('wamid', 'h2', 'from_me', true, 'body', 'Tudo! Como posso ajudar?', 'kind', 'text', 'sent_at', now() - interval '90 minutes'),
    jsonb_build_object('wamid', 'h3', 'from_me', false, 'author_name', 'Lia', 'body', 'Quero o orçamento', 'kind', 'text', 'sent_at', now() - interval '1 hour'))),
  3, 'três mensagens entram');
select is(public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '5511900000002@c.us', 'contato', '5511900000002', '', jsonb_build_array(
    jsonb_build_object('wamid', 'o1', 'from_me', false, 'author_name', 'Beto', 'body', null, 'kind', 'media', 'sent_at', now() - interval '60 days'))),
  1, 'mídia antiga entra');

select is((select status || '/' || waiting_reply || '/' || unread_count || '/' || last_preview || '/' || contact_name || '/' || (lead_id is not null) || '/' || (imported_at is not null)
             from public.wa_conversations where chat_id = '5511900000001@c.us'),
  'aberta/true/0/Quero o orçamento/Lia/true/true', 'recente: aberta, aguardando, sem não lidas, última mensagem, lead ligado pelo telefone');
select is((select status || '/' || waiting_reply || '/' || last_preview from public.wa_conversations where chat_id = '5511900000002@c.us'),
  'encerrada/false/[mídia]', 'antiga (60 dias): entra encerrada');
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-4000-bf08-000000000001', '00000000-0000-4000-bf08-000000000002')), 0,
  'compilar não avisa ninguém');

-- Compilar de novo não duplica; mensagem nova pelo webhook continua avisando normalmente.
select is(public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '5511900000001@c.us', 'contato', '5511900000001', 'Lia', jsonb_build_array(
    jsonb_build_object('wamid', 'h1', 'from_me', false, 'body', 'Oi, tudo bem?', 'kind', 'text', 'sent_at', now() - interval '2 hours'))),
  0, 'compilar de novo não duplica');
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf28-000000000001', 'w1', '5511900000002@c.us', false, 'Beto', 'Voltei!', now());
select is((select status || '/' || unread_count || '/' || last_preview from public.wa_conversations where chat_id = '5511900000002@c.us'), 'aberta/1/Voltei!',
  'depois da compilação, a mensagem nova reabre a conversa');

-- Grupo: grava o grupo com o nome e a conversa mostra quem escreveu.
select is(public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '120363000000000009@g.us', 'grupo', null, 'Clínica Sorriso | Extend', jsonb_build_array(
    jsonb_build_object('wamid', 'g1', 'from_me', false, 'author', '5548999990000@c.us', 'author_name', 'Dra. Paula', 'body', 'Aprovado o post!', 'kind', 'text', 'sent_at', now() - interval '1 day'))),
  1, 'grupo: mensagem entra');
select is((select g.name || '/' || c.kind || '/' || c.contact_name || '/' || c.last_preview from public.whatsapp_groups g
             join public.wa_conversations c on c.connection_id = g.connection_id and c.chat_id = g.jid where g.jid = '120363000000000009@g.us'),
  'Clínica Sorriso | Extend/grupo/Clínica Sorriso | Extend/Dra. Paula: Aprovado o post!', 'grupo gravado com o nome; prévia com quem escreveu');
select throws_ok($$select public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '5511900000003@c.us', 'grupo', null, 'X', '[]'::jsonb)$$,
  '22023', 'Conversa inválida.', 'tipo precisa bater com o endereço');

-- Grupo novo pelo webhook: vira conversa sem avisar; o nome atualizado em Buscar grupos passa à conversa.
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf28-000000000001', 'w2', '120363000000000010@g.us', false, 'Caio', 'Bom dia', now());
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-4000-bf08-000000000001', '00000000-0000-4000-bf08-000000000002') and title like 'Nova conversa%'), 0,
  'grupo novo não avisa');
update public.whatsapp_groups set name = 'Padaria Pão Bom' where jid = '120363000000000010@g.us';
select is((select contact_name from public.wa_conversations where chat_id = '120363000000000010@g.us'), 'Padaria Pão Bom', 'nome do grupo passa à conversa');

-- Só o servidor importa; a compilação só é vista por quem conecta (Comercial sim, Atendimento não).
insert into public.wa_imports (organization_id, connection_id, created_by)
select organization_id, id, '00000000-0000-4000-bf08-000000000001' from public.whatsapp_connections where id = '00000000-0000-4000-bf28-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf08-000000000002","role":"authenticated"}';
select throws_ok($$select public.wa_import_chat('00000000-0000-4000-bf28-000000000001', '5511900000004@c.us', 'contato', null, 'X', '[]'::jsonb)$$,
  '42501', null, 'quem usa o sistema não importa direto');
select is((select count(*)::int from public.wa_imports), 0, 'atendimento não vê a compilação');
reset role;

select * from finish();
rollback;
