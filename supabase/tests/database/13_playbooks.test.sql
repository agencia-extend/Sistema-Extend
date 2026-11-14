-- Playbooks: quem cria, quem aplica, demandas e marcos gerados, marco que fecha e aviso de atraso.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-ae00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coord.pb@extend.test', '{"full_name":"Coord PB"}', now()),
  ('00000000-0000-4000-ae00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'trafego.pb@extend.test', '{"full_name":"Tráfego PB"}', now()),
  ('00000000-0000-4000-ae00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social.pb@extend.test', '{"full_name":"Social PB"}', now());
update public.profiles set is_active = true where email like '%.pb@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pb@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000001', id from public.roles where key = 'coord_conteudo';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000002', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-ae00-000000000003', id from public.roles where key = 'social_media';

insert into public.clients (id, organization_id, name, status) select '00000000-0000-4000-ae10-000000000001', id, 'Cliente Playbook', 'ativo' from public.organizations limit 1;
insert into public.client_members (client_id, sector_id, profile_id, is_default) select '00000000-0000-4000-ae10-000000000001', id, '00000000-0000-4000-ae00-000000000002', true from public.sectors where key = 'trafego';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000001","role":"authenticated"}';
insert into public.playbooks (id, name, area) values ('00000000-0000-4000-ae20-000000000001', 'Lançamento de campanha', 'trafego');
insert into public.playbook_steps (playbook_id, position, title, offset_days, day_kind, sector_id, milestone)
select '00000000-0000-4000-ae20-000000000001', s.pos, s.title, s.days, 'uteis', (select id from public.sectors where key = 'trafego'), s.ms
from (values (1, 'Briefing da campanha', 0, 'Planejamento'), (2, 'Configurar pixel', 2, 'Planejamento'), (3, 'Subir campanha', 5, 'No ar')) s(pos, title, days, ms);
select is((select count(*)::int from public.playbook_steps where playbook_id = '00000000-0000-4000-ae20-000000000001'), 3, 'coordenação monta o playbook');

-- Social media não cria nem aplica.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000003","role":"authenticated"}';
select throws_ok($$insert into public.playbooks (name) values ('Meu processo')$$, '42501', null, 'social media não cria playbook');
select throws_ok($$select public.apply_playbook('00000000-0000-4000-ae20-000000000001', '00000000-0000-4000-ae10-000000000001', private.today_sp())$$, '42501', null, 'nem aplica');

-- Gestor de tráfego aplica.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000002","role":"authenticated"}';
create temp table t_run (id uuid) on commit drop;
grant all on t_run to authenticated;
insert into t_run select public.apply_playbook('00000000-0000-4000-ae20-000000000001', '00000000-0000-4000-ae10-000000000001', '2026-11-13');

reset role;
select is((select count(*)::int from public.tasks where playbook_run_id = (select id from t_run)), 3, 'cria uma demanda por etapa');
select is((select (due_at at time zone 'America/Sao_Paulo')::date from public.tasks where playbook_run_id = (select id from t_run) and title = 'Configurar pixel'), '2026-11-17'::date, 'prazo em dias úteis');
select is((select assignee_id from public.tasks where playbook_run_id = (select id from t_run) and title = 'Subir campanha'), '00000000-0000-4000-ae00-000000000002'::uuid, 'responsável é a pessoa do setor no cliente');
select is((select string_agg(title || '@' || due_on, ',' order by position) from public.run_milestones where run_id = (select id from t_run)), 'Planejamento@2026-11-17,No ar@2026-11-23', 'marcos com a data da última demanda (20/11 é feriado)');
select ok(exists (select 1 from public.client_timeline where client_id = '00000000-0000-4000-ae10-000000000001' and title like 'Playbook aplicado: Lançamento de campanha%'), 'vai para a linha do tempo');

-- Concluir as duas demandas do marco fecha o marco; reabrir uma reabre.
update public.tasks set status = 'concluido', completed_at = now() where run_milestone_id = (select id from public.run_milestones where run_id = (select id from t_run) and title = 'Planejamento');
select isnt((select done_at from public.run_milestones where run_id = (select id from t_run) and title = 'Planejamento'), null, 'marco fecha quando as demandas terminam');
update public.tasks set status = 'pendente', completed_at = null where playbook_run_id = (select id from t_run) and title = 'Configurar pixel';
select is((select done_at from public.run_milestones where run_id = (select id from t_run) and title = 'Planejamento'), null, 'reabrir uma demanda reabre o marco');

-- Marco atrasado avisa quem aplicou (uma vez).
update public.run_milestones set due_on = private.today_sp() - 1 where run_id = (select id from t_run) and title = 'No ar';
select set_config('request.jwt.claims', '', true);
select private.playbooks_tick();
select private.playbooks_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-ae00-000000000002' and title = 'Marco atrasado: No ar · Cliente Playbook'), 1, 'marco atrasado avisa uma vez');

-- Quem não vê o cliente não vê a execução.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-ae00-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.playbook_runs where client_id = '00000000-0000-4000-ae10-000000000001'), 0, 'quem não é do cliente não vê a execução');

select * from finish();
rollback;
