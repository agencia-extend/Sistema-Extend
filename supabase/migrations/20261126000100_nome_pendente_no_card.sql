-- Pessoas do Trello no card: enquanto a pessoa não tem conta, o card mostra o nome dela ("convite pendente") no lugar de
-- "Sem responsável". O nome some quando o convite é aceito ou o nome é ligado a alguém (aí o card passa a ser da pessoa).
alter table public.tasks add column pending_assignee text check (char_length(pending_assignee) <= 120);

update public.tasks t set pending_assignee = x.names
  from (select pt.task_id, left(string_agg(p.name, ' e ' order by p.name), 120) as names
          from public.team_placeholder_tasks pt join public.team_placeholders p on p.id = pt.placeholder_id
         where not pt.as_participant and p.profile_id is null and p.dismissed_at is null
         group by pt.task_id) x
 where t.id = x.task_id and t.assignee_id is null;

-- Quem ganha um responsável de verdade deixa de mostrar o nome pendente.
create or replace function private.clear_pending_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assignee_id is not null then new.pending_assignee := null; end if;
  return new;
end;
$$;
create trigger tasks_clear_pending_assignee before update of assignee_id on public.tasks
  for each row when (new.assignee_id is not null and new.pending_assignee is not null)
  execute function private.clear_pending_assignee();

-- Nome descartado em Configurações › Usuários: some dos cards; nome recuperado: volta.
create or replace function private.team_placeholder_pending_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t set pending_assignee = (
      select left(string_agg(p.name, ' e ' order by p.name), 120)
        from public.team_placeholder_tasks pt join public.team_placeholders p on p.id = pt.placeholder_id
       where pt.task_id = t.id and not pt.as_participant and p.profile_id is null and p.dismissed_at is null)
   where t.assignee_id is null and t.id in (select task_id from public.team_placeholder_tasks where placeholder_id = new.id);
  return new;
end;
$$;
create trigger team_placeholders_pending_sync after update of dismissed_at, profile_id on public.team_placeholders
  for each row execute function private.team_placeholder_pending_sync();

-- Equipe do cliente que veio do Trello e ainda não tem conta (ex.: o gestor de tráfego citado no Controle de Clientes).
-- Quem vê o cliente vê só o nome e o setor; o resto da pendência fica com quem gerencia usuários.
create or replace function public.client_pending_team(p_client uuid)
returns table (name text, sector_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, pc.sector_id
    from public.team_placeholder_clients pc
    join public.team_placeholders p on p.id = pc.placeholder_id
   where pc.client_id = p_client and p.profile_id is null and p.dismissed_at is null
     and p.organization_id = private.org_id() and private.can_client('clients.read', p_client)
   order by p.name;
$$;
revoke all on function public.client_pending_team(uuid) from public, anon;
grant execute on function public.client_pending_team(uuid) to authenticated;
