-- RF-CON-01 (visão do setor de gerenciamento): por cliente com Gerenciamento vigente no mês, os posts
-- contratados, programados (com data no mês), postados (com link) e marcados para o cronograma ainda sem data.
-- Mostra quem cuida do cliente no setor de Gerenciamento e se é um cliente da pessoa logada.
-- Vê quem publica conteúdo no cliente (social media, coordenação) ou tem o Controle geral (sócios, leitura).

create or replace function public.schedule_overview(p_start date, p_end date)
returns table (
  client_id uuid, client_name text, client_code int,
  contracted int, scheduled int, posted int, undated int,
  social text[], mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with svc as (
    select cs.client_id, sum(coalesce(cs.monthly_qty, 0))::int as qty
      from public.client_services cs
      join public.service_catalog s on s.id = cs.service_id and s.key = 'gerenciamento'
     where coalesce(cs.starts_on, p_start) <= p_end and (cs.ends_on is null or cs.ends_on >= p_start)
     group by cs.client_id
  ),
  posts as (
    select t.client_id,
           count(*) filter (where tc.post_on between p_start and p_end)::int as scheduled,
           count(*) filter (where tc.post_on between p_start and p_end and tc.post_url is not null)::int as posted,
           count(*) filter (where tc.post_on is null and 'cronograma' = any (tc.destination))::int as undated
      from public.tasks t
      join public.task_content tc on tc.task_id = t.id
     where t.deleted_at is null and t.status <> 'cancelado'
       and t.client_id in (select client_id from svc)
     group by t.client_id
  ),
  team as (
    select m.client_id, array_agg(coalesce(nullif(p.full_name, ''), p.email) order by p.full_name) as names,
           bool_or(m.profile_id = auth.uid()) as mine
      from public.client_members m
      join public.sectors se on se.id = m.sector_id and se.key = 'gerenciamento'
      join public.profiles p on p.id = m.profile_id and p.is_active
     group by m.client_id
  )
  select c.id, c.name, c.code, svc.qty,
         coalesce(posts.scheduled, 0), coalesce(posts.posted, 0), coalesce(posts.undated, 0),
         coalesce(team.names, '{}'), coalesce(team.mine, false)
    from public.clients c
    join svc on svc.client_id = c.id
    left join posts on posts.client_id = c.id
    left join team on team.client_id = c.id
   where c.deleted_at is null and c.status = 'ativo'
     and c.organization_id = private.org_id()
     and p_end >= p_start and p_end - p_start <= 62
     and (private.can_client('content.publish', c.id) or private.can_client('dashboards.read', c.id))
   order by c.name;
$$;
revoke all on function public.schedule_overview(date, date) from public, anon;
grant execute on function public.schedule_overview(date, date) to authenticated;
