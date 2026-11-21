-- Qualidade dos leads (RF-T2-01): quem cuida das campanhas do cliente importa e avalia; quem é de fora não vê nem grava;
-- o mesmo lead não entra duas vezes; liga à campanha pelo nome (na hora e quando a sincronização traz a campanha);
-- o link público avalia só leads daquele cliente, avisa a equipe uma vez por dia e para de valer quando é trocado.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bfa1-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gt.ql@extend.test', '{"full_name":"Gt QL"}', now()),
  ('00000000-0000-4000-bfa1-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ou.ql@extend.test', '{"full_name":"Ou QL"}', now());
update public.profiles set is_active = true where email like '%.ql@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.ql@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bfa1-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bfa1-000000000002'::uuid, 'gestor_trafego')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select v.id, o.id, v.name, 'ativo' from public.organizations o,
  (values ('00000000-0000-4000-bfa2-000000000001'::uuid, 'Imobiliária QL'), ('00000000-0000-4000-bfa2-000000000002'::uuid, 'Outro QL')) v(id, name)
 where o.id = (select id from public.organizations order by created_at limit 1);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bfa2-000000000001', s.id, '00000000-0000-4000-bfa1-000000000001' from public.sectors s where s.key = 'trafego';
insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select '00000000-0000-4000-bfa3-000000000001', id, 'meta', 'act_ql1', 'Conta QL', '00000000-0000-4000-bfa2-000000000001', true from public.organizations order by created_at limit 1;
insert into public.ad_campaigns (id, ad_account_id, external_id, name, effective_status) values
  ('00000000-0000-4000-bfa4-000000000001', '00000000-0000-4000-bfa3-000000000001', 'cq1', 'IMOB_LEADS_FRIO', 'ACTIVE');
insert into public.client_leads (id, organization_id, client_id, external_key, name, lead_at)
select '00000000-0000-4000-bfa5-000000000099', id, '00000000-0000-4000-bfa2-000000000002', 'id:outro', 'Lead de outro cliente', now() from public.organizations order by created_at limit 1;

create temp table org_ql as select id as organization_id from public.organizations order by created_at limit 1;
grant select on org_ql to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000002","role":"authenticated"}';
select throws_ok(format($$insert into public.client_leads (organization_id, client_id, external_key, name, lead_at)
  values (%L, '00000000-0000-4000-bfa2-000000000001', 'id:1', 'Ana', now())$$, (select organization_id from org_ql)), '42501', null, 'gestor de fora do cliente não importa');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.client_leads (organization_id, client_id, external_key, name, phone, lead_at, campaign_name)
  select organization_id, id, 'id:1', 'Ana', '5551999990001', now() - interval '1 day', ' imob_leads_frio ' from public.clients where id = '00000000-0000-4000-bfa2-000000000001'$$,
  'gestor do cliente importa');
select is((select campaign_id::text from public.client_leads where external_key = 'id:1'), '00000000-0000-4000-bfa4-000000000001', 'liga à campanha pelo nome');
select throws_ok($$insert into public.client_leads (organization_id, client_id, external_key, name, lead_at)
  select organization_id, id, 'id:1', 'Ana de novo', now() from public.clients where id = '00000000-0000-4000-bfa2-000000000001'$$, '23505', null, 'o mesmo lead não entra duas vezes');
select lives_ok($$insert into public.client_leads (organization_id, client_id, external_key, name, lead_at, campaign_ext_id, campaign_name)
  select organization_id, id, 'id:2', 'Bruno', now(), 'cq2', 'IMOB_VENDA' from public.clients where id = '00000000-0000-4000-bfa2-000000000001'$$, 'lead de campanha que ainda não chegou');
select lives_ok($$update public.client_leads set quality = 'bom', quality_note = 'Visitou o imóvel' where external_key = 'id:1'$$, 'equipe avalia');
select is((select quality || '/' || (rated_by = '00000000-0000-4000-bfa1-000000000001')::text || '/' || (rated_at is not null)::text from public.client_leads where external_key = 'id:1'),
  'bom/true/true', 'avaliação guarda quem e quando');
select is((select count(*)::int from public.client_leads), 2, 'não vê leads de outro cliente');
select lives_ok($$select public.create_lead_review_link('00000000-0000-4000-bfa2-000000000001', repeat('a', 64))$$, 'gera o link de avaliação');
select throws_ok($$select public.rate_client_lead(repeat('a', 64), '00000000-0000-4000-bfa5-000000000099', 'bom', '', 'X')$$, '42501', null,
  'avaliar pelo link só passa pelo servidor');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_lead_review_link('00000000-0000-4000-bfa2-000000000001', repeat('b', 64))$$, '42501', null, 'gestor de fora não gera link');
reset role;

-- A sincronização traz a campanha: o lead que estava sem campanha se liga pelo id da Meta.
insert into public.ad_campaigns (id, ad_account_id, external_id, name, effective_status) values
  ('00000000-0000-4000-bfa4-000000000002', '00000000-0000-4000-bfa3-000000000001', 'cq2', 'IMOB_VENDA_V2', 'ACTIVE');
select is((select campaign_id::text from public.client_leads where external_key = 'id:2'), '00000000-0000-4000-bfa4-000000000002', 'liga quando a campanha chega');

-- Link público (servidor, com a chave secreta).
select is(public.rate_client_lead(repeat('a', 64), (select id from public.client_leads where external_key = 'id:2'), 'ruim', 'Só queria preço', 'Marcos'), 'ok', 'cliente avalia pelo link');
select is(public.rate_client_lead(repeat('a', 64), '00000000-0000-4000-bfa5-000000000099', 'bom', '', 'Marcos'), 'invalido', 'link não avalia lead de outro cliente');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-4000-bfa1-000000000001' and dedupe_key like 'leadrate:%'), 1,
  'avisa a equipe de tráfego do cliente (uma vez por dia)');
select public.rate_client_lead(repeat('a', 64), (select id from public.client_leads where external_key = 'id:1'), 'medio', '', 'Marcos');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bfa1-000000000001","role":"authenticated"}';
select public.create_lead_review_link('00000000-0000-4000-bfa2-000000000001', repeat('c', 64));
reset role;
select is(public.rate_client_lead(repeat('a', 64), (select id from public.client_leads where external_key = 'id:1'), 'bom', '', 'Marcos'), 'cancelado', 'link trocado para de valer');

select * from finish();
rollback;
