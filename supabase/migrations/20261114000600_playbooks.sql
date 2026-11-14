-- Playbooks: processos padronizados (além do onboarding). Cada etapa tem prazo relativo
-- (dias úteis ou corridos), setor, tipo de demanda e marco. Aplicar a um cliente cria as
-- demandas e os marcos de uma vez; o marco fecha sozinho quando as demandas dele terminam.

insert into public.permissions (key, module, label, scoped, position) values
  ('playbooks.apply',  'Produção', 'Aplicar playbooks a clientes', false, 47),
  ('playbooks.manage', 'Produção', 'Criar e editar playbooks', false, 48)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, p.key, 'all'
  from public.roles r
  cross join (values ('playbooks.apply'), ('playbooks.manage')) p(key)
 where (r.key in ('admin', 'coord_conteudo', 'gerente_trafego'))
    or (p.key = 'playbooks.apply' and r.key in ('gestor_trafego', 'atendimento'))
on conflict do nothing;

create table public.playbooks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 120),
  area            text not null default 'geral' check (area in ('trafego', 'conteudo', 'design', 'video', 'site', 'comercial', 'atendimento', 'geral')),
  description     text check (char_length(description) <= 1000),
  is_active       boolean not null default true,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger playbooks_updated_at before update on public.playbooks for each row execute function private.set_updated_at();

create table public.playbook_steps (
  id          uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks (id) on delete cascade,
  position    int not null,
  title       text not null check (char_length(title) between 2 and 160),
  guidance    text check (char_length(guidance) <= 2000),
  offset_days int not null default 0 check (offset_days between 0 and 365),
  day_kind    text not null default 'uteis' check (day_kind in ('uteis', 'corridos')),
  sector_id   uuid references public.sectors (id) on delete set null,
  task_type   text not null default 'geral' check (task_type in ('video', 'design', 'conteudo', 'gravacao', 'site', 'geral')),
  milestone   text check (char_length(milestone) between 2 and 60)
);
create index playbook_steps_idx on public.playbook_steps (playbook_id, position);

create table public.playbook_runs (
  id            uuid primary key default gen_random_uuid(),
  playbook_id   uuid references public.playbooks (id) on delete set null,
  playbook_name text not null,
  client_id     uuid not null references public.clients (id) on delete cascade,
  start_on      date not null,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index playbook_runs_client_idx on public.playbook_runs (client_id, created_at desc);

create table public.run_milestones (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references public.playbook_runs (id) on delete cascade,
  title    text not null,
  position int not null,
  due_on   date,
  done_at  timestamptz
);
create index run_milestones_run_idx on public.run_milestones (run_id, position);

alter table public.tasks
  add column playbook_run_id uuid references public.playbook_runs (id) on delete set null,
  add column run_milestone_id uuid references public.run_milestones (id) on delete set null;
create index tasks_run_milestone_idx on public.tasks (run_milestone_id) where run_milestone_id is not null;

alter table public.playbooks enable row level security;
alter table public.playbook_steps enable row level security;
alter table public.playbook_runs enable row level security;
alter table public.run_milestones enable row level security;

create policy playbooks_select on public.playbooks for select to authenticated
  using (organization_id = (select private.org_id()) and ((select private.has_perm('playbooks.apply')) or (select private.has_perm('playbooks.manage'))));
create policy playbooks_write on public.playbooks for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('playbooks.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('playbooks.manage')));
create policy playbook_steps_select on public.playbook_steps for select to authenticated
  using (exists (select 1 from public.playbooks p where p.id = playbook_id));
create policy playbook_steps_write on public.playbook_steps for all to authenticated
  using ((select private.has_perm('playbooks.manage')) and exists (select 1 from public.playbooks p where p.id = playbook_id and p.organization_id = (select private.org_id())))
  with check ((select private.has_perm('playbooks.manage')) and exists (select 1 from public.playbooks p where p.id = playbook_id and p.organization_id = (select private.org_id())));
create policy playbook_runs_select on public.playbook_runs for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy run_milestones_select on public.run_milestones for select to authenticated
  using (exists (select 1 from public.playbook_runs r where r.id = run_id and private.can_client('clients.read', r.client_id)));

revoke all on public.playbooks, public.playbook_steps, public.playbook_runs, public.run_milestones from authenticated, anon;
grant select, insert, update, delete on public.playbooks, public.playbook_steps to authenticated;
grant select on public.playbook_runs, public.run_milestones to authenticated;

-- Aplica o playbook ao cliente: cria as demandas (responsável = pessoa do setor no cliente,
-- senão o líder do setor) e os marcos com a data da última demanda de cada um.
create or replace function public.apply_playbook(p_playbook uuid, p_client uuid, p_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pb public.playbooks;
  v_client public.clients;
  v_run uuid;
  v_s record;
  v_due date;
  v_assignee uuid;
  v_ms uuid;
  v_count int := 0;
begin
  if not private.has_perm('playbooks.apply') then
    raise exception 'Você não tem permissão para aplicar playbooks.' using errcode = '42501';
  end if;
  select * into v_pb from public.playbooks where id = p_playbook and organization_id = private.org_id() and is_active;
  if v_pb.id is null then raise exception 'Playbook não encontrado ou arquivado.' using errcode = 'P0002'; end if;
  select * into v_client from public.clients where id = p_client and deleted_at is null;
  if v_client.id is null or not private.can_client('clients.read', p_client) then
    raise exception 'Cliente não encontrado ou sem acesso.' using errcode = '42501';
  end if;
  if p_start is null or p_start < private.today_sp() - 30 then
    raise exception 'Escolha uma data de início a partir de 30 dias atrás.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.playbook_steps where playbook_id = p_playbook) then
    raise exception 'Este playbook ainda não tem etapas.' using errcode = 'P0001';
  end if;

  insert into public.playbook_runs (playbook_id, playbook_name, client_id, start_on) values (v_pb.id, v_pb.name, p_client, p_start) returning id into v_run;

  insert into public.run_milestones (run_id, title, position)
  select v_run, m.milestone, row_number() over (order by m.first_pos)
    from (select milestone, min(position) first_pos from public.playbook_steps where playbook_id = p_playbook and milestone is not null group by milestone) m;

  for v_s in select * from public.playbook_steps where playbook_id = p_playbook order by position loop
    v_due := case when v_s.day_kind = 'uteis' then private.add_business_days(p_start, v_s.offset_days) else p_start + v_s.offset_days end;
    v_assignee := null;
    if v_s.sector_id is not null then
      select m.profile_id into v_assignee
        from public.client_members m join public.profiles p on p.id = m.profile_id and p.is_active
       where m.client_id = p_client and m.sector_id = v_s.sector_id
       order by m.is_default desc, m.created_at limit 1;
      if v_assignee is null then
        select ps.profile_id into v_assignee
          from public.profile_sectors ps join public.profiles p on p.id = ps.profile_id and p.is_active
         where ps.sector_id = v_s.sector_id order by ps.is_lead desc, ps.created_at limit 1;
      end if;
    end if;
    select id into v_ms from public.run_milestones where run_id = v_run and title = v_s.milestone;
    insert into public.tasks (organization_id, client_id, sector_id, type, title, description, assignee_id, due_at, created_by, playbook_run_id, run_milestone_id)
    values (v_client.organization_id, p_client, v_s.sector_id, v_s.task_type, v_s.title, v_s.guidance, v_assignee,
            (v_due + time '18:00') at time zone 'America/Sao_Paulo', auth.uid(), v_run, v_ms);
    v_ms := null;
    v_count := v_count + 1;
  end loop;

  update public.run_milestones m
     set due_on = (select (max(t.due_at) at time zone 'America/Sao_Paulo')::date from public.tasks t where t.run_milestone_id = m.id)
   where m.run_id = v_run;

  perform private.timeline(p_client, 'playbook', 'Playbook aplicado: ' || v_pb.name || ' (' || v_count || ' demandas)', jsonb_build_object('run_id', v_run));
  return v_run;
end;
$$;
grant execute on function public.apply_playbook(uuid, uuid, date) to authenticated;

-- Demanda concluída ou reaberta: o marco do playbook acompanha.
create or replace function private.run_milestone_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ms uuid := coalesce(new.run_milestone_id, old.run_milestone_id);
  v_open int;
  v_was timestamptz;
  v_title text;
  v_client uuid;
begin
  if v_ms is null then return null; end if;
  select count(*) filter (where t.completed_at is null and t.status <> 'cancelado' and t.deleted_at is null) into v_open
    from public.tasks t where t.run_milestone_id = v_ms;
  select m.done_at, m.title, r.client_id into v_was, v_title, v_client from public.run_milestones m join public.playbook_runs r on r.id = m.run_id where m.id = v_ms;
  update public.run_milestones set done_at = case when v_open = 0 then coalesce(done_at, now()) else null end where id = v_ms;
  if v_was is null and v_open = 0 then
    perform private.timeline(v_client, 'milestone', 'Marco concluído: ' || v_title, jsonb_build_object('run_milestone_id', v_ms));
  end if;
  return null;
end;
$$;
create trigger tasks_run_milestone_sync after update of completed_at, status, deleted_at on public.tasks
  for each row when (new.run_milestone_id is not null or old.run_milestone_id is not null) execute function private.run_milestone_sync();

-- Marco de playbook atrasado: avisa quem aplicou e o responsável pela comunicação (uma vez).
create or replace function private.playbooks_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(array_remove(array[r.created_by, c.owner_id], null), 'client_onboarding',
    'Marco atrasado: ' || m.title || ' · ' || c.name,
    r.playbook_name || ' · era até ' || to_char(m.due_on, 'DD/MM') || '.', '/clientes/' || c.id, 'run_milestone_late:' || m.id)
  from public.run_milestones m
  join public.playbook_runs r on r.id = m.run_id
  join public.clients c on c.id = r.client_id and c.deleted_at is null
  where m.done_at is null and m.due_on < private.today_sp();
end;
$$;
select cron.schedule('extend-playbooks', '40 9 * * 1-5', $$select private.playbooks_tick()$$);
