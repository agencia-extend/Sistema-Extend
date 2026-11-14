-- Briefing por seções: só contam e só aparecem as seções dos serviços contratados.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select is((select jsonb_array_length(sections) from public.onboarding_forms where is_current limit 1), 6, 'ficha atual com as seções A a E e Obrigações');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b100-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coord.bf@extend.test', '{"full_name":"Coord BF"}', now());
update public.profiles set is_active = true where email like '%.bf@extend.test';
delete from public.user_roles where user_id = '00000000-0000-4000-b100-000000000001';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b100-000000000001', id from public.roles where key = 'admin';

-- Cliente só de tráfego (Meta Ads), em onboarding.
insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-b110-000000000001', id, 'Cliente Briefing', 'onboarding' from public.organizations limit 1;
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-b110-000000000001', id, 0, private.today_sp() + 10 from public.service_catalog where key = 'meta_ads';
insert into public.client_onboarding (client_id, form_id, answers)
select '00000000-0000-4000-b110-000000000001', id, '{"o_que_faz":"Imobiliária","site_paginas":"Home e contato","dores":"Aluguel caro"}'::jsonb
  from public.onboarding_forms where is_current limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b100-000000000001","role":"authenticated"}';
select ok('Ficha: Objetivo principal' = any (public.onboarding_missing('00000000-0000-4000-b110-000000000001')), 'cobra a pergunta obrigatória de Tráfego (serviço que começa no futuro conta)');
select ok('Ficha: Como é o processo de vendas hoje' = any (public.onboarding_missing('00000000-0000-4000-b110-000000000001')), 'cobra a obrigatória da seção Geral');
select ok(not ('Ficha: O que a empresa faz hoje (serviços e produtos)' = any (public.onboarding_missing('00000000-0000-4000-b110-000000000001'))), 'o que foi respondido não é cobrado');
select is((select count(*)::int from public.client_operational_summary('00000000-0000-4000-b110-000000000001') where section like 'E.%'), 0, 'resposta da seção de Site não aparece para cliente sem site');
select is((select count(*)::int from public.client_operational_summary('00000000-0000-4000-b110-000000000001') where section = 'A. Geral'), 2, 'respostas da seção Geral aparecem no resumo');

-- Contratou site: a seção E passa a valer.
reset role;
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-b110-000000000001', id, 0, private.today_sp() from public.service_catalog where key = 'site';
set local role authenticated;
select is((select count(*)::int from public.client_operational_summary('00000000-0000-4000-b110-000000000001') where section like 'E.%'), 1, 'com site, a seção E entra no resumo');

select * from finish();
rollback;
