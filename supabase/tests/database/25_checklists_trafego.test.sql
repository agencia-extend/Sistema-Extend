-- Checklists do tráfego: validação dos itens, quem faz, quem vê, painel de pendências e lembretes.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- Ana (gestora) está no tráfego do cliente; Sol (social media) no gerenciamento; Edu (gestor) fora; Caio é o atendimento.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b500-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.ck@extend.test', '{"full_name":"Ana CK"}', now()),
  ('00000000-0000-4000-b500-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.ck@extend.test', '{"full_name":"Sol CK"}', now()),
  ('00000000-0000-4000-b500-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.ck@extend.test', '{"full_name":"Edu CK"}', now()),
  ('00000000-0000-4000-b500-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caio.ck@extend.test', '{"full_name":"Caio CK"}', now());
update public.profiles set is_active = true where email like '%.ck@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.ck@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b500-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b500-000000000003', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b500-000000000004', id from public.roles where key = 'gestor_trafego';

insert into public.clients (id, organization_id, name, status, owner_id)
select '00000000-0000-4000-b510-000000000001', id, 'Cliente Checklist', 'ativo', '00000000-0000-4000-b500-000000000005' from public.organizations order by created_at limit 1;
insert into public.client_services (client_id, service_id, monthly_qty)
select '00000000-0000-4000-b510-000000000001', id, 0 from public.service_catalog where key = 'meta_ads';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b510-000000000001', id, '00000000-0000-4000-b500-000000000001' from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b510-000000000001', id, '00000000-0000-4000-b500-000000000003' from public.sectors where key = 'gerenciamento';
delete from public.notifications where user_id in (select id from public.profiles where email like '%.ck@extend.test');

-- Lembrete: num dia útil, sem checklist, a gestora do cliente é avisada (e só ela).
select private.traffic_checks_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b500-000000000001' and kind = 'traffic_check' and title like 'Checklist diário%'),
  case when private.is_business_day(private.today_sp()) then 1 else 0 end, 'gestora do cliente recebe o lembrete do diário em dia útil');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b500-000000000003' and kind = 'traffic_check'), 0, 'social media não recebe');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b500-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.traffic_routine() where client_id = '00000000-0000-4000-b510-000000000001' and daily_id is null), 1, 'o cliente aparece no painel com o diário em aberto');
select throws_ok($$insert into public.traffic_checks (client_id, kind, period_on, items) values ('00000000-0000-4000-b510-000000000001', 'diario', private.today_sp(),
  '[{"key":"saldo","status":"ok"},{"key":"reprovados","status":"ok"},{"key":"gasto","status":"ok"}]')$$, 'P0001', 'Marque todos os itens do checklist.', 'item faltando é recusado');
select throws_ok($$insert into public.traffic_checks (client_id, kind, period_on, items) values ('00000000-0000-4000-b510-000000000001', 'diario', private.today_sp(),
  '[{"key":"saldo","status":"problema"},{"key":"reprovados","status":"ok"},{"key":"gasto","status":"ok"},{"key":"entrega","status":"ok"}]')$$, 'P0001', 'Conte qual é o problema em cada item marcado.', 'problema sem comentário é recusado');
select throws_ok($$insert into public.traffic_checks (client_id, kind, period_on, items) values ('00000000-0000-4000-b510-000000000001', 'diario', private.today_sp() + 1,
  '[{"key":"saldo","status":"ok"},{"key":"reprovados","status":"ok"},{"key":"gasto","status":"ok"},{"key":"entrega","status":"ok"}]')$$, 'P0001', null, 'dia futuro é recusado');
select lives_ok($$insert into public.traffic_checks (client_id, kind, period_on, items) values ('00000000-0000-4000-b510-000000000001', 'diario', private.today_sp(),
  '[{"key":"saldo","status":"problema","note":"Cartão recusado, saldo para 1 dia"},{"key":"reprovados","status":"ok"},{"key":"gasto","status":"na"},{"key":"entrega","status":"ok"}]')$$, 'gestora faz o diário');
select is((select problems from public.traffic_checks where client_id = '00000000-0000-4000-b510-000000000001' and kind = 'diario'), 1, 'o banco conta os problemas');
select is((select done_by from public.traffic_checks where client_id = '00000000-0000-4000-b510-000000000001' and kind = 'diario'), '00000000-0000-4000-b500-000000000001'::uuid, 'quem fez é quem está logado');
select throws_ok($$insert into public.traffic_checks (client_id, kind, period_on, items) values ('00000000-0000-4000-b510-000000000001', 'semanal', date_trunc('week', private.today_sp())::date + 1,
  '[{"key":"criativos","status":"ok"},{"key":"publicos","status":"ok"},{"key":"custos","status":"ok"}]')$$, 'P0001', 'O checklist semanal vale a partir da segunda-feira.', 'semana começa na segunda');
select lives_ok($$insert into public.traffic_checks (client_id, kind, period_on, items, decisions) values ('00000000-0000-4000-b510-000000000001', 'semanal', date_trunc('week', private.today_sp())::date,
  '[{"key":"criativos","status":"ok"},{"key":"publicos","status":"ok"},{"key":"custos","status":"ok"}]',
  '[{"level":"campanha","target":"[LEAD] Black Friday","decision":"escalar","why":"CPL 30% abaixo da meta"}]')$$, 'gestora faz o semanal com decisão');
select is((select weekly_decisions from public.traffic_routine() where client_id = '00000000-0000-4000-b510-000000000001'), 1, 'o painel mostra o semanal feito');

-- Sol (social media) e Edu (gestor de fora) não veem nem fazem.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b500-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.traffic_checks), 0, 'social media não vê os checklists');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b500-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.traffic_routine() where client_id = '00000000-0000-4000-b510-000000000001'), 0, 'gestor de fora não vê o cliente no painel');
update public.traffic_checks set notes = 'invasão' where client_id = '00000000-0000-4000-b510-000000000001';
reset role;
select is((select count(*)::int from public.traffic_checks where notes = 'invasão'), 0, 'gestor de fora não altera');

-- Saldo com problema avisa o atendimento e vai para o histórico.
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b500-000000000005' and title = 'Saldo ou cobrança: Cliente Checklist'), 1, 'o responsável pela comunicação é avisado do saldo');
select ok(exists (select 1 from public.client_timeline where client_id = '00000000-0000-4000-b510-000000000001' and title like 'Checklist diário de %: problema em saldo e cobrança'), 'o problema entra no histórico');

select * from finish();
rollback;
