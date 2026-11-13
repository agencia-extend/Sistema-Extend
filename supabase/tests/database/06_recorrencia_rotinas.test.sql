-- Recorrência de demandas, rotinas por serviço e modelos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madu.r@extend.test', '{"full_name":"Madu R"}', now()),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joana.r@extend.test', '{"full_name":"Joana R"}', now());
update public.profiles set is_active = true where email like '%.r@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.r@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-f000-000000000001', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-f000-000000000002', id from public.roles where key = 'coord_conteudo';

insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-f100-000000000001', id, 'Cliente Rotina', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-f100-000000000001', s.id, x.p from public.sectors s
join (values ('gerenciamento', '00000000-0000-4000-f000-000000000001'::uuid), ('conteudo', '00000000-0000-4000-f000-000000000002'::uuid)) x(k, p) on x.k = s.key;

-- 1. Repetição: toda semana, concluir cria a próxima para a mesma pessoa, 7 dias depois.
insert into public.tasks (id, organization_id, client_id, type, title, assignee_id, due_at, repeat_unit, repeat_every, repeat_owner_id)
select '00000000-0000-4000-f200-000000000001', organization_id, id, 'geral', 'Relatório semanal', '00000000-0000-4000-f000-000000000001',
       now() + interval '1 day', 'semana', 1, '00000000-0000-4000-f000-000000000001'
  from public.clients where id = '00000000-0000-4000-f100-000000000001';
insert into public.task_checklist_items (task_id, title, position) values ('00000000-0000-4000-f200-000000000001', 'Enviar no grupo', 1);
update public.tasks set status = 'concluido', completed_at = now() where id = '00000000-0000-4000-f200-000000000001';

select isnt((select repeat_next_id from public.tasks where id = '00000000-0000-4000-f200-000000000001'), null, 'concluir cria a próxima da série');
select is((select (n.due_at - t.due_at) from public.tasks t join public.tasks n on n.id = t.repeat_next_id where t.id = '00000000-0000-4000-f200-000000000001'),
  interval '7 days', 'a próxima vence 7 dias depois');
select is((select n.assignee_id from public.tasks t join public.tasks n on n.id = t.repeat_next_id where t.id = '00000000-0000-4000-f200-000000000001'),
  '00000000-0000-4000-f000-000000000001'::uuid, 'e fica com a mesma pessoa');
select is((select n.status from public.tasks t join public.tasks n on n.id = t.repeat_next_id where t.id = '00000000-0000-4000-f200-000000000001'),
  'pendente', 'nasce aberta');
select is((select count(*)::int from public.task_checklist_items c join public.tasks t on t.repeat_next_id = c.task_id
            where t.id = '00000000-0000-4000-f200-000000000001' and c.done_at is null), 1, 'o checklist vem junto, desmarcado');
select ok(exists (select 1 from public.notifications n join public.tasks t on t.repeat_next_id::text = split_part(n.dedupe_key, ':', 2)
                   where t.id = '00000000-0000-4000-f200-000000000001' and n.user_id = '00000000-0000-4000-f000-000000000001' and n.kind = 'assigned'),
  'a pessoa é avisada da nova demanda');

-- Reabrir e concluir de novo não duplica a série.
update public.tasks set status = 'em_andamento' where id = '00000000-0000-4000-f200-000000000001';
update public.tasks set status = 'concluido' where id = '00000000-0000-4000-f200-000000000001';
select is((select count(*)::int from public.tasks where repeat_from_id = '00000000-0000-4000-f200-000000000001'), 1, 'concluir de novo não duplica');

-- 2. Passou do prazo sem concluir: a próxima nasce no futuro, a atrasada continua aberta.
insert into public.tasks (id, organization_id, type, title, assignee_id, due_at, repeat_unit, repeat_every)
select '00000000-0000-4000-f200-000000000002', organization_id, 'geral', 'Conferir saldo', '00000000-0000-4000-f000-000000000001',
       now() - interval '20 days', 'semana', 1
  from public.clients where id = '00000000-0000-4000-f100-000000000001';
select private.recurrence_tick();
select ok((select n.due_at > now() from public.tasks t join public.tasks n on n.id = t.repeat_next_id where t.id = '00000000-0000-4000-f200-000000000002'),
  'atrasada há semanas: a próxima pula para uma data futura');
select is((select status from public.tasks where id = '00000000-0000-4000-f200-000000000002'), 'pendente', 'a atrasada continua aberta');

-- 3. Rotinas do Gerenciamento: numa quinta, cria o cronograma de sexta (Joana) e, na sexta, as de segunda (Madu).
insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
select '00000000-0000-4000-f100-000000000001', id, 12, '2020-01-01' from public.service_catalog where key = 'gerenciamento';
select private.routines_tick('2026-11-12');  -- quinta-feira
select is((select count(*)::int from public.tasks where client_id = '00000000-0000-4000-f100-000000000001' and routine_id is not null), 1,
  'quinta: só a rotina de sexta já entra (lead de 3 dias)');
select is((select assignee_id from public.tasks where client_id = '00000000-0000-4000-f100-000000000001' and routine_on = '2026-11-13'),
  '00000000-0000-4000-f000-000000000002'::uuid, 'cronograma de sexta fica com a pessoa do Conteúdo');
select private.routines_tick('2026-11-13');  -- sexta: entram as duas de segunda (16/11)
select private.routines_tick('2026-11-13');
select is((select count(*)::int from public.tasks where client_id = '00000000-0000-4000-f100-000000000001' and routine_on = '2026-11-16'), 2,
  'sexta: legendas e posts de segunda, sem duplicar');
select is((select to_char(due_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') from public.tasks
            where client_id = '00000000-0000-4000-f100-000000000001' and title = 'Programar os posts da semana'), '16/11 18:00',
  'posts programados vencem segunda às 18h');

-- 4. Modelos: a equipe lê; só quem configura fluxos altera.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.task_templates (organization_id, name, category) select organization_id, 'X', 'outros' from public.profiles where id = auth.uid()$$,
  '42501', null, 'social media não cria modelo');

-- 5. Criar demanda pela tela: o insert devolve a linha (correção 20261113000200).
set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.tasks (organization_id, type, title, created_by)
  select organization_id, 'geral', 'Criada pela tela', auth.uid() from public.profiles where id = auth.uid() returning id$$,
  'quem cria a demanda consegue gravar e ler de volta');

select * from finish();
rollback;
