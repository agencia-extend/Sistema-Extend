-- Materiais e pastas de documentos: quem vê, quem adiciona e o que pode ser alterado.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ac00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu.m@extend.test', '{"full_name":"Madu M"}', now()),
  ('00000000-0000-4000-ac00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fora.m@extend.test', '{"full_name":"Fora M"}', now());
update public.profiles set is_active = true where email like '%.m@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.m@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ac00-000000000001', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ac00-000000000002', id from public.roles where key = 'social_media';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-ac10-000000000001', id, 'Cliente Materiais', 'ativo' from public.organizations limit 1;
insert into public.client_members (client_id, sector_id, profile_id) select '00000000-0000-4000-ac10-000000000001', id, '00000000-0000-4000-ac00-000000000001' from public.sectors where key = 'gerenciamento';
insert into public.client_files (id, client_id, storage_path, name, uploaded_by, folder)
values ('00000000-0000-4000-ac20-000000000001', '00000000-0000-4000-ac10-000000000001', 'clientes/00000000-0000-4000-ac10-000000000001/manual.pdf', 'manual.pdf', '00000000-0000-4000-ac00-000000000001', 'midias');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ac00-000000000001","role":"authenticated"}';
insert into public.client_materials (client_id, category, title, file_id) values ('00000000-0000-4000-ac10-000000000001', 'identidade', 'Manual de marca', '00000000-0000-4000-ac20-000000000001');
insert into public.client_materials (client_id, category, title, url) values ('00000000-0000-4000-ac10-000000000001', 'imagens', 'Banco de fotos', 'https://drive.google.com/drive/folders/x');
select is((select count(*)::int from public.client_materials), 2, 'quem é da equipe adiciona material (arquivo ou link)');
select throws_ok($$insert into public.client_materials (client_id, category, title) values ('00000000-0000-4000-ac10-000000000001', 'outros', 'Sem nada')$$, '23514', null, 'material precisa de arquivo ou link');
select throws_ok($$insert into public.client_materials (client_id, category, title, url) values ('00000000-0000-4000-ac10-000000000001', 'outros', 'Inseguro', 'http://x.com')$$, '23514', null, 'link precisa ser https');
update public.client_files set folder = 'trafego' where id = '00000000-0000-4000-ac20-000000000001';
select is((select folder from public.client_files where id = '00000000-0000-4000-ac20-000000000001'), 'trafego', 'quem enviou move o arquivo de pasta');
select throws_ok($$update public.client_files set storage_path = 'clientes/outro/x.pdf' where id = '00000000-0000-4000-ac20-000000000001'$$, '42501', null, 'mas não troca o caminho do arquivo');

-- Pessoa de fora do cliente não vê nem adiciona.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ac00-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.client_materials), 0, 'quem não é do cliente não vê os materiais');
select throws_ok($$insert into public.client_materials (client_id, category, title, url) values ('00000000-0000-4000-ac10-000000000001', 'outros', 'Intruso', 'https://x.com')$$, '42501', null, 'nem adiciona');

reset role;
select is((select count(*)::int from public.client_timeline where client_id = '00000000-0000-4000-ac10-000000000001' and kind = 'material'), 2, 'materiais entram na linha do tempo');
delete from public.client_files where id = '00000000-0000-4000-ac20-000000000001';
select is((select count(*)::int from public.client_materials where client_id = '00000000-0000-4000-ac10-000000000001'), 1, 'apagar o arquivo apaga o material ligado a ele');

select * from finish();
rollback;
