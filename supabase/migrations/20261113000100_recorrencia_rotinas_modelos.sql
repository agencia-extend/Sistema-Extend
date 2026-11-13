-- =============================================================================
-- Recorrência, rotinas por serviço e modelos de demanda
--  · Demanda que se repete (todo dia / toda semana / a cada N semanas / todo mês):
--    ao concluir ou ao passar do prazo, a próxima nasce sozinha para a mesma pessoa.
--  · Rotinas do serviço (briefing de mídias 3.7): para todo cliente com o serviço,
--    o sistema cria a demanda da semana no dia certo (ex.: cronograma na sexta,
--    legendas e posts programados na segunda) para a pessoa marcada no setor.
--  · Modelos de demanda (prompt ERP 3.4): atalhos que preenchem título, tipo,
--    descrição, prazo e repetição.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Recorrência
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column repeat_unit      text check (repeat_unit in ('dia', 'semana', 'mes')),
  add column repeat_every     int check (repeat_every between 1 and 52),
  add column repeat_owner_id  uuid references public.profiles (id) on delete set null,
  add column repeat_from_id   uuid references public.tasks (id) on delete set null,
  add column repeat_next_id   uuid references public.tasks (id) on delete set null,
  add constraint tasks_repeat_pair check ((repeat_unit is null) = (repeat_every is null));

create index tasks_repeat_pending_idx on public.tasks (due_at)
  where repeat_unit is not null and repeat_next_id is null and deleted_at is null;

create or replace function private.repeat_interval(p_unit text, p_every int)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_unit when 'dia' then make_interval(days => p_every)
                     when 'semana' then make_interval(weeks => p_every)
                     else make_interval(months => p_every) end;
$$;

-- Cria a próxima demanda da série (uma só vez por demanda). Retorna o id novo.
create or replace function private.spawn_next(p_task uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_step interval;
  v_due timestamptz;
  v_id uuid;
  v_col uuid;
  v_guard int := 0;
begin
  select * into v_t from public.tasks where id = p_task for update;
  if v_t.id is null or v_t.repeat_unit is null or v_t.repeat_next_id is not null or v_t.deleted_at is not null then
    return null;
  end if;
  if v_t.client_id is not null and exists (select 1 from public.clients c where c.id = v_t.client_id and (c.deleted_at is not null or c.status = 'encerrado')) then
    return null;
  end if;

  v_step := private.repeat_interval(v_t.repeat_unit, v_t.repeat_every);
  v_due := coalesce(v_t.due_at, v_t.created_at) + v_step;
  -- Ficou muito tempo parado: pula para a próxima data que ainda não passou.
  while v_due < now() and v_guard < 500 loop
    v_due := v_due + v_step;
    v_guard := v_guard + 1;
  end loop;

  if v_t.board_id is not null then
    select id into v_col from public.board_columns where board_id = v_t.board_id order by position limit 1;
  end if;

  insert into public.tasks (organization_id, client_id, sector_id, type, title, description, priority, assignee_id,
                            due_at, board_id, board_column_id, repeat_unit, repeat_every, repeat_owner_id, repeat_from_id, created_by)
  values (v_t.organization_id, v_t.client_id, v_t.sector_id, v_t.type, v_t.title, v_t.description, v_t.priority,
          coalesce(v_t.repeat_owner_id, v_t.assignee_id),
          v_due, v_t.board_id, v_col, v_t.repeat_unit, v_t.repeat_every, v_t.repeat_owner_id, v_t.id, v_t.created_by)
  returning id into v_id;

  insert into public.task_checklist_items (task_id, title, position)
  select v_id, title, position from public.task_checklist_items where task_id = p_task;
  insert into public.task_tags (task_id, tag_id) select v_id, tag_id from public.task_tags where task_id = p_task;
  insert into public.task_participants (task_id, profile_id) select v_id, profile_id from public.task_participants where task_id = p_task;

  update public.tasks set repeat_next_id = v_id where id = p_task;
  insert into public.task_activity (task_id, actor_id, kind, title)
  values (p_task, auth.uid(), 'repeat', 'Próxima da série criada para ' || to_char(v_due at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')),
         (v_id, auth.uid(), 'repeat', 'Criada pela repetição da demanda anterior');
  return v_id;
end;
$$;

revoke execute on function private.spawn_next(uuid), private.repeat_interval(text, int) from public, anon, authenticated;

-- Concluiu → a próxima já aparece (sem esperar o prazo).
create or replace function private.task_repeat_on_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.repeat_unit is not null and new.repeat_next_id is null and new.status = 'concluido' and old.status is distinct from 'concluido' then
    perform private.spawn_next(new.id);
  end if;
  return new;
end;
$$;

create trigger tasks_repeat_on_done after update of status on public.tasks
  for each row execute function private.task_repeat_on_done();

-- Passou do prazo sem concluir → a próxima nasce também (a atrasada continua aberta).
create or replace function private.recurrence_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.tasks
     where repeat_unit is not null and repeat_next_id is null and deleted_at is null
       and status <> 'cancelado' and due_at is not null and due_at < now()
     order by due_at limit 500
  loop
    if private.spawn_next(v_id) is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.recurrence_tick() from public, anon, authenticated;
select cron.schedule('extend-recorrencia', '*/15 * * * *', $$select private.recurrence_tick()$$);

-- -----------------------------------------------------------------------------
-- 2. Rotinas por serviço
-- -----------------------------------------------------------------------------
create table public.service_routines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  service_id       uuid not null references public.service_catalog (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 120),
  description      text check (char_length(description) <= 2000),
  sector_id        uuid not null references public.sectors (id) on delete restrict,
  weekday          int not null check (weekday between 0 and 6),  -- 0 = domingo
  due_hour         int not null default 18 check (due_hour between 0 and 23),
  lead_days        int not null default 3 check (lead_days between 0 and 6),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger service_routines_updated_at before update on public.service_routines
  for each row execute function private.set_updated_at();

alter table public.tasks
  add column routine_id uuid references public.service_routines (id) on delete set null,
  add column routine_on date;
create unique index tasks_routine_once on public.tasks (routine_id, client_id, routine_on) where routine_id is not null;

alter table public.service_routines enable row level security;
create policy service_routines_select on public.service_routines for select to authenticated
  using (organization_id = (select private.org_id()));
create policy service_routines_write on public.service_routines for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')));

-- Cria, para cada cliente ativo com o serviço, a demanda da próxima ocorrência
-- (até lead_days antes do dia). Uma por cliente, rotina e data.
create or replace function private.routines_tick(p_today date default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'America/Sao_Paulo')::date);
  v_r record;
  v_on date;
  v_assignee uuid;
  v_id uuid;
  v_count int := 0;
begin
  for v_r in
    select r.*, c.id as client_id, c.name as client_name, c.organization_id as org
      from public.service_routines r
      join public.client_services cs on cs.service_id = r.service_id
      join public.clients c on c.id = cs.client_id and c.status = 'ativo' and c.deleted_at is null
     where r.is_active
       and cs.starts_on <= v_today and (cs.ends_on is null or cs.ends_on >= v_today)
       and (cs.monthly_qty is null or cs.monthly_qty > 0)
  loop
    v_on := v_today + ((v_r.weekday - extract(dow from v_today)::int + 7) % 7);
    continue when v_on - v_today > v_r.lead_days;

    select m.profile_id into v_assignee
      from public.client_members m join public.profiles p on p.id = m.profile_id and p.is_active
     where m.client_id = v_r.client_id and m.sector_id = v_r.sector_id
     order by m.is_default desc, m.created_at limit 1;

    v_id := null;
    insert into public.tasks (organization_id, client_id, sector_id, type, title, description, assignee_id, due_at, routine_id, routine_on)
    values (v_r.org, v_r.client_id, v_r.sector_id, 'geral', v_r.title, v_r.description, v_assignee,
            (v_on + make_time(v_r.due_hour, 0, 0)) at time zone 'America/Sao_Paulo', v_r.id, v_on)
    on conflict (routine_id, client_id, routine_on) where routine_id is not null do nothing
    returning id into v_id;
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.routines_tick(date) from public, anon, authenticated;
-- 06:05 em São Paulo.
select cron.schedule('extend-rotinas', '5 9 * * *', $$select private.routines_tick()$$);

-- Rotinas do social media (briefing de mídias 3.7).
insert into public.service_routines (organization_id, service_id, title, description, sector_id, weekday, due_hour, lead_days)
select sc.organization_id, sc.id, x.title, x.descr, s.id, x.wd, x.h, x.lead
  from public.service_catalog sc
  join (values
    ('Cronograma de conteúdo da próxima semana', 'Montar o cronograma da semana seguinte com os conteúdos aprovados (data, formato e legenda prevista).', 'conteudo', 5, 18, 3),
    ('Legendas da semana', 'Escrever as legendas dos posts desta semana e deixar para aprovação.', 'gerenciamento', 1, 12, 3),
    ('Programar os posts da semana', 'Programar no Instagram e no Facebook todos os posts da semana, até domingo.', 'gerenciamento', 1, 18, 3)
  ) as x(title, descr, sector_key, wd, h, lead) on true
  join public.sectors s on s.organization_id = sc.organization_id and s.key = x.sector_key
 where sc.key = 'gerenciamento';

-- -----------------------------------------------------------------------------
-- 3. Modelos de demanda
-- -----------------------------------------------------------------------------
create table public.task_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 120),
  category         text not null check (category in ('criativos', 'trafego', 'conteudo', 'site', 'copy', 'reunioes', 'outros')),
  type             text not null default 'geral' check (type in ('video', 'design', 'conteudo', 'gravacao', 'site', 'geral')),
  description      text check (char_length(description) <= 4000),
  due_days         int not null default 3 check (due_days between 0 and 365),
  priority         text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  repeat_unit      text check (repeat_unit in ('dia', 'semana', 'mes')),
  repeat_every     int check (repeat_every between 1 and 52),
  position         int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((repeat_unit is null) = (repeat_every is null))
);

create trigger task_templates_updated_at before update on public.task_templates
  for each row execute function private.set_updated_at();

alter table public.task_templates enable row level security;
create policy task_templates_select on public.task_templates for select to authenticated
  using (organization_id = (select private.org_id()));
create policy task_templates_write on public.task_templates for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('tasks.boards.configure')));

insert into public.task_templates (organization_id, name, category, type, description, due_days, priority, repeat_unit, repeat_every, position)
select o.id, x.name, x.cat, x.type, x.descr, x.days, x.prio, x.ru, x.re, x.pos
  from public.organizations o
  cross join (values
    ('Criativos para feed', 'criativos', 'design', '4 a 6 criativos 1080x1080 com variações de copy, com e sem texto na arte.', 5, 'media', null, null, 10),
    ('Criativos para stories', 'criativos', 'design', '3 criativos 1080x1920 com chamada para ação clara.', 5, 'media', null, null, 20),
    ('Vídeo para Reels/TikTok', 'criativos', 'video', 'Vídeo de 15 a 30 s com legenda, trilha e chamada para ação no fim.', 7, 'media', null, null, 30),
    ('Setup inicial de campanha', 'trafego', 'geral', 'Conta, pixel, públicos, conjuntos e criativos. Validar o rastreamento antes de subir.', 3, 'alta', null, null, 40),
    ('Revisão semanal das campanhas', 'trafego', 'geral', 'Olhar CPL, CTR, frequência e ROAS; pausar criativos saturados; registrar o que mudou.', 7, 'media', 'semana', 1, 50),
    ('Escala de campanha', 'trafego', 'geral', 'Subir 20 a 30% do orçamento nos conjuntos com CPL abaixo da meta.', 3, 'media', null, null, 60),
    ('Relatório mensal de performance', 'trafego', 'geral', 'Investimento, impressões, cliques, leads, CPL e ROAS, com recomendações para o próximo mês.', 30, 'media', 'mes', 1, 70),
    ('Nova landing page', 'site', 'site', 'Headline, problema, solução, prova social, chamada para ação, pixel e formulário.', 10, 'media', null, null, 80),
    ('Otimizar landing page existente', 'site', 'site', 'Mapa de calor, taxa de conversão e testes de headline e botão.', 7, 'baixa', null, null, 90),
    ('Copy para anúncios', 'copy', 'geral', '3 variações por formato: dor, ganho e medo.', 3, 'media', null, null, 100),
    ('Roteiros do mês', 'copy', 'conteudo', 'Roteiros dos vídeos do mês, alinhados com o planejamento aprovado.', 5, 'media', null, null, 110),
    ('Reunião de onboarding', 'reunioes', 'geral', 'Apresentar a equipe e a metodologia, preencher o briefing, pegar os acessos e alinhar metas.', 3, 'alta', null, null, 120),
    ('Reunião mensal de resultados', 'reunioes', 'geral', 'Apresentar o relatório, os aprendizados e a estratégia do próximo mês.', 30, 'media', 'mes', 1, 130),
    ('Reunião de acompanhamento', 'reunioes', 'geral', 'Como estão os leads e as vendas, análise dos resultados e novas ideias.', 14, 'media', 'semana', 2, 140)
  ) as x(name, cat, type, descr, days, prio, ru, re, pos);
