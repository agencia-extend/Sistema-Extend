-- Propostas: modelo versionado, quem vê e edita, proposta com versões e totais, envio,
-- visualização pelo link, aceite movendo o lead para Ganho, vencimento diário.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendas.prop@extend.test', '{"full_name":"Vendas Prop"}', now()),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atend.prop@extend.test', '{"full_name":"Atend Prop"}', now()),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vend2.prop@extend.test', '{"full_name":"Vendedor sem modelos"}', now());
update public.profiles set is_active = true where email like '%.prop@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.prop@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000001', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000002', id from public.roles where key = 'atendimento';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000003', id from public.roles where key = 'comercial';
insert into public.user_permission_overrides (user_id, permission_key, effect) values ('00000000-0000-4000-b000-000000000003', 'proposals.templates.manage', 'deny');

create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;
insert into t_ids select 'pipe', id from public.pipelines where is_default limit 1;
insert into t_ids select 'first', s.id from public.pipeline_stages s where s.pipeline_id = (select id from t_ids where k = 'pipe') order by position limit 1;
insert into t_ids select 'tpl', id from public.proposal_templates where is_default limit 1;
insert into t_ids select 'svc', id from public.service_catalog where key = 'meta_ads' limit 1;

select ok((select count(*) from public.service_offers) >= 1 and (select count(*) from public.proposal_template_versions where template_id = (select id from t_ids where k = 'tpl')) >= 1,
  'catálogo comercial e modelo inicial com versão 1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';

-- Modelo: editar gera nova versão; quem não tem a permissão não edita.
create temp table t_v on commit drop as select version from public.proposal_templates where id = (select id from t_ids where k = 'tpl');
update public.proposal_templates set blocks = blocks || '[{"id":"extra","type":"texto","title":"Extra","body":"Oi {cliente}"}]'::jsonb where id = (select id from t_ids where k = 'tpl');
select is((select version from public.proposal_templates where id = (select id from t_ids where k = 'tpl')), (select version + 1 from t_v), 'editar o modelo gera nova versão');
select ok(exists (select 1 from public.proposal_template_versions where template_id = (select id from t_ids where k = 'tpl') and version = (select version + 1 from t_v)), 'e a versão fica no histórico');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000003","role":"authenticated"}';
update public.proposal_templates set name = 'Hack' where id = (select id from t_ids where k = 'tpl');
select isnt((select name from public.proposal_templates where id = (select id from t_ids where k = 'tpl')), 'Hack', 'sem proposals.templates.manage não edita modelo');
select ok((select count(*) from public.service_offers) >= 1, 'mas vê o catálogo com preços');

-- Proposta: criada para um lead, com totais calculados no banco e versão 1.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';
with x as (
  insert into public.leads (pipeline_id, stage_id, name, company, phone)
  values ((select id from t_ids where k = 'pipe'), (select id from t_ids where k = 'first'), 'Marcos Prop', 'Clínica Prop', '(51) 98888-7777')
  returning id)
insert into t_ids select 'lead', id from x;
insert into t_ids select 'prop', public.save_proposal(jsonb_build_object(
  'lead_id', (select id from t_ids where k = 'lead'), 'template_id', (select id from t_ids where k = 'tpl'),
  'client_name', 'Clínica Prop', 'contact_name', 'Marcos', 'contact_phone', '5551988887777',
  'items', jsonb_build_array(
    jsonb_build_object('serviceId', (select id from t_ids where k = 'svc'), 'name', 'Facebook/Instagram Ads', 'description', '', 'priceCents', 200000, 'discountCents', 20000, 'quantity', 1, 'recurrence', 'mensal'),
    jsonb_build_object('serviceId', null, 'name', 'Site', 'description', '', 'priceCents', 150000, 'discountCents', 0, 'quantity', 1, 'recurrence', 'unico')),
  'payment_terms', 'Pix mensal', 'valid_until', to_char((now() at time zone 'America/Sao_Paulo')::date + 10, 'YYYY-MM-DD')));
select is((select monthly_cents || '/' || one_time_cents || '/' || version || '/' || status from public.proposals where id = (select id from t_ids where k = 'prop')),
  '180000/150000/1/rascunho', 'totais com desconto, versão 1 em rascunho');
select is((select snapshot -> 'blocks' -> -1 ->> 'id' from public.proposal_versions where proposal_id = (select id from t_ids where k = 'prop') and version = 1), 'extra', 'a versão guarda os blocos do modelo atual');
select throws_ok($$select public.save_proposal(jsonb_build_object('id', (select id from t_ids where k = 'prop'), 'template_id', (select id from t_ids where k = 'tpl'), 'client_name', 'Clínica Prop',
  'items', '[{"name":"X","priceCents":100,"discountCents":500,"quantity":1,"recurrence":"mensal"}]'::jsonb, 'valid_until', '2099-01-01'))$$, 'P0001', null, 'desconto maior que o valor é recusado');

-- Atendimento não tem proposals.read: não vê.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.proposals where id = (select id from t_ids where k = 'prop')), 0, 'sem proposals.read não vê a proposta');
select throws_ok($$select public.send_proposal((select id from t_ids where k = 'prop'))$$, '42501', null, 'nem envia');

-- Enviar, abrir pelo link (notifica o vendedor) e aceitar (lead vai para Ganho).
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';
create temp table t_tok on commit drop as select public.send_proposal((select id from t_ids where k = 'prop')) as tok;
grant select on t_tok to service_role;
select is((select status || '/' || sent_version from public.proposals where id = (select id from t_ids where k = 'prop')), 'enviada/1', 'enviada mostra a versão 1');
reset role;
select set_config('request.jwt.claims', '', true);
select public.proposal_viewed((select tok from t_tok), '1.2.3.4', 'teste');
select is((select status || '/' || view_count from public.proposals where id = (select id from t_ids where k = 'prop')), 'visualizada/1', 'abrir o link marca visualizada e conta');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b000-000000000001' and kind = 'proposal'), 1, 'vendedor é avisado da abertura');
select is(public.accept_proposal((select tok from t_tok), 'Marcos da Silva', '1.2.3.4'), 'ok', 'aceite pelo link');
select is((select s.kind || '/' || l.value_cents from public.leads l join public.pipeline_stages s on s.id = l.stage_id where l.id = (select id from t_ids where k = 'lead')), 'ganho/180000', 'lead vai para Ganho com o valor mensal');

-- Vencimento: proposta enviada com validade passada vira expirada no job diário.
update public.proposals set status = 'enviada', accepted_at = null, valid_until = (now() at time zone 'America/Sao_Paulo')::date - 1 where id = (select id from t_ids where k = 'prop');
select private.proposals_tick();
select is((select status from public.proposals where id = (select id from t_ids where k = 'prop')), 'expirada', 'job diário marca expirada');
select is(public.accept_proposal((select tok from t_tok), 'Marcos da Silva', '1.2.3.4'), 'expirada', 'e o link não aceita mais');

select * from finish();
rollback;
