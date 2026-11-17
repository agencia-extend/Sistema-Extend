-- Aviso para o tráfego do cliente (quem tem ads.manage e está na equipe do cliente) e para uma pessoa a mais
-- (quem gerou o link). Sem ninguém na equipe, vai para quem conecta a agência. Usado pelo servidor.
create or replace function public.notify_client_ads_team(p_client uuid, p_extra uuid, p_title text, p_body text, p_href text, p_dedupe text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_users uuid[];
begin
  select organization_id into v_org from public.clients where id = p_client;
  if v_org is null then return 0; end if;
  select array_agg(distinct u) into v_users from (
    select m.profile_id as u from public.client_members m
      join public.profiles p on p.id = m.profile_id and p.is_active and p.portal_client_id is null
     where m.client_id = p_client and private.user_perm_scope(m.profile_id, 'ads.manage') is not null
    union
    select p.id from public.profiles p where p.id = p_extra and p.is_active and p.organization_id = v_org
  ) x;
  if v_users is null then
    select array_agg(p.id) into v_users from public.profiles p
     where p.organization_id = v_org and p.is_active and p.portal_client_id is null
       and private.user_perm_scope(p.id, 'ads.connect') is not null;
  end if;
  if v_users is null then return 0; end if;
  return public.notify_users(v_users, 'ad_alert', p_title, p_body, p_href, p_dedupe, null);
end;
$$;
revoke all on function public.notify_client_ads_team(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notify_client_ads_team(uuid, uuid, text, text, text, text) to service_role;
