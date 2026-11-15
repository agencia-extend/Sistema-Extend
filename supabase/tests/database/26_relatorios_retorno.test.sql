-- Relatório semanal e retorno do cliente: quem registra, validações, aviso de retorno negativo,
-- ligação gerada por "sem retorno", painel e lembretes.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- Ana (gestora) no tráfego; Sol (social media) no gerenciamento; Edu (gestor) fora; Caio é o responsável pela comunicação (sem papel).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b600-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.rr@extend.test', '{"full_name":"Ana RR"}', now()),
  ('00000000-0000-4000-b600-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.rr@extend.test', '{"full_name":"Sol RR"}', now()),
  ('00000000-0000-4000-b600-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.rr@extend.test', '{"full_name":"Edu RR"}', now()),
  ('00000000-0000-4000-b600-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caio.rr@extend.test', '{"full_name":"Caio RR"}', now());
update public.profiles set is_active = true where email like '%.rr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.rr@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b600-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b600-000000000003', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b600-000000000004', id from public.roles where key = 'gestor_trafego';

insert into public.clients (id, organization_id, name, status, owner_id)
select '00000000-0000-4000-b610-000000000001', id, 'Cliente Relatório', 'ativo', '00000000-0000-4000-b600-000000000005' from public.organizations order by created_at limit 1;
insert into public.client_services (client_id, service_id, monthly_qty)
select '00000000-0000-4000-b610-000000000001', id, 0 from public.service_catalog where key in ('meta_ads', 'gerenciamento');
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b610-000000000001', id, '00000000-0000-4000-b600-000000000001' from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b610-000000000001', id, '00000000-0000-4000-b600-000000000003' from public.sectors where key = 'gerenciamento';
-- Cliente só com anúncios: não tem relatório de conteúdo.
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-b610-000000000002', id, 'Cliente Só Anúncios', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_services (client_id, service_id, monthly_qty)
select '00000000-0000-4000-b610-000000000002', id, 0 from public.service_catalog where key = 'meta_ads';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b610-000000000002', id, '00000000-0000-4000-b600-000000000003' from public.sectors where key = 'gerenciamento';
delete from public.notifications where user_id in (select id from public.profiles where email like '%.rr@extend.test');

-- Lembrete de relatório atrasado (a partir de quarta, em dia útil): Ana e Sol, cada um na sua área.
select private.client_reports_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b600-000000000001' and kind = 'client_report' and title like 'Relatório de tráfego da semana%'),
  case when private.is_business_day(private.today_sp()) and extract(isodow from private.today_sp()) >= 3 then 1 else 0 end, 'gestora recebe o aviso do relatório de tráfego atrasado');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b600-000000000003' and kind = 'client_report' and title like 'Relatório de tráfego%'), 0, 'social media não recebe o aviso do tráfego');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b600-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.report_routine() where client_id = '00000000-0000-4000-b610-000000000001' and area = 'trafego' and report_id is null and can_send), 1, 'o painel da gestora mostra o tráfego em aberto');
select is((select count(*)::int from public.report_routine() where area = 'conteudo' and client_id = '00000000-0000-4000-b610-000000000001'), 0, 'a gestora não vê a linha de conteúdo');
select throws_ok($$insert into public.client_reports (client_id, area, sent_on) values ('00000000-0000-4000-b610-000000000001', 'trafego', private.today_sp() + 1)$$,
  'P0001', 'A data de envio não pode ser no futuro.', 'envio no futuro é recusado');
select lives_ok($$insert into public.client_reports (client_id, area, sent_on, link) values ('00000000-0000-4000-b610-000000000001', 'trafego', private.today_sp() - 7, 'https://app.reportei.com/r/abc')$$,
  'gestora registra o relatório de tráfego da semana passada');
select is((select sent_by from public.client_reports where client_id = '00000000-0000-4000-b610-000000000001' and area = 'trafego'), '00000000-0000-4000-b600-000000000001'::uuid, 'quem enviou é quem está logado');
select throws_ok($$update public.client_reports set feedback = 'negativo' where area = 'trafego' and client_id = '00000000-0000-4000-b610-000000000001'$$,
  'P0001', 'Conte o que o cliente achou ruim.', 'negativo sem o motivo é recusado');
update public.client_reports set feedback = 'negativo', feedback_note = 'Poucos leads no WhatsApp' where area = 'trafego' and client_id = '00000000-0000-4000-b610-000000000001';
select is((select feedback_by from public.client_reports where area = 'trafego' and client_id = '00000000-0000-4000-b610-000000000001'), '00000000-0000-4000-b600-000000000001'::uuid, 'o banco grava quem registrou o retorno');

-- Sol (social media): conteúdo sim, tráfego não; cliente sem gerenciamento não tem relatório de conteúdo.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b600-000000000003","role":"authenticated"}';
select throws_ok($$insert into public.client_reports (client_id, area) values ('00000000-0000-4000-b610-000000000001', 'trafego')$$, '42501', null, 'social media não registra relatório de tráfego');
select throws_ok($$insert into public.client_reports (client_id, area) values ('00000000-0000-4000-b610-000000000002', 'conteudo')$$, 'P0001', null, 'cliente sem gerenciamento não tem relatório de conteúdo');
select lives_ok($$insert into public.client_reports (client_id, area, feedback) values ('00000000-0000-4000-b610-000000000001', 'conteudo', 'sem_retorno')$$, 'social media registra o de conteúdo, sem retorno');
reset role;
select is((select t.assignee_id from public.client_reports r join public.tasks t on t.id = r.call_task_id where r.area = 'conteudo' and r.client_id = '00000000-0000-4000-b610-000000000001'),
  '00000000-0000-4000-b600-000000000005'::uuid, 'sem retorno vira demanda de ligação para o responsável pela comunicação');

-- Edu (gestor de fora) não registra nem altera; Caio (responsável) registra o retorno.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b600-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.client_reports (client_id, area) values ('00000000-0000-4000-b610-000000000001', 'trafego')$$, '42501', null, 'gestor de fora não registra');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b600-000000000005","role":"authenticated"}';
update public.client_reports set feedback = 'positivo', feedback_note = 'Gostou dos números' where area = 'trafego' and client_id = '00000000-0000-4000-b610-000000000001';
reset role;
select is((select feedback from public.client_reports where area = 'trafego' and client_id = '00000000-0000-4000-b610-000000000001'), 'positivo', 'o responsável pela comunicação registra o retorno');

-- Negativo avisou o responsável (a autora não se avisa) e foi para o histórico.
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b600-000000000005' and title = 'Retorno negativo: Cliente Relatório'), 1, 'retorno negativo avisa o responsável pela comunicação');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b600-000000000001' and title = 'Retorno negativo: Cliente Relatório'), 0, 'quem registrou não é avisado');
select ok(exists (select 1 from public.client_timeline where client_id = '00000000-0000-4000-b610-000000000001' and title like 'Retorno ao relatório de tráfego da semana de %: negativo (Poucos leads no WhatsApp)'), 'o retorno entra no histórico');

select * from finish();
rollback;
