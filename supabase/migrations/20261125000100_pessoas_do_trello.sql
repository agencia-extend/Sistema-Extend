-- Pessoas do Trello a cadastrar. A importação do Trello (25/11/2026) trouxe cards com nomes de pessoas da equipe que
-- ainda não têm conta. Cada nome vira uma pendência em Configurações › Usuários. Quem gerencia usuários convida a
-- pessoa (o convite fica ligado ao nome) ou liga o nome a quem já tem acesso. Ao aceitar o convite ou ligar, os cards
-- daquele nome passam a ser da pessoa (responsável quando o card não tem ninguém, senão participante), ela entra na
-- equipe dos clientes no setor sugerido e recebe um aviso só. Mais de um nome pode ir para a mesma pessoa (ex.: "JULIANA" e
-- "Juliana Sousa").

create table public.team_placeholders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  aliases         text[] not null default '{}',
  note            text check (char_length(note) <= 300),
  sector_id       uuid references public.sectors (id) on delete set null,
  invitation_id   uuid references public.invitations (id) on delete set null,
  profile_id      uuid references public.profiles (id) on delete set null,
  linked_at       timestamptz,
  linked_by       uuid references public.profiles (id) on delete set null,
  dismissed_at    timestamptz,
  dismissed_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

-- Cards e clientes de cada nome. "participant" = o nome aparece no card, mas como quem grava/aparece (não executa).
create table public.team_placeholder_tasks (
  placeholder_id uuid not null references public.team_placeholders (id) on delete cascade,
  task_id        uuid not null references public.tasks (id) on delete cascade,
  as_participant boolean not null default false,
  primary key (placeholder_id, task_id)
);
create index team_placeholder_tasks_task_idx on public.team_placeholder_tasks (task_id);

create table public.team_placeholder_clients (
  placeholder_id uuid not null references public.team_placeholders (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  sector_id      uuid not null references public.sectors (id) on delete cascade,
  primary key (placeholder_id, client_id, sector_id)
);

alter table public.team_placeholders enable row level security;
alter table public.team_placeholder_tasks enable row level security;
alter table public.team_placeholder_clients enable row level security;
create policy team_placeholders_select on public.team_placeholders for select to authenticated
  using (organization_id = (select private.org_id()) and private.has_perm('users.manage'));
create policy team_placeholder_tasks_select on public.team_placeholder_tasks for select to authenticated
  using (exists (select 1 from public.team_placeholders p where p.id = placeholder_id and p.organization_id = (select private.org_id())) and private.has_perm('users.manage'));
create policy team_placeholder_clients_select on public.team_placeholder_clients for select to authenticated
  using (exists (select 1 from public.team_placeholders p where p.id = placeholder_id and p.organization_id = (select private.org_id())) and private.has_perm('users.manage'));
revoke insert, update, delete on public.team_placeholders, public.team_placeholder_tasks, public.team_placeholder_clients from authenticated, anon;

-- Passa os cards e clientes do nome para a pessoa. Roda como definer: chamada pelas funções abaixo, que conferem quem pode.
create or replace function private.apply_team_placeholder(p_placeholder uuid, p_profile uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.team_placeholders;
  v_open int;
  v_total int;
begin
  select * into v from public.team_placeholders where id = p_placeholder for update;
  if v.id is null then return 0; end if;

  perform set_config('extend.quiet', 'on', true);
  -- responsável onde o card não tem ninguém
  update public.tasks t set assignee_id = p_profile
    from public.team_placeholder_tasks pt
   where pt.placeholder_id = v.id and pt.task_id = t.id and not pt.as_participant
     and t.assignee_id is null and t.deleted_at is null;
  -- participante nos demais
  insert into public.task_participants (task_id, profile_id)
  select pt.task_id, p_profile from public.team_placeholder_tasks pt join public.tasks t on t.id = pt.task_id
   where pt.placeholder_id = v.id and t.deleted_at is null and t.assignee_id is distinct from p_profile
  on conflict do nothing;
  insert into public.client_members (client_id, sector_id, profile_id, created_by)
  select pc.client_id, pc.sector_id, p_profile, p_actor from public.team_placeholder_clients pc where pc.placeholder_id = v.id
  on conflict do nothing;
  perform set_config('extend.quiet', 'off', true);

  update public.team_placeholders set profile_id = p_profile, linked_at = now(), linked_by = p_actor, dismissed_at = null where id = v.id;

  select count(*) filter (where t.status not in ('concluido', 'cancelado')), count(*) into v_open, v_total
    from public.team_placeholder_tasks pt join public.tasks t on t.id = pt.task_id where pt.placeholder_id = v.id and t.deleted_at is null;
  if v_open > 0 then
    perform public.notify_users(array[p_profile], 'assigned',
      case when v_open = 1 then '1 demanda que estava no Trello agora é sua' else v_open || ' demandas que estavam no Trello agora são suas' end,
      'Elas estavam com o nome ' || v.name || ' no Trello.', '/tarefas', 'placeholder:' || v.id || ':' || p_profile, p_actor);
  end if;
  perform private.log_event('team_placeholder_linked', 'team_placeholders', v.id::text,
    jsonb_build_object('name', v.name, 'profile_id', p_profile, 'tasks', v_total), v.organization_id);
  return v_total;
end;
$$;

create or replace function public.link_team_placeholder(p_placeholder uuid, p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não gerencia usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team_placeholders where id = p_placeholder and organization_id = v_org and profile_id is null) then
    raise exception 'Este nome já foi ligado a alguém ou não existe.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and organization_id = v_org and is_active and portal_client_id is null) then
    raise exception 'Escolha uma pessoa ativa da equipe.' using errcode = 'P0001';
  end if;
  return private.apply_team_placeholder(p_placeholder, p_profile, auth.uid());
end;
$$;

-- Marca o convite enviado para o nome (o convite é criado pela tela de Usuários).
create or replace function public.set_team_placeholder_invitation(p_placeholder uuid, p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não gerencia usuários.' using errcode = '42501';
  end if;
  update public.team_placeholders p set invitation_id = i.id
    from public.invitations i
   where p.id = p_placeholder and p.organization_id = private.org_id() and p.profile_id is null
     and i.id = p_invitation and i.organization_id = p.organization_id and i.portal_client_id is null;
end;
$$;

create or replace function public.dismiss_team_placeholder(p_placeholder uuid, p_dismiss boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('users.manage') then
    raise exception 'Você não gerencia usuários.' using errcode = '42501';
  end if;
  update public.team_placeholders
     set dismissed_at = case when p_dismiss then now() end, dismissed_by = case when p_dismiss then auth.uid() end
   where id = p_placeholder and organization_id = private.org_id() and profile_id is null;
  if not found then raise exception 'Este nome já foi ligado a alguém ou não existe.' using errcode = 'P0002'; end if;
end;
$$;

-- Convite aceito: o nome ligado ao convite passa para a pessoa.
create or replace function private.team_placeholder_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'aceito' and old.status is distinct from 'aceito' and new.user_id is not null and new.portal_client_id is null then
    for r in select id from public.team_placeholders where invitation_id = new.id and profile_id is null loop
      perform private.apply_team_placeholder(r.id, new.user_id, new.invited_by);
    end loop;
  end if;
  return new;
end;
$$;
create trigger invitations_team_placeholder after update of status on public.invitations
  for each row execute function private.team_placeholder_on_accept();

revoke all on function private.apply_team_placeholder(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.team_placeholder_on_accept() from public, anon, authenticated;
revoke all on function public.link_team_placeholder(uuid, uuid) from public, anon;
revoke all on function public.set_team_placeholder_invitation(uuid, uuid) from public, anon;
revoke all on function public.dismiss_team_placeholder(uuid, boolean) from public, anon;
grant execute on function public.link_team_placeholder(uuid, uuid) to authenticated;
grant execute on function public.set_team_placeholder_invitation(uuid, uuid) to authenticated;
grant execute on function public.dismiss_team_placeholder(uuid, boolean) to authenticated;
