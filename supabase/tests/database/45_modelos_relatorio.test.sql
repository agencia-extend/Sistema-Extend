-- Modelos de relatório (RF-REL-02): a agência tem um padrão; só quem configura relatórios de todos os clientes cria,
-- edita e exclui modelos; o padrão não sai nem perde a marca sem outro no lugar; nome não repete; o gestor escolhe o
-- modelo só dos clientes dele; excluir um modelo devolve os clientes ao padrão.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bd45-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.mr@extend.test', '{"full_name":"Gil MR"}', now()),
  ('00000000-0000-4000-bd45-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gerson.mr@extend.test', '{"full_name":"Gerson MR"}', now()),
  ('00000000-0000-4000-bd45-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edi.mr@extend.test', '{"full_name":"Edi MR"}', now());
update public.profiles set is_active = true where email like '%.mr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.mr@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bd45-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bd45-000000000002'::uuid, 'gerente_trafego'),
  ('00000000-0000-4000-bd45-000000000003'::uuid, 'editor_video')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select ('00000000-0000-4000-bd46-00000000000' || n)::uuid, id, 'MR Cliente ' || n, 'ativo' from public.organizations, generate_series(1, 2) n
 where id = (select id from public.organizations order by created_at limit 1);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bd46-000000000001', id, '00000000-0000-4000-bd45-000000000001' from public.sectors where key = 'trafego';

select is((select count(*)::int from public.report_templates where is_default and organization_id = (select id from public.organizations order by created_at limit 1)), 1,
  'a agência já nasce com o modelo padrão');

-- Gestor (só os clientes dele): lê os modelos, não cria nem edita; escolhe o modelo só do cliente dele.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd45-000000000001","role":"authenticated"}';
select ok((select count(*) from public.report_templates) >= 1, 'gestor lê os modelos');
select throws_ok($$select public.save_report_template(null, 'Do gestor', 'Oi {cliente}, segue o relatório.', false)$$, '42501', null, 'gestor não cria modelo');
reset role;

-- Gerente (todos os clientes): cria, marca como padrão (o anterior perde a marca) e não repete nome.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd45-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_report_template(null, 'Semanal MR', E'*{cliente}*\nCPL {cpl}', false)$$, 'gerente cria modelo');
select throws_ok($$select public.save_report_template(null, '  semanal mr ', 'Outro texto {cliente}', false)$$, 'P0001', 'Já existe um modelo com este nome.', 'nome não repete (sem diferenciar maiúsculas)');
select lives_ok($$select public.save_report_template((select id from public.report_templates where name = 'Semanal MR'), 'Semanal MR', E'*{cliente}*\nCPL {cpl}', true)$$, 'marca como padrão');
select is((select string_agg(name, ',') from public.report_templates where is_default), 'Semanal MR', 'só um padrão: o anterior perdeu a marca');
select throws_ok($$select public.save_report_template((select id from public.report_templates where name = 'Semanal MR'), 'Semanal MR', 'Texto {cliente}', false)$$,
  'P0001', 'Para tirar o padrão, marque outro modelo como padrão.', 'o padrão não perde a marca sem outro no lugar');
select throws_ok($$select public.delete_report_template((select id from public.report_templates where name = 'Semanal MR'))$$,
  'P0001', 'O modelo padrão não pode ser excluído. Marque outro como padrão antes.', 'o padrão não é excluído');
-- Devolve o padrão ao modelo original.
select public.save_report_template((select id from public.report_templates where name = 'Relatório padrão'), 'Relatório padrão',
  (select body from public.report_templates where name = 'Relatório padrão'), true);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd45-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_client_report_template('00000000-0000-4000-bd46-000000000001', (select id from public.report_templates where name = 'Semanal MR'))$$,
  'gestor escolhe o modelo do cliente dele');
select throws_ok($$select public.set_client_report_template('00000000-0000-4000-bd46-000000000002', (select id from public.report_templates where name = 'Semanal MR'))$$,
  '42501', null, 'gestor não escolhe o modelo de cliente de outro');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd45-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.report_templates), 0, 'quem não vê anúncios nem configura relatórios não lê os modelos');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bd45-000000000002","role":"authenticated"}';
select lives_ok($$select public.delete_report_template((select id from public.report_templates where name = 'Semanal MR'))$$, 'gerente exclui modelo que não é o padrão');
reset role;
select is((select template_id from public.client_report_settings where client_id = '00000000-0000-4000-bd46-000000000001'), null,
  'o cliente que usava volta ao padrão');

select * from finish();
rollback;
