-- Etapa 02 · Fechamento → onboarding obrigatório → ativo + slots; visibilidade por cliente.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- Pessoas: comercial, coordenação (Jacque), editora marcada (Priscila), editor não marcado, social media (Madu).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comercial@extend.test', '{"full_name":"Comercial"}', now()),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jacque@extend.test', '{"full_name":"Jacque"}', now()),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priscila@extend.test', '{"full_name":"Priscila"}', now()),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro.editor@extend.test', '{"full_name":"Outro Editor"}', now()),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu@extend.test', '{"full_name":"Madu"}', now());
update public.profiles set is_active = true where email like '%@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-c000-000000000001', id from public.roles where key = 'comercial';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-c000-000000000002', id from public.roles where key = 'coord_conteudo';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-c000-000000000003', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-c000-000000000004', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-c000-000000000005', id from public.roles where key = 'social_media';
insert into public.profile_sectors (profile_id, sector_id) select '00000000-0000-4000-c000-000000000003', id from public.sectors where key = 'edicao';
insert into public.profile_sectors (profile_id, sector_id) select '00000000-0000-4000-c000-000000000004', id from public.sectors where key = 'edicao';
insert into public.profile_sectors (profile_id, sector_id) select '00000000-0000-4000-c000-000000000005', id from public.sectors where key = 'gerenciamento';
insert into public.profile_sectors (profile_id, sector_id) select '00000000-0000-4000-c000-000000000002', id from public.sectors where key = 'conteudo';

set local role authenticated;

-- 1. Comercial registra o fechamento.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-c000-000000000001","role":"authenticated"}';
create temp table t_ctx (client_id uuid) on commit drop;
grant all on t_ctx to authenticated;
insert into t_ctx select public.create_handoff(jsonb_build_object(
  'name', 'Teste Imobiliária',
  'segment', 'Imobiliário',
  'services', (select jsonb_agg(jsonb_build_object('service_id', id, 'monthly_qty', case key when 'pacote_videos' then 4 else 0 end))
                 from public.service_catalog where key in ('meta_ads', 'pacote_videos', 'gerenciamento')),
  'promises', jsonb_build_array(jsonb_build_object('description', 'Primeiro vídeo em 7 dias', 'due_at', (now() + interval '7 days')::text))
));
select isnt((select client_id from t_ctx), null, 'fechamento cria o cliente');
select is((select status from public.clients where id = (select client_id from t_ctx)), 'onboarding', 'cliente nasce em onboarding');
select is((select count(*)::int from public.onboarding_checklist_items where client_id = (select client_id from t_ctx)), 10, 'checklist padrão criado');
select is((select count(*)::int from public.handoff_promises where client_id = (select client_id from t_ctx)), 1, 'promessa registrada');

-- 2. Jacque é avisada (coordenação de conteúdo recebe o aviso por padrão).
reset role;
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-c000-000000000002' and kind = 'client_onboarding'),
  'coordenação recebe aviso de cliente novo');
set local role authenticated;

-- 3. Concluir com ficha incompleta → bloqueado.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-c000-000000000002","role":"authenticated"}';
select throws_like($$select public.complete_onboarding((select client_id from t_ctx))$$, 'Falta concluir:%', 'concluir com ficha incompleta é bloqueado');
select ok(array_length(public.onboarding_missing((select client_id from t_ctx)), 1) > 10, 'mostra o que falta');

-- 4. Preenche ficha, checklist e responsáveis.
update public.client_onboarding set answers = (
  select jsonb_object_agg(q ->> 'key', 'Resposta de teste')
  from public.onboarding_forms f, jsonb_array_elements(f.sections) s, jsonb_array_elements(s -> 'questions') q
  where f.id = client_onboarding.form_id
) where client_id = (select client_id from t_ctx);
update public.onboarding_checklist_items set done_at = now(), done_by = auth.uid() where client_id = (select client_id from t_ctx);
insert into public.client_members (client_id, sector_id, profile_id)
select (select client_id from t_ctx), id, '00000000-0000-4000-c000-000000000003' from public.sectors where key = 'edicao';
insert into public.client_members (client_id, sector_id, profile_id)
select (select client_id from t_ctx), id, '00000000-0000-4000-c000-000000000005' from public.sectors where key = 'gerenciamento';

-- 5. Conclui → ativo + 4 slots de vídeo com a Priscila.
select is(public.complete_onboarding((select client_id from t_ctx)), 4, 'concluir gera 4 demandas de vídeo');
select is((select status from public.clients where id = (select client_id from t_ctx)), 'ativo', 'cliente fica ativo');
select is((select count(*)::int from public.tasks where client_id = (select client_id from t_ctx) and assignee_id = '00000000-0000-4000-c000-000000000003'), 4,
  'demandas atribuídas à editora marcada');

-- 6. Visibilidade.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-c000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.clients where id = (select client_id from t_ctx)), 1, 'editora marcada vê o cliente');
select is((select count(*)::int from public.client_onboarding where client_id = (select client_id from t_ctx)), 0, 'editora não vê a ficha completa');
select ok((select count(*) from public.client_operational_summary((select client_id from t_ctx))) > 0, 'editora vê o resumo operacional');
select is((select count(*)::int from public.tasks where client_id = (select client_id from t_ctx)), 4, 'editora vê as próprias demandas');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-c000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.clients where id = (select client_id from t_ctx)), 0, 'editor não marcado não vê o cliente');
select is((select count(*)::int from public.tasks where client_id = (select client_id from t_ctx)), 0, 'editor não marcado não vê as demandas');

-- 7. Job do mês seguinte duas vezes → sem duplicar.
reset role;
select private.monthly_slots_tick((date_trunc('month', now()) + interval '1 month')::date);
select private.monthly_slots_tick((date_trunc('month', now()) + interval '1 month')::date);
select is((select count(*)::int from public.tasks where client_id = (select client_id from t_ctx)
           and slot_month = (date_trunc('month', now()) + interval '1 month')::date), 4, 'job idempotente: 4 no mês seguinte');

-- 8. 6 vídeos/mês vale a partir do mês seguinte; mês atual intacto.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-c000-000000000002","role":"authenticated"}';
select public.set_client_service((select client_id from t_ctx), (select id from public.service_catalog where key = 'pacote_videos'), 6);
reset role;
delete from public.tasks where client_id = (select client_id from t_ctx) and slot_month = (date_trunc('month', now()) + interval '1 month')::date;
select private.monthly_slots_tick((date_trunc('month', now()) + interval '1 month')::date);
select is((select count(*)::int from public.tasks where client_id = (select client_id from t_ctx)
           and slot_month = (date_trunc('month', now()) + interval '1 month')::date), 6, 'mês seguinte gera 6 após a mudança');

-- 10. Promessa perto do prazo gera alerta (avisa a coordenação).
update public.handoff_promises set due_at = now() + interval '2 hours' where client_id = (select client_id from t_ctx);
select private.promises_tick();
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-c000-000000000002' and kind = 'due_soon'),
  'promessa vencendo em 24 h avisa a coordenação');

select * from finish();
rollback;
