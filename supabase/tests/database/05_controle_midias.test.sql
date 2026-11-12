-- Etapa 03B · ciclo mensal do cliente, conteúdo, quadro do setor e retrabalho.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- Ciclo: início no dia 14 → 14 a 13 do mês seguinte; dia 31 respeita meses curtos.
select is((select number from private.cycle_of('2026-08-14', '2026-08-14')), 1, 'dia do início é o mês 1');
select is((select starts_on || ' ' || ends_on from private.cycle_of('2026-08-14', '2026-09-13')), '2026-08-14 2026-09-13', 'mês 1 vai de 14/08 a 13/09 (virada no dia 14)');
select is((select number || ' ' || starts_on from private.cycle_of('2026-08-14', '2026-09-14')), '2 2026-09-14', 'dia 14 do mês seguinte abre o mês 2');
select is((select starts_on || ' ' || ends_on from private.cycle_of('2026-01-31', '2026-02-28')), '2026-02-28 2026-03-30', 'início no dia 31: fevereiro vira no dia 28 e março volta ao 31');
select is((select count(*)::int from private.cycle_of('2026-08-14', '2026-08-13')), 0, 'antes do início do contrato não há mês');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jacke.m@extend.test', '{"full_name":"Jackeline M"}', now()),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juliana.m@extend.test', '{"full_name":"Juliana M"}', now()),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outra.m@extend.test', '{"full_name":"Outra M"}', now()),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caliton.m@extend.test', '{"full_name":"Caliton M"}', now());
update public.profiles set is_active = true where email like '%.m@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.m@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-e000-000000000001', id from public.roles where key = 'coord_conteudo';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-e000-000000000002', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-e000-000000000003', id from public.roles where key = 'editor_video';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-e000-000000000004', id from public.roles where key = 'gravacao';

-- Cliente ativo, contrato iniciado no dia 14 de dois meses atrás, com 3 vídeos por mês.
insert into public.clients (id, organization_id, name, status, contract_start)
select '00000000-0000-4000-e100-000000000001', id, 'Cliente Mídias', 'ativo',
       (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '2 months')::date + 13
  from public.organizations order by created_at limit 1;
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-e100-000000000001', id, 3, '2020-01-01' from public.service_catalog where key = 'pacote_videos';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-e100-000000000001', id, '00000000-0000-4000-e000-000000000001' from public.sectors where key = 'conteudo';

select is(private.generate_slots('00000000-0000-4000-e100-000000000001', (now() at time zone 'America/Sao_Paulo')::date), 3, 'gera os 3 conteúdos do mês do cliente');
select is(private.generate_slots('00000000-0000-4000-e100-000000000001', (now() at time zone 'America/Sao_Paulo')::date), 0, 'rodar de novo não duplica');
select is((select extract(day from starts_on)::int from public.client_months where client_id = '00000000-0000-4000-e100-000000000001'), 14, 'o mês do cliente começa no dia 14');
select is((select count(*)::int from public.tasks t join public.client_months m on m.client_id = t.client_id and m.starts_on = t.slot_month
            where t.client_id = '00000000-0000-4000-e100-000000000001'), 3, 'as demandas ficam ligadas ao mês do cliente');
select is((select count(*)::int from public.task_content tc join public.tasks t on t.id = tc.task_id
            where t.client_id = '00000000-0000-4000-e100-000000000001' and tc.format = 'video_curto'), 3, 'cada demanda nasce com a linha de conteúdo');

-- Cliente com editora marcada no setor de Edição: o conteúdo do mês seguinte já nasce com ela.
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-e100-000000000001', id, '00000000-0000-4000-e000-000000000003' from public.sectors where key = 'edicao';
select private.generate_slots('00000000-0000-4000-e100-000000000001', (now() at time zone 'America/Sao_Paulo')::date + 40);
select is((select count(*)::int from public.task_content tc join public.tasks t on t.id = tc.task_id
            where t.client_id = '00000000-0000-4000-e100-000000000001' and t.slot_month > (now() at time zone 'America/Sao_Paulo')::date
              and tc.editor_id = '00000000-0000-4000-e000-000000000003'), 3, 'conteúdo novo nasce com a editora marcada no cliente');
delete from public.tasks where client_id = '00000000-0000-4000-e100-000000000001' and slot_month > (now() at time zone 'America/Sao_Paulo')::date;
delete from public.client_members where client_id = '00000000-0000-4000-e100-000000000001' and profile_id = '00000000-0000-4000-e000-000000000003';

create temporary table _t on commit drop as
  select id from public.tasks where client_id = '00000000-0000-4000-e100-000000000001' and slot_index = 1;
grant select on _t to authenticated;

-- Juliana (editora) ainda não vê o conteúdo.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-e000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id = (select id from _t)), 0, 'editora não vê o conteúdo antes de ser escolhida');
select throws_ok($$select public.save_content((select id from _t), '{"caption":"x"}')$$, '42501', null, 'e não edita o conteúdo');

-- Jackeline planeja: define tema, quem grava e quem edita.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-e000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_content((select id from _t), '{"title":"Tour pelo decorado","format":"reels","objective":"Autoridade",
  "editor_id":"00000000-0000-4000-e000-000000000002","recorder_id":"00000000-0000-4000-e000-000000000004","recording_on":"2026-11-20"}')$$,
  'coordenação define tema, quem grava e quem edita');
select throws_ok($$select public.save_content((select id from _t), '{"final_url":"drive.google.com/x"}')$$, 'P0001', null, 'link sem http é recusado');
reset role;
select is((select title from public.tasks where id = (select id from _t)), 'Tour pelo decorado', 'o tema vira o título do card');
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-e000-000000000002' and kind = 'assigned' and href like '/setores/edicao%'),
  'a editora é avisada e o aviso leva ao quadro de Edição');
select ok(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-e000-000000000004' and kind = 'assigned'), 'quem grava é avisado');

-- Juliana agora vê e move; a outra editora continua sem ver.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-e000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id = (select id from _t)), 1, 'editora escolhida vê o card');
select lives_ok($$select public.move_task((select id from _t),
  (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id where w.task_type = 'video' and s.name = 'Edição'), null, null)$$,
  'e pega o card (Em andamento)');
reset role;
select is((select assignee_id from public.tasks where id = (select id from _t)), '00000000-0000-4000-e000-000000000002'::uuid, 'na etapa de edição o responsável é quem edita o conteúdo');

-- Em alteração: volta para a editora e conta retrabalho.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-e000-000000000001","role":"authenticated"}';
select public.move_task((select id from _t),
  (select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id where w.task_type = 'video' and s.is_rework), null, null);
reset role;
select is((select rework_count from public.task_content where task_id = (select id from _t)), 1, 'pedir alteração conta retrabalho');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-e000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.task_content where task_id = (select id from _t)), 0, 'outra editora não vê o conteúdo');

select * from finish();
rollback;
