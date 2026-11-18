-- Mídia no Atendimento: a prévia da conversa diz o tipo do arquivo; o armazenamento é privado e ninguém lê direto
-- (o sistema entrega só a quem vê a conversa); a mensagem guarda o caminho, o tipo e o nome.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

delete from public.whatsapp_connections where organization_id = (select id from public.organizations order by created_at limit 1);
insert into public.whatsapp_connections (id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status)
select '00000000-0000-4000-bf29-000000000001', id, 'http://127.0.0.1:3032', 'x.y.z', 'teste', 'x.y.z', 'WORKING' from public.organizations order by created_at limit 1;

select is(private.wa_media_label('image/jpeg'), '[foto]', 'foto');
select is(private.wa_media_label('audio/ogg'), '[áudio]', 'áudio');
select is(private.wa_media_label('application/pdf'), '[documento]', 'documento');
select is(private.wa_media_label(null), '[mídia]', 'sem tipo (histórico)');

insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, author_name, body, kind, media_path, media_mime, media_name, sent_at)
values ('00000000-0000-4000-bf29-000000000001', 'md1', '5511900000009@c.us', false, 'Lia', null, 'media', 'org/conn/md1', 'image/jpeg', null, now());
select is((select last_preview from public.wa_conversations where chat_id = '5511900000009@c.us'), '[foto]', 'prévia da conversa: [foto]');
insert into public.whatsapp_messages (connection_id, wamid, chat_id, from_me, body, kind, media_path, media_mime, media_name, sent_at)
values ('00000000-0000-4000-bf29-000000000001', 'md2', '5511900000009@c.us', true, 'Segue a proposta', 'media', 'org/enviados/x', 'application/pdf', 'proposta.pdf', now() + interval '1 second');
select is((select last_preview from public.wa_conversations where chat_id = '5511900000009@c.us'), 'Segue a proposta', 'com legenda, a prévia é a legenda');

select is((select public from storage.buckets where id = 'whatsapp-midia'), false, 'armazenamento privado');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%whatsapp-midia%' or with_check like '%whatsapp-midia%')), 0,
  'nenhuma regra libera leitura ou envio direto: só pelo sistema');

select * from finish();
rollback;
