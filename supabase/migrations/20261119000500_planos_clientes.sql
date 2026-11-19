-- Clientes em que a pessoa pode montar plano de campanha (quem otimiza as contas do cliente).
create or replace function public.campaign_plan_clients()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name
    from public.clients c
   where c.organization_id = private.org_id() and c.deleted_at is null and c.status in ('ativo', 'onboarding')
     and private.can_client('optimization.manage', c.id)
   order by c.name;
$$;
revoke all on function public.campaign_plan_clients() from public, anon;
grant execute on function public.campaign_plan_clients() to authenticated;
