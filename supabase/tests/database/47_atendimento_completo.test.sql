-- Atendimento como no HubSystem (RF-WPP-03/06/07): etiquetas, respostas rápidas e radar só por quem administra;
-- quem atende põe etiquetas; apagar some da lista e volta com mensagem nova; telefone de id oculto liga o lead;
-- conversa que veio de anúncio vira lead no início do funil com a origem anúncio.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf47-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co.ac@extend.test', '{"full_name":"Co AC"}', now()),
  ('00000000-0000-4000-bf47-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'at.ac@extend.test', '{"full_name":"At AC"}', now()),
  ('00000000-0000-4000-bf47-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sm.ac@extend.test', '{"full_name":"Sm AC"}', now());
update public.profiles set is_active = true where email like '%.ac@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.ac@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf47-000000000001'::uuid, 'comercial'), ('00000000-0000-4000-bf47-000000000002'::uuid, 'atendimento'),
  ('00000000-0000-4000-bf47-000000000003'::uuid, 'social_media')) x(u, k) on r.key = x.k;
delete from public.whatsapp_connections where organization_id = (select id from public.organizations order by created_at limit 1);
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status)
select '00000000-0000-4000-bf48-000000000001', id, 'http://127.0.0.1:3032', 'x.y.z', 'teste', 'x.y.z', 'WORKING' from public.organizations order by created_at limit 1;
insert into public.leads (organization_id, pipeline_id, stage_id, name, phone, source)
select o.id, p.id, (select s.id from public.pipeline_stages s where s.pipeline_id = p.id order by s.position limit 1), 'Lead AC Oculto', '5548911112222', 'whatsapp'
  from public.organizations o join public.pipelines p on p.organization_id = o.id where o.id = (select id from public.organizations order by created_at limit 1)
 order by p.is_default desc limit 1;
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at) values
  ('00000000-0000-4000-bf48-000000000001', 'ac1', '5511955554444@c.us', false, 'Bruna', 'Vi o anúncio', now() - interval '40 minutes'),
  ('00000000-0000-4000-bf48-000000000001', 'ac2', '99887766@lid', false, 'Oculto', 'Oi', now() - interval '5 minutes');

-- Quem atende (sem administrar): não cria etiqueta, resposta rápida nem radar; põe etiqueta na conversa.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf47-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_wa_tag(null, 'Orçamento AC', 'verde')$$, '42501', null, 'quem só atende não cria etiqueta');
select throws_ok($$select public.save_quick_reply(null, 'precoac', 'Oi {nome}')$$, '42501', null, 'quem só atende não cria resposta rápida');
select throws_ok($$select public.set_inbox_settings(30)$$, '42501', null, 'quem só atende não muda o radar');
select throws_ok($$select public.delete_conversation((select id from public.wa_conversations where chat_id = '5511955554444@c.us'))$$, '42501', null, 'quem só atende não apaga conversa');

-- Quem administra (comercial).
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf47-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_wa_tag(null, 'Orçamento AC', 'verde')$$, 'comercial cria etiqueta');
select throws_ok($$select public.save_wa_tag(null, ' orçamento ac ', 'azul')$$, 'P0001', 'Já existe uma etiqueta com este nome.', 'nome de etiqueta não repete');
select lives_ok($$select public.save_quick_reply(null, '/PrecoAC', 'Oi {nome}, segue a tabela.')$$, 'cria resposta rápida (atalho limpo)');
select is((select shortcut from public.wa_quick_replies where body = 'Oi {nome}, segue a tabela.'), 'precoac', 'atalho sem barra e minúsculo');
select throws_ok($$select public.save_quick_reply(null, 'preço ac', 'x')$$, 'P0001', null, 'atalho com acento ou espaço não entra');
select throws_ok($$select public.set_inbox_settings(2)$$, 'P0001', 'O radar vai de 5 minutos a 24 horas.', 'radar abaixo de 5 min não entra');
select lives_ok($$select public.set_inbox_settings(30)$$, 'comercial muda o radar');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf47-000000000002","role":"authenticated"}';
select lives_ok($$select public.set_conversation_tags((select id from public.wa_conversations where chat_id = '5511955554444@c.us'),
  array[(select id from public.wa_tags where name = 'Orçamento AC')])$$, 'quem atende põe etiqueta na conversa');
select is((select count(*)::int from public.wa_conversation_tags t join public.wa_conversations c on c.id = t.conversation_id where c.chat_id = '5511955554444@c.us'), 1, 'etiqueta gravada');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf47-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.wa_tags where name = 'Orçamento AC') + (select count(*)::int from public.wa_quick_replies where shortcut = 'precoac'), 0, 'quem não atende não vê etiquetas nem respostas');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf47-000000000001","role":"authenticated"}';
select lives_ok($$select public.delete_conversation((select id from public.wa_conversations where chat_id = '5511955554444@c.us'))$$, 'comercial apaga a conversa');
reset role;
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, sent_at)
values ('00000000-0000-4000-bf48-000000000001', 'ac3', '5511955554444@c.us', false, 'Bruna', 'Ainda tenho dúvida', now());
select is((select deleted_at is null and waiting_reply from public.wa_conversations where chat_id = '5511955554444@c.us'), true, 'mensagem nova traz a conversa apagada de volta');

-- Servidor: telefone do id oculto liga o lead; anúncio cria o lead no começo do funil.
select public.wa_ad_referral('00000000-0000-4000-bf48-000000000001', '5511955554444@c.us', '120299', 'Rodizio em dobro', 'https://fb.me/ac', 'clid');
select is((select l.source || '/' || l.utm_medium || '/' || l.name || '/' || (s.position = (select min(position) from public.pipeline_stages where pipeline_id = l.pipeline_id))
  from public.wa_conversations c join public.leads l on l.id = c.lead_id join public.pipeline_stages s on s.id = l.stage_id where c.chat_id = '5511955554444@c.us'),
  'anuncio/clique_whatsapp/Bruna/true', 'anúncio cria o lead na primeira etapa com origem anúncio');
select is((select ad_headline from public.wa_conversations where chat_id = '5511955554444@c.us'), 'Rodizio em dobro', 'a conversa guarda o anúncio');
set local role authenticated;
select throws_ok($$select public.wa_ad_referral('00000000-0000-4000-bf48-000000000001', 'x', 'y', null, null, null)$$, '42501', null, 'só o servidor registra anúncio');
reset role;

select * from finish();
rollback;
