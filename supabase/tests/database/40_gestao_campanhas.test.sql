-- Gestão das campanhas da Meta pelo sistema: quem pode ajustar (tráfego do cliente, conexão com ads_management)
-- e o registro do ajuste no histórico do cliente.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf05-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lia.gc@extend.test', '{"full_name":"Lia GC"}', now()),
  ('00000000-0000-4000-bf05-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teo.gc@extend.test', '{"full_name":"Teo GC"}', now()),
  ('00000000-0000-4000-bf05-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.gc@extend.test', '{"full_name":"Sol GC"}', now());
update public.profiles set is_active = true where email like '%.gc@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.gc@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf05-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf05-000000000002'::uuid, 'gestor_trafego'),
  ('00000000-0000-4000-bf05-000000000003'::uuid, 'social_media')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select '00000000-0000-4000-bf15-000000000001', id, 'GC Academia', 'ativo' from public.organizations order by created_at limit 1;
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf15-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bf05-000000000001'::uuid), ('conteudo', '00000000-0000-4000-bf05-000000000003'::uuid)) x(k, u) on s.key = x.k;
-- Duas conexões pessoais: uma com ads_management, outra só leitura.
insert into public.integration_connections (id, organization_id, provider, purpose, owner_kind, profile_id, scopes, token_enc)
select x.id, o.id, 'meta', 'ads', 'user', x.p, x.scopes, 'x.y.z' from (select id from public.organizations order by created_at limit 1) o, (values
  ('00000000-0000-4000-bf25-000000000001'::uuid, '00000000-0000-4000-bf05-000000000001'::uuid, array['ads_read', 'ads_management']),
  ('00000000-0000-4000-bf25-000000000002'::uuid, '00000000-0000-4000-bf05-000000000002'::uuid, array['ads_read'])) x(id, p, scopes);
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled, connection_id)
select x.id, c.organization_id, 'meta', x.ext, x.name, c.id, true, x.conn from public.clients c, (values
  ('00000000-0000-4000-bf35-000000000001'::uuid, 'act_77001', 'GC Gestão', '00000000-0000-4000-bf25-000000000001'::uuid),
  ('00000000-0000-4000-bf35-000000000002'::uuid, 'act_77002', 'GC Leitura', '00000000-0000-4000-bf25-000000000002'::uuid)) x(id, ext, name, conn)
 where c.id = '00000000-0000-4000-bf15-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf05-000000000001","role":"authenticated"}';
select is((select array_agg(x)::text from public.ad_accounts_manageable(array['00000000-0000-4000-bf35-000000000001'::uuid, '00000000-0000-4000-bf35-000000000002'::uuid]) x),
  '{00000000-0000-4000-bf35-000000000001}', 'gestora do cliente ajusta só a conta cuja conexão tem ads_management');
select ok(public.record_ad_change('00000000-0000-4000-bf35-000000000001', 'pausa', 'Pausou a campanha "Leads" pelo sistema.', '') is not null, 'registra o ajuste');
select throws_ok($$select public.record_ad_change('00000000-0000-4000-bf35-000000000001', 'publico', 'x pelo sistema', '')$$, '22023', null, 'tipo de ajuste fora da lista é recusado');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf05-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.ad_accounts_manageable(array['00000000-0000-4000-bf35-000000000001'::uuid])), 0, 'gestor de fora do cliente não ajusta');
select throws_ok($$select public.record_ad_change('00000000-0000-4000-bf35-000000000001', 'pausa', 'Pausou pelo sistema.', '')$$, '42501', null, 'nem registra ajuste');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf05-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.ad_accounts_manageable(array['00000000-0000-4000-bf35-000000000001'::uuid])), 0, 'social media do cliente não ajusta campanhas');
reset role;
set local request.jwt.claims = '';

select is((select source || '/' || category || '/' || why || '/' || (created_by = '00000000-0000-4000-bf05-000000000001')::text from public.change_logs where client_id = '00000000-0000-4000-bf15-000000000001'),
  'sistema/pausa/Ajuste feito pelo sistema./true', 'no histórico: feito pelo sistema, com quem fez e o motivo padrão');

-- Conexão parada ou conta desligada: nada pode ser ajustado.
update public.integration_connections set status = 'expired' where id = '00000000-0000-4000-bf25-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf05-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.ad_accounts_manageable(array['00000000-0000-4000-bf35-000000000001'::uuid])), 0, 'conexão expirada não ajusta');
reset role;
update public.integration_connections set status = 'active' where id = '00000000-0000-4000-bf25-000000000001';
update public.ad_accounts set is_enabled = false where id = '00000000-0000-4000-bf35-000000000001';
set local role authenticated;
select is((select count(*)::int from public.ad_accounts_manageable(array['00000000-0000-4000-bf35-000000000001'::uuid])), 0, 'conta desligada não ajusta');
reset role;
set local request.jwt.claims = '';
select is((select count(*)::int from public.change_logs where client_id = '00000000-0000-4000-bf15-000000000001'), 1, 'só o ajuste permitido ficou no histórico');

select * from finish();
rollback;
