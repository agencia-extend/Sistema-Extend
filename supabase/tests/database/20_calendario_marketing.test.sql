-- Calendário de marketing: datas nacionais calculadas, datas por cliente com permissão no banco e
-- pedido de criativo criado sozinho N dias antes (na hora, se já estiver dentro do prazo).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- Gil (gestor de tráfego) e Sam (social media) estão na equipe do Cliente A; Edi (editor) não.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.m@extend.test', '{"full_name":"Gil M"}', now()),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.m@extend.test', '{"full_name":"Sam M"}', now()),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edi.m@extend.test', '{"full_name":"Edi M"}', now());
update public.profiles set is_active = true where email like '%.m@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.m@extend.test');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000001', id from public.roles where key = 'gestor_trafego';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000002', id from public.roles where key = 'social_media';
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-b000-000000000003', id from public.roles where key = 'editor_video';

insert into public.clients (id, organization_id, name, status)
select ('00000000-0000-4000-b010-00000000000' || n)::uuid, id, 'Cliente Calendário ' || n, 'ativo' from public.organizations cross join generate_series(1, 2) n;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b010-000000000001', id, '00000000-0000-4000-b000-000000000001' from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b010-000000000002', id, '00000000-0000-4000-b000-000000000001' from public.sectors where key = 'trafego';
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-b010-000000000001', id, '00000000-0000-4000-b000-000000000002' from public.sectors where key = 'gerenciamento';

-- Datas nacionais.
select is((select count(*)::int from public.national_marketing_dates('2027-01-01', '2027-12-31')), 18, '18 datas nacionais por ano');
select is((select on_date from public.national_marketing_dates('2027-11-01', '2027-11-30') where title = 'Black Friday'), '2027-11-26'::date, 'Black Friday 2027 calculada (sexta depois da 4ª quinta)');
select is((select on_date from public.national_marketing_dates('2027-05-01', '2027-05-31') where title = 'Dia das Mães'), '2027-05-09'::date, 'Dia das Mães 2027 (2º domingo de maio)');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- Sam (social media): cadastra data, mas não agenda pedido de criativo.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000002","role":"authenticated"}';
select lives_ok($$insert into ids values ('sam', public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Aniversário da loja', 'on_date', private.today_sp() + 30, 'kind', 'evento')))$$,
  'social media cadastra data do cliente');
select throws_ok($$select public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Promo', 'on_date', private.today_sp() + 30, 'kind', 'promocao',
  'brief', '{"format":"imagem","objective":"leads","angle":"Desconto","audience":"Clientes","cta":"Compre","priority":"media","quantity":1}'::jsonb))$$,
  '42501', null, 'sem poder pedir criativos, não agenda pedido');

-- Gil (gestor de tráfego).
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}';
select throws_ok($$select public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Promo', 'on_date', private.today_sp() + 30, 'kind', 'promocao',
  'brief', '{"format":"imagem","objective":"leads","angle":"","audience":"Clientes","cta":"Compre","priority":"media"}'::jsonb))$$,
  'P0001', null, 'briefing incompleto é recusado');
select throws_ok($$select public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Ontem', 'on_date', private.today_sp() - 1, 'kind', 'outro'))$$,
  'P0001', null, 'data no passado é recusada');
insert into ids values ('longe', public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Lançamento coleção', 'on_date', private.today_sp() + 40, 'kind', 'lancamento', 'lead_days', 15,
  'brief', '{"format":"imagem","objective":"leads","angle":"Coleção nova","audience":"Mulheres 25-45","cta":"Conheça","priority":"alta","quantity":2}'::jsonb)));
select is((select request_task_id from public.marketing_dates where id = (select v from ids where k = 'longe')), null, 'fora da antecedência, o pedido ainda não sai');
insert into ids values ('perto', public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000001', 'title', 'Black Friday da loja', 'on_date', private.today_sp() + 10, 'kind', 'promocao', 'lead_days', 15,
  'brief', '{"format":"video","objective":"vendas","angle":"Até 50% off","audience":"Clientes da loja","cta":"Aproveite","priority":"alta","quantity":1}'::jsonb)));
select ok((select request_task_id is not null from public.marketing_dates where id = (select v from ids where k = 'perto')), 'dentro da antecedência, o pedido sai na hora');
select is((select r.requested_by from public.creative_requests r join public.marketing_dates d on d.request_task_id = r.task_id where d.id = (select v from ids where k = 'perto')),
  '00000000-0000-4000-b000-000000000001'::uuid, 'o pedido fica em nome de quem cadastrou');
select is((select campaign from public.creative_requests r join public.marketing_dates d on d.request_task_id = r.task_id where d.id = (select v from ids where k = 'perto')),
  'Black Friday da loja', 'a campanha vem do nome da data');
-- Depois do pedido, o briefing não muda mais.
select public.save_marketing_date(jsonb_build_object('id', (select v from ids where k = 'perto'), 'title', 'Black Friday da loja', 'on_date', private.today_sp() + 11, 'kind', 'promocao',
  'brief', '{"format":"imagem","objective":"leads","angle":"Outro","audience":"Outro","cta":"Outro","priority":"baixa"}'::jsonb));
select is((select brief ->> 'angle' from public.marketing_dates where id = (select v from ids where k = 'perto')), 'Até 50% off', 'briefing de pedido já criado não é trocado');
-- Data do Cliente 2, que depois o Gil deixa de atender.
insert into ids values ('perde', public.save_marketing_date(jsonb_build_object('client_id', '00000000-0000-4000-b010-000000000002', 'title', 'Inauguração', 'on_date', private.today_sp() + 60, 'kind', 'evento',
  'brief', '{"format":"imagem","objective":"alcance","angle":"Nova loja","audience":"Bairro","cta":"Venha","priority":"media"}'::jsonb)));

-- Edi (fora da equipe) não vê nem altera.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-b000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.marketing_dates where client_id = '00000000-0000-4000-b010-000000000001'), 0, 'quem não é da equipe do cliente não vê as datas');
select throws_ok($$select public.delete_marketing_date((select v from ids where k = 'sam'))$$, '42501', null, 'nem exclui');

-- Job diário.
reset role;
update public.marketing_dates set on_date = private.today_sp() + 12 where id in ((select v from ids where k = 'longe'), (select v from ids where k = 'perde'));
delete from public.client_members where client_id = '00000000-0000-4000-b010-000000000002' and profile_id = '00000000-0000-4000-b000-000000000001';
select private.marketing_tick();
select ok((select request_task_id is not null from public.marketing_dates where id = (select v from ids where k = 'longe')), 'o job cria o pedido quando entra na antecedência');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b000-000000000001' and kind = 'marketing' and title like 'Pedido de criativo criado%'), 1, 'quem cadastrou é avisado');
select ok((select request_error is not null and request_task_id is null from public.marketing_dates where id = (select v from ids where k = 'perde')), 'sem acesso ao cliente, o pedido não sai e o erro fica registrado');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-b000-000000000001' and kind = 'marketing' and title like 'Pedido de criativo não criado%'), 1, 'e quem cadastrou é avisado do erro');
select private.marketing_tick();
select is((select count(*)::int from public.tasks t join public.marketing_dates d on d.request_task_id = t.id where d.client_id = '00000000-0000-4000-b010-000000000001'), 2, 'rodar de novo não duplica pedidos');

select * from finish();
rollback;
