-- Performance por criativo (RF-BIB-03): ligação pelo código no nome e à mão, números somados, quem vê e quem liga,
-- e a sugestão de "fadigado" (RF-BIB-02).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-bf03-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gil.pc@extend.test', '{"full_name":"Gil PC"}', now()),
  ('00000000-0000-4000-bf03-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sol.pc@extend.test', '{"full_name":"Sol PC"}', now()),
  ('00000000-0000-4000-bf03-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rui.pc@extend.test', '{"full_name":"Rui PC"}', now());
update public.profiles set is_active = true where email like '%.pc@extend.test';
delete from public.user_roles where user_id in (select id from public.profiles where email like '%.pc@extend.test');
insert into public.user_roles (user_id, role_id) select u, r.id from public.roles r join (values
  ('00000000-0000-4000-bf03-000000000001'::uuid, 'gestor_trafego'), ('00000000-0000-4000-bf03-000000000002'::uuid, 'social_media'),
  ('00000000-0000-4000-bf03-000000000003'::uuid, 'gravacao')) x(u, k) on r.key = x.k;
insert into public.clients (id, organization_id, name, status)
select x.id, o.id, x.name, 'ativo' from (select id from public.organizations order by created_at limit 1) o,
  (values ('00000000-0000-4000-bf13-000000000001'::uuid, 'PC Clínica'), ('00000000-0000-4000-bf13-000000000002'::uuid, 'PC Outra')) x(id, name);
insert into public.client_members (client_id, sector_id, profile_id)
select '00000000-0000-4000-bf13-000000000001', s.id, x.u from public.sectors s join (values
  ('trafego', '00000000-0000-4000-bf03-000000000001'::uuid), ('conteudo', '00000000-0000-4000-bf03-000000000002'::uuid),
  ('gravacao', '00000000-0000-4000-bf03-000000000003'::uuid)) x(k, u) on s.key = x.k;

insert into public.tasks (id, organization_id, client_id, type, title)
select '00000000-0000-4000-bf43-000000000001', organization_id, id, 'criativo', 'Antes e depois' from public.clients where id = '00000000-0000-4000-bf13-000000000001';
insert into public.creative_library (id, task_id, client_id, campaign, format, angle)
values ('00000000-0000-4000-bf53-000000000001', '00000000-0000-4000-bf43-000000000001', '00000000-0000-4000-bf13-000000000001', 'Clareamento', 'video', 'Antes e depois');

insert into public.ad_accounts (id, organization_id, provider, external_id, name, client_id, is_enabled)
select x.id, c.organization_id, 'meta', x.ext, x.name, c.id, true from public.clients c join (values
  ('00000000-0000-4000-bf23-000000000001'::uuid, 'act_79001', 'PC Conta', '00000000-0000-4000-bf13-000000000001'::uuid),
  ('00000000-0000-4000-bf23-000000000002'::uuid, 'act_79002', 'PC Conta Outra', '00000000-0000-4000-bf13-000000000002'::uuid)) x(id, ext, name, cl) on c.id = x.cl;
-- Um anúncio com o código no nome (CR-<n>), outro sem, um com número parecido e um de outro cliente.
insert into public.ads (id, ad_account_id, external_id, name, effective_status, frequency_7d)
select x.id, x.acc, x.ext, replace(x.name, '#', l.ref_number::text), 'ACTIVE', x.freq from public.creative_library l, (values
  ('00000000-0000-4000-bf33-000000000001'::uuid, '00000000-0000-4000-bf23-000000000001'::uuid, 'adpc1', 'VIDEO_ANTES_CR-#_V1', 2.4),
  ('00000000-0000-4000-bf33-000000000002'::uuid, '00000000-0000-4000-bf23-000000000001'::uuid, 'adpc2', 'Antes e depois (cópia)', 1.2),
  ('00000000-0000-4000-bf33-000000000003'::uuid, '00000000-0000-4000-bf23-000000000001'::uuid, 'adpc3', 'VIDEO_CR-#0_V1', null),
  ('00000000-0000-4000-bf33-000000000004'::uuid, '00000000-0000-4000-bf23-000000000002'::uuid, 'adpc4', 'VIDEO_CR-#_V1', null)) x(id, acc, ext, name, freq)
 where l.id = '00000000-0000-4000-bf53-000000000001';
-- adpc1: 2 dias com gasto (R$ 50 cada) e 1 sem; adpc2: 1 dia (R$ 20).
insert into public.ad_insights_daily (ad_account_id, level, object_external_id, date, spend_cents, impressions, clicks, link_clicks, leads, video_views, thruplays) values
  ('00000000-0000-4000-bf23-000000000001', 'ad', 'adpc1', private.today_sp() - 3, 5000, 2000, 50, 40, 2, 600, 100),
  ('00000000-0000-4000-bf23-000000000001', 'ad', 'adpc1', private.today_sp() - 2, 5000, 2000, 50, 40, 2, 600, 100),
  ('00000000-0000-4000-bf23-000000000001', 'ad', 'adpc1', private.today_sp() - 1, 0, 0, 0, 0, 0, 0, 0),
  ('00000000-0000-4000-bf23-000000000001', 'ad', 'adpc2', private.today_sp() - 1, 2000, 1000, 10, 10, 1, 0, 0);

select is(public.sync_link_creatives('00000000-0000-4000-bf23-000000000001'), 1, 'a sincronização liga só o anúncio com o código exato no nome');
select is(public.sync_link_creatives('00000000-0000-4000-bf23-000000000002'), 0, 'código igual em conta de outro cliente não liga');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf03-000000000003","role":"authenticated"}';
select throws_ok($$select public.sync_link_creatives(null)$$, '42501', null, 'só a sincronização chama a ligação pelo código');
select is((select count(*)::int from public.creative_performance(array['00000000-0000-4000-bf53-000000000001'::uuid])), 0,
  'gravação vê o criativo mas não os números');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf03-000000000002","role":"authenticated"}';
select is((select spend_cents || '/' || days_live || '/' || ads from public.creative_performance(array['00000000-0000-4000-bf53-000000000001'::uuid])),
  '10000/2/1', 'social media do cliente vê os números: R$ 100, 2 dias no ar, 1 anúncio');
select is((select count(*)::int from public.creative_linked_ads('00000000-0000-4000-bf53-000000000001')), 1, 'e o anúncio ligado');
select throws_ok($$select public.link_creative_ad('00000000-0000-4000-bf53-000000000001', '00000000-0000-4000-bf33-000000000002')$$,
  '42501', null, 'social media não liga anúncios');
select is((select count(*)::int from public.creative_linkable_ads('00000000-0000-4000-bf53-000000000001')), 0, 'nem vê a lista para ligar');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf03-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.creative_linkable_ads('00000000-0000-4000-bf53-000000000001')), 2, 'gestor vê os outros anúncios do cliente');
select throws_ok($$select public.link_creative_ad('00000000-0000-4000-bf53-000000000001', '00000000-0000-4000-bf33-000000000004')$$,
  'P0001', 'Este anúncio não é de uma conta deste cliente.', 'anúncio de outro cliente não liga');
select lives_ok($$select public.link_creative_ad('00000000-0000-4000-bf53-000000000001', '00000000-0000-4000-bf33-000000000002')$$, 'gestor liga à mão');
select is((select spend_cents || '/' || leads || '/' || video_views || '/' || thruplays || '/' || days_live || '/' || frequency
             from public.creative_performance(array['00000000-0000-4000-bf53-000000000001'::uuid])),
  '12000/5/1200/200/3/2.40', 'soma os dois anúncios (dias no ar distintos, maior frequência)');

select lives_ok($$select public.unlink_creative_ad('00000000-0000-4000-bf53-000000000001', '00000000-0000-4000-bf33-000000000001')$$, 'gestor desliga o anúncio do código');
reset role;
set local request.jwt.claims = '';
select is(public.sync_link_creatives('00000000-0000-4000-bf23-000000000001'), 0, 'o código no nome não religa o que foi desligado à mão');

-- Fadiga em aberto no anúncio ligado: sugestão de "fadigado".
insert into public.ad_alerts (organization_id, client_id, kind, subject, title)
select organization_id, id, 'fadiga', '00000000-0000-4000-bf33-000000000002', 'Criativo cansado' from public.clients where id = '00000000-0000-4000-bf13-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-bf03-000000000002","role":"authenticated"}';
select is((select fatigued::text || '/' || spend_cents from public.creative_performance(array['00000000-0000-4000-bf53-000000000001'::uuid])),
  'true/2000', 'fadiga aberta no anúncio ligado marca o criativo; o desligado sai da soma');
select is((select string_agg(name, ',') from public.creative_linked_ads('00000000-0000-4000-bf53-000000000001')), 'Antes e depois (cópia)', 'o anúncio desligado sai da lista');
reset role;

select * from finish();
rollback;
