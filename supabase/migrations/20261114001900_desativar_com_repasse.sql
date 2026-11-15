-- RF-PER-10: ao desativar alguém, as demandas e responsabilidades abertas passam para outra pessoa.
-- O que conta como "em aberto":
--   demandas não concluídas/canceladas (responsável, quem edita, quem grava, dona da repetição);
--   equipes de cliente; responsável pela comunicação; padrão por etapa do cliente;
--   itens do checklist de onboarding não feitos; leads abertos; propostas não decididas;
--   datas do calendário de marketing com pedido de criativo ainda não criado.

create or replace function private.open_work(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tasks', (select count(*) from public.tasks t
               where t.deleted_at is null and t.completed_at is null and t.status not in ('concluido', 'cancelado')
                 and (t.assignee_id = p_user
                      or exists (select 1 from public.task_content c where c.task_id = t.id and p_user in (c.editor_id, c.recorder_id)))),
    'repeats', (select count(*) from public.tasks t where t.deleted_at is null and t.repeat_owner_id = p_user),
    'teams', (select count(distinct m.client_id) from public.client_members m where m.profile_id = p_user),
    'owned_clients', (select count(*) from public.clients c where c.owner_id = p_user and c.deleted_at is null),
    'step_defaults', (select count(*) from public.client_step_defaults d where d.profile_id = p_user),
    'checklist', (select count(*) from public.onboarding_checklist_items i where i.assignee_id = p_user and i.done_at is null),
    'leads', (select count(*) from public.leads l where l.owner_id = p_user and l.won_at is null and l.lost_at is null),
    'proposals', (select count(*) from public.proposals p where p.owner_id = p_user and p.status in ('rascunho', 'enviada', 'visualizada')),
    'marketing', (select count(*) from public.marketing_dates d where d.created_by = p_user and d.brief is not null and d.request_task_id is null)
  );
$$;

create or replace function public.admin_open_work(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para gerenciar usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and organization_id = private.org_id()) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  return private.open_work(p_user);
end;
$$;

create or replace function public.admin_deactivate_user(p_user uuid, p_successor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work jsonb;
  v_total int;
  v_from_name text;
  v_parts text[] := '{}';
  v_n int;
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para gerenciar usuários.' using errcode = '42501';
  end if;
  select full_name into v_from_name from public.profiles where id = p_user and organization_id = private.org_id();
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  v_work := private.open_work(p_user);
  select coalesce(sum(value::int), 0) into v_total from jsonb_each_text(v_work);

  if v_total > 0 then
    if p_successor is null then
      raise exception 'Escolha quem assume o trabalho em aberto.' using errcode = 'P0001', hint = 'successor_required';
    end if;
    if p_successor = p_user or not exists (
      select 1 from public.profiles p
       where p.id = p_successor and p.organization_id = private.org_id() and p.is_active and p.portal_client_id is null
    ) then
      raise exception 'Escolha alguém ativo da equipe para assumir.' using errcode = 'P0001', hint = 'successor_invalid';
    end if;
    if ((v_work ->> 'leads')::int > 0 or (v_work ->> 'proposals')::int > 0)
       and private.user_perm_scope(p_successor, 'crm.leads.manage') is null then
      raise exception 'Esta pessoa tem leads e propostas abertos. Escolha alguém com acesso ao Comercial.' using errcode = 'P0001', hint = 'successor_crm';
    end if;

    -- Demandas abertas.
    update public.tasks t set assignee_id = p_successor
     where t.assignee_id = p_user and t.deleted_at is null and t.completed_at is null and t.status not in ('concluido', 'cancelado');
    update public.task_content c set editor_id = p_successor
      from public.tasks t
     where t.id = c.task_id and c.editor_id = p_user and t.deleted_at is null and t.completed_at is null and t.status not in ('concluido', 'cancelado');
    update public.task_content c set recorder_id = p_successor
      from public.tasks t
     where t.id = c.task_id and c.recorder_id = p_user and t.deleted_at is null and t.completed_at is null and t.status not in ('concluido', 'cancelado');
    update public.tasks set repeat_owner_id = p_successor where repeat_owner_id = p_user and deleted_at is null;

    -- Clientes: equipe, responsável pela comunicação e padrão por etapa.
    insert into public.client_members (client_id, sector_id, profile_id, is_default)
    select m.client_id, m.sector_id, p_successor, m.is_default from public.client_members m where m.profile_id = p_user
    on conflict (client_id, sector_id, profile_id) do nothing;
    delete from public.client_members where profile_id = p_user;
    update public.clients set owner_id = p_successor where owner_id = p_user and deleted_at is null;
    update public.client_step_defaults set profile_id = p_successor where profile_id = p_user;
    update public.onboarding_checklist_items set assignee_id = p_successor where assignee_id = p_user and done_at is null;

    -- Comercial.
    update public.leads set owner_id = p_successor where owner_id = p_user and won_at is null and lost_at is null;
    update public.proposals set owner_id = p_successor where owner_id = p_user and status in ('rascunho', 'enviada', 'visualizada');

    -- Pedidos de criativo agendados saem em nome de quem assume.
    update public.marketing_dates set created_by = p_successor, request_error = null
     where created_by = p_user and brief is not null and request_task_id is null;

    -- Os gatilhos acima avisam item por item; troca por um resumo só.
    delete from public.notifications
     where user_id = p_successor and created_at = now() and kind in ('assigned', 'crm', 'client_onboarding');

    v_n := (v_work ->> 'tasks')::int;
    if v_n > 0 then v_parts := v_parts || (v_n || case when v_n = 1 then ' demanda aberta' else ' demandas abertas' end); end if;
    v_n := (v_work ->> 'teams')::int;
    if v_n > 0 then v_parts := v_parts || ('equipe de ' || v_n || case when v_n = 1 then ' cliente' else ' clientes' end); end if;
    v_n := (v_work ->> 'owned_clients')::int;
    if v_n > 0 then v_parts := v_parts || ('comunicação com ' || v_n || case when v_n = 1 then ' cliente' else ' clientes' end); end if;
    v_n := (v_work ->> 'checklist')::int;
    if v_n > 0 then v_parts := v_parts || (v_n || case when v_n = 1 then ' passo de onboarding' else ' passos de onboarding' end); end if;
    v_n := (v_work ->> 'leads')::int;
    if v_n > 0 then v_parts := v_parts || (v_n || case when v_n = 1 then ' lead' else ' leads' end); end if;
    v_n := (v_work ->> 'proposals')::int;
    if v_n > 0 then v_parts := v_parts || (v_n || case when v_n = 1 then ' proposta' else ' propostas' end); end if;
    v_n := (v_work ->> 'marketing')::int;
    if v_n > 0 then v_parts := v_parts || (v_n || case when v_n = 1 then ' pedido de criativo agendado' else ' pedidos de criativo agendados' end); end if;

    perform public.notify_users(array[p_successor], 'assigned', 'Você assumiu o trabalho de ' || coalesce(v_from_name, 'uma pessoa que saiu'),
      coalesce(nullif(array_to_string(v_parts, ', '), ''), 'Repetições e padrões de etapa') || '.',
      case when (v_work ->> 'tasks')::int > 0 and private.user_perm_scope(p_successor, 'tasks.read') is not null then '/tarefas'
           when (v_work ->> 'leads')::int + (v_work ->> 'proposals')::int > 0 then '/comercial'
           when (v_work ->> 'teams')::int + (v_work ->> 'owned_clients')::int > 0 then '/clientes'
           else '/inicio' end,
      'repasse:' || p_user || ':' || extract(epoch from now())::bigint, auth.uid());
  end if;

  perform public.admin_set_user_active(p_user, false);
  return v_work;
end;
$$;

revoke all on function private.open_work(uuid) from public;
revoke all on function public.admin_open_work(uuid) from public, anon;
revoke all on function public.admin_deactivate_user(uuid, uuid) from public, anon;
grant execute on function public.admin_open_work(uuid) to authenticated;
grant execute on function public.admin_deactivate_user(uuid, uuid) to authenticated;

-- Quem pode assumir: pessoas ativas da equipe (sem o usuário do cliente), com a marca de acesso ao Comercial.
create or replace function public.admin_successors(p_user uuid)
returns table (id uuid, full_name text, crm boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para gerenciar usuários.' using errcode = '42501';
  end if;
  return query
    select p.id, coalesce(nullif(p.full_name, ''), p.email), private.user_perm_scope(p.id, 'crm.leads.manage') is not null
      from public.profiles p
     where p.organization_id = private.org_id() and p.is_active and p.portal_client_id is null and p.id <> p_user
     order by 2;
end;
$$;

revoke all on function public.admin_successors(uuid) from public, anon;
grant execute on function public.admin_successors(uuid) to authenticated;
