-- Agenda do envio automático e PDFs guardados (RF-REL-01/06): o gestor agenda só os clientes dele, com frequência,
-- dia e horário válidos; voltar ao modelo padrão não apaga a agenda; os PDFs aparecem a quem vê os anúncios do
-- cliente e ninguém grava pelo navegador.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bd47-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.ag@extend.test', '{"full_name":"Gil AG"}', now()),
  ('00000000-0000-4000-bd47-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edi.ag@extend.test', '{"full_name":"Edi AG"}', now());
update public.profiles set is_active = true where email like '%.ag@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.ag@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bd47-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bd47-000000000003'::uuid, 'editor_video')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select ('00000000-0000-4000-bd48-00000000000' || n)::uuid, id, 'AG Cliente ' || n, 'ativo' from public.organizations, generate_series(1, 2) n
 where id = (select id from public.organizations order by created_at limit 1);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bd48-000000000001', id, '00000000-0000-4000-bd47-000000000001' from public.sectors where key = 'trafego';
insert into public.ads_report_files (organization_id, client_id, period_start, period_end, frequency, storage_path, size_bytes)
select organization_id, id, '2026-11-09', '2026-11-15', 'semanal', organization_id || '/' || id || '/x.pdf', 2048 from public.clients where name like 'AG Cliente %';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd47-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_client_report_schedule('00000000-0000-4000-bd48-000000000001', 'mensal', 5, 14)$$, 'gestor agenda o cliente dele');
select throws_ok($$select public.set_client_report_schedule('00000000-0000-4000-bd48-000000000002', 'diario', 1, 9)$$, '42501', null, 'gestor não agenda cliente de outro');
select throws_ok($$select public.set_client_report_schedule('00000000-0000-4000-bd48-000000000001', 'anual', 1, 9)$$, 'P0001', 'Escolha a frequência do envio.', 'frequência desconhecida não entra');
select throws_ok($$select public.set_client_report_schedule('00000000-0000-4000-bd48-000000000001', 'mensal', 31, 9)$$, 'P0001', 'O dia do mês vai de 1 a 28.', 'dia 31 não entra (todo mês tem até 28)');
select throws_ok($$select public.set_client_report_schedule('00000000-0000-4000-bd48-000000000001', 'diario', 1, 3)$$, 'P0001', 'O horário vai das 6h às 22h.', 'madrugada não entra');
select lives_ok($$select public.set_client_report_template('00000000-0000-4000-bd48-000000000001', null)$$, 'volta ao modelo padrão');
select is((select frequency || ' ' || month_day || ' ' || send_hour from public.client_report_settings where client_id = '00000000-0000-4000-bd48-000000000001'),
  'mensal 5 14', 'voltar ao modelo padrão mantém a agenda');
select is((select count(*)::int from public.ads_report_files where client_id::text like '00000000-0000-4000-bd48-%'), 1, 'gestor vê só o PDF do cliente dele');
select throws_ok($$insert into public.ads_report_files (organization_id, client_id, period_start, period_end, frequency, storage_path, size_bytes)
  select organization_id, id, '2026-11-01', '2026-11-01', 'diario', 'a.pdf', 1 from public.clients where id = '00000000-0000-4000-bd48-000000000001'$$,
  '42501', null, 'ninguém grava PDF pelo navegador');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd47-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.ads_report_files where client_id::text like '00000000-0000-4000-bd48-%'), 0, 'quem não vê anúncios não vê os PDFs');
reset role;

select is((select public from storage.buckets where id = 'relatorios'), false, 'os PDFs ficam em armazenamento privado');
select ok((select schedule = '5 * * * *' from cron.job where jobname = 'extend-whatsapp-relatorios'), 'o envio automático confere de hora em hora');

select * from finish();
rollback;
