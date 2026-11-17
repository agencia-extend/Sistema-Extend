-- WhatsApp (WAHA): quem vê a conexão, os grupos, as mensagens e os envios; um grupo de alertas por conexão.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-be00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm.wa@extend.test', '{"full_name":"Adm WA"}', now()),
  ('00000000-0000-4000-be00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edi.wa@extend.test', '{"full_name":"Edi WA"}', now());
update public.profiles set is_active = true where email like '%.wa@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.wa@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-be00-000000000001'::uuid, 'admin'), ('00000000-0000-4000-be00-000000000002'::uuid, 'editor_video')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-be10-000000000001', id, 'WA Cliente', 'ativo' from public.organizations order by created_at limit 1;

delete from public.whatsapp_connections;
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, webhook_secret_enc, status)
select '00000000-0000-4000-be20-000000000001', id, 'https://waha.test', 'iv.tag.chave', 'iv.tag.segredo', 'WORKING' from public.organizations order by created_at limit 1;
insert into public.whatsapp_groups (id, connection_id, jid, name) values
  ('00000000-0000-4000-be30-000000000001', '00000000-0000-4000-be20-000000000001', '111@g.us', 'Equipe Extend'),
  ('00000000-0000-4000-be30-000000000002', '00000000-0000-4000-be20-000000000001', '222@g.us', 'Cliente WA');
insert into public.whatsapp_messages (connection_id, wamid, chat_id, body, sent_at) values ('00000000-0000-4000-be20-000000000001', 'm1', '222@g.us', 'Oi', now());

select throws_ok($$insert into public.whatsapp_groups (connection_id, jid) values ('00000000-0000-4000-be20-000000000001', '5548999990000@c.us')$$, '23514', null, 'só grupos (@g.us)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-be00-000000000001","role":"authenticated"}';
select throws_ok($$select api_key_enc from public.whatsapp_connections$$, '42501', null, 'ninguém lê a chave cifrada');
select is((select status from public.whatsapp_status()), 'WORKING', 'admin vê a situação da conexão');
select lives_ok($$select public.save_whatsapp_group('00000000-0000-4000-be30-000000000001', null, true, true)$$, 'admin marca o grupo de alertas');
select lives_ok($$select public.save_whatsapp_group('00000000-0000-4000-be30-000000000002', '00000000-0000-4000-be10-000000000001', true, false)$$, 'e troca para outro grupo');
select is((select array_agg(name order by name) from public.whatsapp_groups where is_alerts), array['Cliente WA'], 'fica um só grupo de alertas');
select is((select array_agg(name order by name) from public.whatsapp_groups where is_reports), array['Equipe Extend'], 'e o grupo de relatórios continua o primeiro');
select is((select client_id from public.whatsapp_groups where name = 'Cliente WA'), '00000000-0000-4000-be10-000000000001'::uuid, 'e o grupo fica ligado ao cliente');
select is((select count(*)::int from public.whatsapp_messages), 1, 'admin vê as mensagens');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-be00-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_whatsapp_group('00000000-0000-4000-be30-000000000001', null, true, false)$$, '42501', null, 'editor não configura grupos');
select is((select count(*)::int from public.whatsapp_messages), 0, 'nem vê as mensagens');
reset role;

select * from finish();
rollback;
