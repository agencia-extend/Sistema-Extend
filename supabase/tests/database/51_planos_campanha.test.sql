-- Plano de campanha (RF-PLA-01/02): quem otimiza o cliente cria; quem é de fora não vê; aprovado exige quem aprovou;
-- liga sozinho à campanha com o mesmo nome (na criação e quando a sincronização traz a campanha); aprovado com a
-- campanha ativa vai para "no ar"; vínculo manual só com campanha do cliente; criativo só do mesmo cliente; avisa a equipe.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf91-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gt.pl@extend.test', '{"full_name":"Gt PL"}', now()),
  ('00000000-0000-4000-bf91-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ou.pl@extend.test', '{"full_name":"Ou PL"}', now()),
  ('00000000-0000-4000-bf91-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eq.pl@extend.test', '{"full_name":"Eq PL"}', now());
update public.profiles set is_active = true where email like '%.pl@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pl@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf91-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf91-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bf91-000000000003'::uuid, 'gestor_trafego')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf92-000000000001', id, 'Clínica PL', 'ativo' from public.organizations order by created_at limit 1;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf92-000000000002', id, 'Outro PL', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf92-000000000001', s.id, u from public.sectors s, unnest(array['00000000-0000-4000-bf91-000000000001', '00000000-0000-4000-bf91-000000000003']::uuid[]) u where s.key = 'trafego';
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bf93-000000000001', id, 'meta', 'act_pl1', 'Conta PL', '00000000-0000-4000-bf92-000000000001', true from public.organizations order by created_at limit 1;
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bf93-000000000002', id, 'meta', 'act_pl2', 'Conta Outro PL', '00000000-0000-4000-bf92-000000000002', true from public.organizations order by created_at limit 1;
insert into public.ad_campaigns (id, ad_account_id, external_id, name, effective_status) values
  ('00000000-0000-4000-bf94-000000000001', '00000000-0000-4000-bf93-000000000001', 'c1', 'CLI_LEADS_FRIO_2026-11', 'PAUSED'),
  ('00000000-0000-4000-bf94-000000000002', '00000000-0000-4000-bf93-000000000002', 'c2', 'OUTRO_CAMPANHA', 'ACTIVE');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf91-000000000002","role":"authenticated"}';
select throws_ok($$insert into public.campaign_plans (client_id, name, platform, objective, budget_type, budget_cents, audience, start_date)
  values ('00000000-0000-4000-bf92-000000000001', 'Plano de fora', 'meta', 'leads', 'diario', 3000, 'Mulheres 25-45', current_date)$$, '42501', null, 'gestor de fora do cliente não cria plano');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf91-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.campaign_plans (client_id, name, platform, objective, budget_type, budget_cents, audience, start_date)
  values ('00000000-0000-4000-bf92-000000000001', ' cli_leads_frio_2026-11 ', 'meta', 'leads', 'diario', 3000, 'Mulheres 25-45', current_date)$$,
  'gestor do cliente cria plano');
select is((select campaign_id::text || '/' || link_source from public.campaign_plans where name = 'cli_leads_frio_2026-11'),
  '00000000-0000-4000-bf94-000000000001/auto', 'liga sozinho à campanha com o mesmo nome (sem diferença de maiúsculas)');
select throws_ok($$insert into public.campaign_plans (client_id, name, platform, objective, budget_type, budget_cents, audience, start_date)
  values ('00000000-0000-4000-bf92-000000000001', 'Total sem fim', 'meta', 'leads', 'total', 3000, 'Mulheres 25-45', current_date)$$, '23514', null, 'orçamento total pede data de fim');
select throws_ok($$update public.campaign_plans set status = 'aprovado' where name = 'cli_leads_frio_2026-11'$$, '23514', null, 'aprovado pede quem aprovou');
select lives_ok($$update public.campaign_plans set status = 'aprovado', approved_by = 'Marcos (sócio)', approved_on = current_date where name = 'cli_leads_frio_2026-11'$$, 'registra a aprovação do cliente');
select is((select status from public.campaign_plans where name = 'cli_leads_frio_2026-11'), 'aprovado', 'campanha pausada: continua aprovado');
select throws_ok($$update public.campaign_plans set campaign_id = '00000000-0000-4000-bf94-000000000002' where name = 'cli_leads_frio_2026-11'$$,
  'P0001', 'Esta campanha não é de uma conta deste cliente nesta plataforma.', 'não liga à campanha de outro cliente');

select lives_ok($$insert into public.campaign_plans (client_id, name, platform, objective, budget_type, budget_cents, audience, start_date, end_date)
  values ('00000000-0000-4000-bf92-000000000001', 'CLI_MENSAGENS_QUENTE_2026-12', 'meta', 'mensagens', 'total', 90000, 'Quem falou no WhatsApp', current_date, current_date + 30)$$,
  'plano sem campanha ainda');
reset role;

-- A sincronização traz a campanha com o mesmo nome (ativa): o plano se liga e, aprovado, vai para "no ar".
set local request.jwt.claims = '{}';
update public.campaign_plans set status = 'aprovado', approved_by = 'Marcos', approved_on = current_date where name = 'CLI_MENSAGENS_QUENTE_2026-12';
insert into public.ad_campaigns (id, ad_account_id, external_id, name, effective_status)
values ('00000000-0000-4000-bf94-000000000003', '00000000-0000-4000-bf93-000000000001', 'c3', 'CLI_MENSAGENS_QUENTE_2026-12', 'ACTIVE');
select is((select status || '/' || link_source from public.campaign_plans where name = 'CLI_MENSAGENS_QUENTE_2026-12'), 'no_ar/auto', 'a sincronização liga e põe no ar');
update public.ad_campaigns set effective_status = 'ACTIVE' where id = '00000000-0000-4000-bf94-000000000001';
select is((select status from public.campaign_plans where name = 'cli_leads_frio_2026-11'), 'no_ar', 'campanha ligada ficou ativa: no ar');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bf91-000000000003' and title like 'Plano%Clínica PL'), 6,
  'a equipe de tráfego do cliente é avisada (criação, aprovação e no ar dos dois planos)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf91-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.campaign_plans where client_id = '00000000-0000-4000-bf92-000000000001'), 0, 'quem é de fora não vê os planos');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf91-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.campaign_plan_creatives (plan_id, library_id)
  select id, gen_random_uuid() from public.campaign_plans where name = 'cli_leads_frio_2026-11'$$,
  'P0001', 'Este criativo não é deste cliente.', 'criativo de outro cliente não entra no plano');
reset role;

select * from finish();
rollback;
