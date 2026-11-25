-- Prospectador (RF-CRM-07): só quem usa o prospectador vê buscas e locais; o limite do mês soma as páginas;
-- marcar locais exige importar leads; desfazer a importação libera os locais; a busca só é gravada pelo servidor.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bfa1-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co.pr@extend.test', '{"full_name":"Com PR"}', now()),
  ('00000000-0000-4000-bfa1-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'de.pr@extend.test', '{"full_name":"De PR"}', now());
update public.profiles set is_active = true where email like '%.pr@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pr@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bfa1-000000000001'::uuid, 'comercial'), ('00000000-0000-4000-bfa1-000000000002'::uuid, 'designer')) x(u, k) on r.key = x.k;

insert into public.prospect_searches (organization_id, query, city, uf, pages, result_count, created_by)
select id, 'imobiliária', 'Porto Alegre', 'RS', 2, 40, '00000000-0000-4000-bfa1-000000000001' from public.organizations order by created_at limit 1;
insert into public.prospect_searches (organization_id, query, city, uf, pages, result_count, created_by, created_at)
select id, 'clínica', 'Canoas', 'RS', 3, 60, '00000000-0000-4000-bfa1-000000000001', now() - interval '40 days' from public.organizations order by created_at limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.prospect_searches), 0, 'quem não usa o prospectador não vê as buscas');
select is(public.prospector_month_usage(), 0, 'nem o uso do mês');
select throws_ok($$select public.mark_prospect_places(null, '[{"id":"ChIJ-teste-1","name":"X"}]')$$, '42501', null, 'nem marca locais');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000001","role":"authenticated"}';
select ok(public.prospector_month_usage() >= 2, 'o uso do mês soma as páginas das buscas deste mês (a de 40 dias atrás não conta)');
select throws_ok($$insert into public.prospect_searches (query, city, uf) values ('x y', 'Cidade', 'RS')$$, '42501', null, 'a busca só é gravada pelo servidor');

select lives_ok($$
  select public.mark_prospect_places(
    ((public.import_leads('Prospectador teste', (select id from public.pipelines order by created_at limit 1),
      '[{"name":"Imobiliária Teste PR","phone":"5551988887777","source":"prospeccao"}]'::jsonb)) ->> 'import_id')::uuid,
    '[{"id":"ChIJ-teste-pr-1","name":"Imobiliária Teste PR"}]'::jsonb)
$$, 'importa o lead e marca o local');
select is((select count(*)::int from public.prospect_places where place_id = 'ChIJ-teste-pr-1'), 1, 'o local fica como já importado');

select public.undo_lead_import((select lead_import_id from public.prospect_places where place_id = 'ChIJ-teste-pr-1'));
select is((select count(*)::int from public.prospect_places where place_id = 'ChIJ-teste-pr-1'), 0, 'desfazer a importação libera o local');

select * from finish();
rollback;
