-- Onboarding do Miro: dias úteis, passos com orientação, marcos e avisos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- Dias úteis (feriados nacionais e Sexta-feira Santa).
select is(private.add_business_days('2026-11-19', 1), '2026-11-23'::date, '20/11 (Consciência Negra) não conta');
select is(private.add_business_days('2026-04-02', 1), '2026-04-06'::date, 'Sexta-feira Santa não conta');
select is(private.add_business_days('2026-11-14', 0), '2026-11-14'::date, 'zero dias = imediato');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-a900-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comercial.o@extend.test', '{"full_name":"Comercial O"}', now()),
  ('00000000-0000-4000-a900-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jacque.o@extend.test', '{"full_name":"Jacque O"}', now()),
  ('00000000-0000-4000-a900-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luiz.o@extend.test', '{"full_name":"Luiz O"}', now());
update public.profiles set is_active = true where email like '%.o@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.o@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a900-000000000001', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a900-000000000002', id from public.roles where key = 'coord_conteudo';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-a900-000000000003', id from public.roles where key = 'gerente_trafego';
-- Só eles nos setores, para o responsável padrão ser previsível.
delete from public.profile_sectors where sector_id in (select id from public.sectors where key in ('conteudo', 'trafego', 'comercial'));
insert into public.profile_sectors (profile_id, sector_id, is_lead) select '00000000-0000-4000-a900-000000000002', id, true from public.sectors where key = 'conteudo';
insert into public.profile_sectors (profile_id, sector_id, is_lead) select '00000000-0000-4000-a900-000000000003', id, true from public.sectors where key = 'trafego';
insert into public.profile_sectors (profile_id, sector_id, is_lead) select '00000000-0000-4000-a900-000000000001', id, true from public.sectors where key = 'comercial';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a900-000000000001","role":"authenticated"}';
create temp table t_c (client_id uuid) on commit drop;
grant all on t_c to authenticated;
insert into t_c select public.create_handoff(jsonb_build_object(
  'name', 'Clínica Onboarding Miro',
  'services', (select jsonb_agg(jsonb_build_object('service_id', id, 'monthly_qty', 0)) from public.service_catalog where key = 'meta_ads')
));

reset role;
select is((select count(*)::int from public.onboarding_checklist_items where client_id = (select client_id from t_c)), 7, '7 passos do Miro');
select is((select due_at at time zone 'America/Sao_Paulo' from public.onboarding_checklist_items where client_id = (select client_id from t_c) and title = 'Reunião de briefing agendada'),
  private.add_business_days(private.today_sp(), 2) + time '23:59', 'agendar o briefing: até 2 dias úteis, fim do dia');
select ok((select guidance from public.onboarding_checklist_items where client_id = (select client_id from t_c) and title like 'Obrigações do cliente%') like '%5 criativos por mês%',
  'passo das obrigações traz a orientação do Miro');
select is((select assignee_id from public.onboarding_checklist_items where client_id = (select client_id from t_c) and title like 'Tráfego:%'),
  '00000000-0000-4000-a900-000000000003'::uuid, 'passo de tráfego vai para o líder do tráfego');
select is((select string_agg(key, ',' order by position) from public.client_milestones where client_id = (select client_id from t_c)),
  'abertura,briefing,combinados,conclusao', 'quatro marcos criados');
select is((select due_on from public.client_milestones where client_id = (select client_id from t_c) and key = 'briefing'),
  private.add_business_days(private.today_sp(), 5), 'prazo do marco = último passo dele');
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-a900-000000000003' and title like 'Passo de onboarding para você: Tráfego:%'),
  'responsável recebe o aviso do passo');
select is((select count(*)::int from public.client_milestones where client_id = (select client_id from t_c) and done_at is not null), 0, 'nenhum marco concluído ainda');

-- Coordenação conclui os dois passos de abertura → marco concluído e na linha do tempo.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a900-000000000002","role":"authenticated"}';
update public.onboarding_checklist_items set done_at = now(), done_by = auth.uid() where client_id = (select client_id from t_c) and milestone = 'abertura';
reset role;
select isnt((select done_at from public.client_milestones where client_id = (select client_id from t_c) and key = 'abertura'), null, 'abertura concluída');
select ok(exists (select 1 from public.client_timeline where client_id = (select client_id from t_c) and title = 'Marco concluído: Abertura'), 'marco vai para a linha do tempo');

-- Desmarcar um passo reabre o marco.
update public.onboarding_checklist_items set done_at = null where client_id = (select client_id from t_c) and milestone = 'abertura' and position = 1;
select is((select done_at from public.client_milestones where client_id = (select client_id from t_c) and key = 'abertura'), null, 'desmarcar reabre o marco');

-- Passo e marco atrasados geram aviso (uma vez).
update public.onboarding_checklist_items set due_at = now() - interval '2 days' where client_id = (select client_id from t_c) and title like 'Tráfego:%';
select set_config('request.jwt.claims', '', true);
select private.onboarding_tick();
select private.onboarding_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-a900-000000000003' and title like 'Passo de onboarding atrasado:%'), 1, 'passo atrasado avisa o responsável uma vez');
update public.client_milestones set due_on = private.today_sp() - 1 where client_id = (select client_id from t_c) and key = 'briefing';
select private.onboarding_tick();
select ok(exists (select 1 from public.notifications where title like 'Marco atrasado: Briefing%'), 'marco atrasado avisa a coordenação');

select * from finish();
rollback;
