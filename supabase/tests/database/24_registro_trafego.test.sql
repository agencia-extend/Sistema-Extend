-- Registro de alterações do tráfego e aprovações de verba: quem lê, quem registra, autor e origem pelo banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- Ana (gestora) e Bia (gestora) estão no tráfego do Cliente A; Sol (social media) está no gerenciamento; Edu (gestor) não está no cliente.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b400-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.tr@extend.test', '{"full_name":"Ana TR"}', now()),
  ('00000000-0000-4000-b400-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bia.tr@extend.test', '{"full_name":"Bia TR"}', now()),
  ('00000000-0000-4000-b400-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.tr@extend.test', '{"full_name":"Sol TR"}', now()),
  ('00000000-0000-4000-b400-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edu.tr@extend.test', '{"full_name":"Edu TR"}', now());
update public.profiles set is_active = true where email like '%.tr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.tr@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b400-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b400-000000000002', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b400-000000000003', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b400-000000000004', id from public.roles where key = 'gestor_trafego';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-b410-000000000001', id, 'Cliente Tráfego', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b410-000000000001', s.id, p.id from public.sectors s
  join (values ('00000000-0000-4000-b400-000000000001'::uuid), ('00000000-0000-4000-b400-000000000002'::uuid)) p(id) on true where s.key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b410-000000000001', id, '00000000-0000-4000-b400-000000000003' from public.sectors where key = 'gerenciamento';
delete from public.notifications where user_id in (select id from public.profiles where email like '%.tr@extend.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b400-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.change_logs (client_id, platform, category, what, why)
  values ('00000000-0000-4000-b410-000000000001', 'meta', 'orcamento', 'Orçamento da campanha Leads de R$ 50 para R$ 80 por dia', 'CPL abaixo da meta há 5 dias; escalar')$$, 'gestora registra a alteração');
select throws_ok($$insert into public.change_logs (client_id, category, what, why, source)
  values ('00000000-0000-4000-b410-000000000001', 'outro', 'Tentativa', 'Forjar origem', 'sync')$$, '42501', null, 'a origem não vem do formulário');
select is((select created_by from public.change_logs where why like 'CPL abaixo%'), '00000000-0000-4000-b400-000000000001'::uuid, 'o autor é quem está logado');
select lives_ok($$insert into public.budget_approvals (client_id, amount_cents, platform, period_start, period_end, approved_by, approved_on, channel)
  values ('00000000-0000-4000-b410-000000000001', 150000, 'meta', '2026-12-01', '2026-12-31', 'Marcos (dono da loja)', '2026-11-15', 'whatsapp')$$, 'gestora registra a verba aprovada');
select throws_ok($$insert into public.budget_approvals (client_id, amount_cents, platform, period_start, period_end, approved_by, approved_on, channel)
  values ('00000000-0000-4000-b410-000000000001', 150000, 'meta', '2026-12-31', '2026-12-01', 'Marcos', '2026-11-15', 'whatsapp')$$, '23514', null, 'período invertido é recusado');

-- Bia (outra gestora do cliente) vê, mas não altera o registro da Ana; altera a verba.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b400-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.change_logs where client_id = '00000000-0000-4000-b410-000000000001'), 1, 'a equipe de tráfego do cliente vê o registro');
update public.change_logs set why = 'mudado pela Bia' where client_id = '00000000-0000-4000-b410-000000000001';
select is((select why from public.change_logs where client_id = '00000000-0000-4000-b410-000000000001'), 'CPL abaixo da meta há 5 dias; escalar', 'só quem registrou altera');
select lives_ok($$update public.budget_approvals set notes = 'Confirmado em reunião' where client_id = '00000000-0000-4000-b410-000000000001'$$, 'a verba pode ser completada por quem otimiza o cliente');

-- Social media do cliente e gestor de fora: nada.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b400-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.change_logs), 0, 'social media não vê o registro de tráfego');
select is((select count(*)::int from public.budget_approvals), 0, 'nem a verba');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b400-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.change_logs where client_id = '00000000-0000-4000-b410-000000000001'), 0, 'gestor de fora do cliente não vê');
select throws_ok($$insert into public.change_logs (client_id, category, what, why) values ('00000000-0000-4000-b410-000000000001', 'outro', 'Invasão', 'Teste de acesso')$$,
  '42501', null, 'gestor de fora do cliente não registra');

-- Ana apaga o próprio registro.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b400-000000000001","role":"authenticated"}';
select lives_ok($$delete from public.change_logs where client_id = '00000000-0000-4000-b410-000000000001'$$, 'quem registrou pode apagar');
reset role;
select is((select count(*)::int from public.change_logs where client_id = '00000000-0000-4000-b410-000000000001'), 0, 'apagado');

select is((select count(*)::int from public.client_timeline where client_id = '00000000-0000-4000-b410-000000000001' and kind = 'trafego'), 2, 'alteração e verba entram no histórico do cliente');
select is((select array_agg(body order by user_id) from public.notifications where title = 'Verba aprovada: Cliente Tráfego'),
  array['R$ 1.500,00 de 01/12 a 31/12, aprovada por Marcos (dono da loja).'], 'a outra gestora do cliente é avisada (quem registrou, não)');

select * from finish();
rollback;
