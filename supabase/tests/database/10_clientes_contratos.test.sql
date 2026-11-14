-- Central do cliente (parte A): código, responsável pela comunicação, contratos e avisos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ab00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comercial.k@extend.test', '{"full_name":"Comercial K"}', now()),
  ('00000000-0000-4000-ab00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joana.k@extend.test', '{"full_name":"Joana K"}', now()),
  ('00000000-0000-4000-ab00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor.k@extend.test', '{"full_name":"Editor K"}', now());
update public.profiles set is_active = true where email like '%.k@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.k@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ab00-000000000001', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ab00-000000000002', id from public.roles where key = 'admin';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ab00-000000000003', id from public.roles where key = 'editor_video';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ab00-000000000001","role":"authenticated"}';
create temp table t_k (client_id uuid) on commit drop;
grant all on t_k to authenticated;
insert into t_k select public.create_handoff(jsonb_build_object(
  'name', 'Clínica Contratos', 'contract_start', '2026-01-10', 'contract_months', 6, 'monthly_fee_cents', 350000,
  'services', (select jsonb_agg(jsonb_build_object('service_id', id, 'monthly_qty', 0)) from public.service_catalog where key = 'meta_ads')
));

reset role;
select ok((select code from public.clients where id = (select client_id from t_k)) = (select max(code) from public.clients), 'cliente novo recebe o próximo código');
select is((select count(*)::int from public.client_contracts where client_id = (select client_id from t_k)), 1, 'fechamento cria o primeiro contrato');
select is((select ends_on from public.client_contracts where client_id = (select client_id from t_k)), '2026-07-09'::date, 'contrato de 6 meses termina um dia antes');

-- Admin define o responsável, que é avisado.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ab00-000000000002","role":"authenticated"}';
update public.clients set owner_id = '00000000-0000-4000-ab00-000000000001', scope_text = '8 vídeos + 4 designs' where id = (select client_id from t_k);
select throws_ok($$update public.clients set code = null where id = (select client_id from t_k)$$, '23502', null, 'código é obrigatório');

-- Renovar: não pode sobrepor; depois do fim, entra e vira o atual.
select throws_ok($$insert into public.client_contracts (client_id, starts_on, ends_on) values ((select client_id from t_k), '2026-07-01', '2026-12-31')$$,
  'P0001', null, 'contrato sobreposto é recusado');
insert into public.client_contracts (client_id, starts_on, ends_on, scope_text, monthly_fee_cents) values ((select client_id from t_k), '2026-07-10', '2027-01-09', '10 vídeos + 4 designs', 420000);
select is((select contract_end from public.clients where id = (select client_id from t_k)), '2027-01-09'::date, 'cadastro passa a usar o contrato novo');
select is((select scope_text from public.clients where id = (select client_id from t_k)), '10 vídeos + 4 designs', 'escopo do contrato atual');
select is((select contract_start from public.clients where id = (select client_id from t_k)), '2026-01-10'::date, 'início do relacionamento não muda (ciclo do mês)');
select is((select monthly_fee_cents from public.client_contract_fees((select client_id from t_k)) order by monthly_fee_cents desc limit 1), 420000::bigint, 'admin vê o valor');

-- Editor (não vê valores) não lê o valor nem edita contrato.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ab00-000000000003","role":"authenticated"}';
reset role;
insert into public.client_members (client_id, sector_id, profile_id) select (select client_id from t_k), id, '00000000-0000-4000-ab00-000000000003' from public.sectors where key = 'edicao';
set local role authenticated;
select is((select count(*)::int from public.client_contracts where client_id = (select client_id from t_k)), 2, 'editor da equipe vê o histórico de contratos');
select is((select count(*)::int from public.client_contract_fees((select client_id from t_k))), 0, 'mas não vê o valor');
select throws_ok($$select monthly_fee_cents from public.client_contracts$$, '42501', null, 'nem lendo a coluna direto');
select throws_ok($$insert into public.client_contracts (client_id, starts_on) values ((select client_id from t_k), '2030-01-01')$$, '42501', null, 'nem cria contrato');

reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-ab00-000000000001' and title = 'Você é o responsável pela comunicação com Clínica Contratos'),
  'responsável é avisado');

-- Aviso de fim: contrato atual terminando em 30 dias avisa o responsável (uma vez).
update public.client_contracts set ends_on = private.today_sp() + 30 where client_id = (select client_id from t_k) and starts_on = '2026-07-10';
update public.client_contracts set starts_on = least(starts_on, private.today_sp()) where client_id = (select client_id from t_k) and starts_on = '2026-07-10';
select set_config('request.jwt.claims', '', true);
select private.contracts_tick();
select private.contracts_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ab00-000000000001' and title = 'Contrato de Clínica Contratos termina em 30 dias'), 1,
  'contrato terminando em 30 dias avisa o responsável uma vez');

select * from finish();
rollback;
