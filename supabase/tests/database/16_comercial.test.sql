-- Comercial: quem vê e mexe em leads, sem duplicar, perda com motivo, importação com desfazer,
-- lembretes de próxima ação e de lead parado, e Ganho pelo fechamento comercial.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-af00-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comercial.crm@extend.test', '{"full_name":"Comercial CRM"}', now()),
  ('00000000-0000-4000-af00-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atend.crm@extend.test', '{"full_name":"Atendimento CRM"}', now()),
  ('00000000-0000-4000-af00-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social.crm@extend.test', '{"full_name":"Social CRM"}', now());
update public.profiles set is_active = true where email like '%.crm@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.crm@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000001', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000002', id from public.roles where key = 'atendimento';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-af00-000000000003', id from public.roles where key = 'social_media';

create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;
insert into t_ids select 'pipe', id from public.pipelines where is_default limit 1;
insert into t_ids select 'first', s.id from public.pipeline_stages s where s.pipeline_id = (select id from t_ids where k = 'pipe') order by position limit 1;
insert into t_ids select 'lost', s.id from public.pipeline_stages s where s.pipeline_id = (select id from t_ids where k = 'pipe') and kind = 'perdido';
insert into t_ids select 'qual', s.id from public.pipeline_stages s where s.pipeline_id = (select id from t_ids where k = 'pipe') and position = 2;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
with x as (
  insert into public.leads (pipeline_id, stage_id, name, phone, email, source, utm_campaign)
  values ((select id from t_ids where k = 'pipe'), (select id from t_ids where k = 'first'),
          'Padaria Sol', '(51) 99999-0001', 'Contato@PadariaSol.com.br', 'anuncio', 'black-friday')
  returning id)
insert into t_ids select 'lead', id from x;
select is((select phone || ' ' || email from public.leads where id = (select id from t_ids where k = 'lead')), '5551999990001 contato@padariasol.com.br', 'telefone e e-mail normalizados');
select is((select owner_id from public.leads where id = (select id from t_ids where k = 'lead')), '00000000-0000-4000-af00-000000000001'::uuid, 'responsável padrão é quem cadastrou');
select throws_ok($$insert into public.leads (pipeline_id, stage_id, name, phone) values ((select id from t_ids where k = 'pipe'), (select id from t_ids where k = 'first'), 'Outra', '51 99999 0001')$$, '23505', null, 'mesmo telefone não duplica');
select throws_ok($$insert into public.leads (pipeline_id, stage_id, name, email) values ((select id from t_ids where k = 'pipe'), (select id from t_ids where k = 'first'), 'Outra', 'CONTATO@padariasol.com.br')$$, '23505', null, 'mesmo e-mail não duplica');

-- Perda exige motivo e vai para o histórico.
select throws_ok($$select public.move_lead((select id from t_ids where k = 'lead'), (select id from t_ids where k = 'lost'), '')$$, 'P0001', 'Informe o motivo da perda.', 'perder sem motivo é recusado');
select public.move_lead((select id from t_ids where k = 'lead'), (select id from t_ids where k = 'qual'));
select is((select count(*)::int from public.lead_activities where lead_id = (select id from t_ids where k = 'lead') and kind = 'etapa'), 1, 'troca de etapa entra no histórico');

-- Atendimento ("só os meus") não vê o lead do comercial; social media nem acessa.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.leads where id = (select id from t_ids where k = 'lead')), 0, 'atendimento só vê os próprios leads');
select throws_ok($$select public.move_lead((select id from t_ids where k = 'lead'), (select id from t_ids where k = 'first'))$$, '42501', null, 'nem move o dos outros');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.leads), 0, 'social media não vê leads');
select throws_ok($$select public.import_leads('x.csv', (select id from t_ids where k = 'pipe'), '[{"name":"Fulano"}]')$$, '42501', null, 'nem importa');

-- Importação: pula duplicados do banco e da própria planilha; desfazer apaga só o que entrou.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
insert into t_ids select 'imp', (public.import_leads('leads.csv', (select id from t_ids where k = 'pipe'),
  '[{"name":"Loja A","phone":"51988880001"},{"name":"Loja B","email":"b@loja.com"},{"name":"Loja B de novo","email":"B@loja.com"},{"name":"Padaria repetida","phone":"5551999990001"},{"name":"x"}]') ->> 'import_id')::uuid;
select is((select row_count || '/' || duplicates from public.lead_imports where id = (select id from t_ids where k = 'imp')), '2/2', 'importa 2 e aponta 2 duplicados');
select is(public.undo_lead_import((select id from t_ids where k = 'imp')), 2, 'desfazer remove os importados');
select is((select count(*)::int from public.leads where id = (select id from t_ids where k = 'lead')), 1, 'e mantém o que já existia');

-- Lembretes: próxima ação vencida e lead parado avisam o responsável uma vez.
insert into public.lead_activities (lead_id, kind, body, due_at) values ((select id from t_ids where k = 'lead'), 'ligacao', 'Ligar para fechar reunião', now() - interval '5 minutes');
reset role;
update public.leads set stage_changed_at = now() - interval '10 days' where id = (select id from t_ids where k = 'lead');
select set_config('request.jwt.claims', '', true);
select private.crm_tick();
select private.crm_tick();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-af00-000000000001' and kind = 'crm'), 2, 'próxima ação e lead parado avisam uma vez cada');

-- Ganho: o fechamento a partir do lead cria o cliente em onboarding e liga ao lead.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-af00-000000000001","role":"authenticated"}';
insert into t_ids select 'client', public.create_handoff(jsonb_build_object('name', 'Padaria Sol', 'lead_id', (select id from t_ids where k = 'lead'),
  'services', jsonb_build_array(jsonb_build_object('service_id', (select id from public.service_catalog limit 1), 'monthly_qty', 1))));
reset role;
select is((select s.kind from public.leads l join public.pipeline_stages s on s.id = l.stage_id where l.id = (select id from t_ids where k = 'lead')), 'ganho', 'lead vai para Ganho');
select is((select won_client_id from public.leads where id = (select id from t_ids where k = 'lead')), (select id from t_ids where k = 'client'), 'e fica ligado ao cliente criado');

select * from finish();
rollback;
