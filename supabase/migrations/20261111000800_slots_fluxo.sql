-- Etapa 03 · demandas do mês entram no fluxo com o responsável da primeira etapa
-- (se houver alguém marcado nela); senão ficam com a pessoa do setor do serviço.
-- O aviso vai para quem de fato recebeu a demanda.

create or replace function private.generate_slots(p_client uuid, p_month date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_month date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_days int;
  v_svc record;
  v_count int := 0;
  v_n int;
  v_assignee uuid;
  v_label text;
  v_new uuid[] := '{}';
  v_id uuid;
  v_got uuid;
begin
  select * into v_client from public.clients where id = p_client and deleted_at is null;
  if v_client.id is null or v_client.status <> 'ativo' then
    return 0;
  end if;
  if v_client.contract_start is not null and v_client.contract_start > v_last then return 0; end if;
  if v_client.contract_end is not null and v_client.contract_end < v_month then return 0; end if;

  v_days := extract(day from v_last)::int;

  for v_svc in
    select cs.id as cs_id, cs.monthly_qty, sc.id as service_id, sc.task_type, sc.sector_id, sc.unit, sc.name
    from public.client_services cs
    join public.service_catalog sc on sc.id = cs.service_id
    where cs.client_id = p_client
      and cs.monthly_qty > 0
      and sc.task_type is not null
      and cs.starts_on <= v_last
      and (cs.ends_on is null or cs.ends_on >= v_month)
  loop
    select m.profile_id into v_assignee
      from public.client_members m
      join public.profiles p on p.id = m.profile_id and p.is_active
     where m.client_id = p_client and m.sector_id = v_svc.sector_id
     order by m.is_default desc, m.created_at
     limit 1;

    v_label := case v_svc.task_type
      when 'video' then 'Vídeo' when 'design' then 'Arte' when 'conteudo' then 'Post'
      when 'gravacao' then 'Gravação' when 'site' then 'Site' else 'Criativo' end;

    for v_n in 1 .. v_svc.monthly_qty loop
      v_id := null;
      v_got := null;
      insert into public.tasks (organization_id, client_id, service_id, sector_id, type, title, status, assignee_id,
                                due_at, slot_month, slot_index, slot_total)
      values (v_client.organization_id, p_client, v_svc.service_id, v_svc.sector_id, v_svc.task_type,
              v_label || ' ' || v_n || '/' || v_svc.monthly_qty || ' – ' || private.month_label(v_month),
              'pendente', v_assignee,
              ((v_month + (ceil(v_n::numeric * v_days / v_svc.monthly_qty)::int - 1)) + time '18:00') at time zone 'America/Sao_Paulo',
              v_month, v_n, v_svc.monthly_qty)
      on conflict (client_id, service_id, slot_month, slot_index) where slot_month is not null do nothing
      returning id, assignee_id into v_id, v_got;
      if v_id is not null then
        v_count := v_count + 1;
        if v_got is not null then v_new := array_append(v_new, v_got); end if;
      end if;
    end loop;
  end loop;

  if v_count > 0 then
    perform private.timeline(p_client, 'slots', v_count || ' demanda(s) de ' || private.month_label(v_month) || ' criada(s)',
      jsonb_build_object('month', v_month, 'count', v_count));
    if array_length(v_new, 1) > 0 then
      perform public.notify_users(
        (select array_agg(distinct x) from unnest(v_new) x), 'assigned',
        'Novas demandas de ' || v_client.name,
        'As demandas de ' || private.month_label(v_month) || ' foram criadas e atribuídas a você.',
        '/tarefas', 'slots:' || p_client || ':' || v_month, auth.uid());
    end if;
  end if;
  return v_count;
end;
$$;

revoke execute on function private.generate_slots(uuid, date) from public, anon, authenticated;

create or replace function private.task_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step public.workflow_steps;
  v_who uuid;
begin
  if new.workflow_step_id is null and new.board_id is null then
    new.workflow_step_id := private.first_step(new.organization_id, new.type);
  end if;
  if new.workflow_step_id is not null then
    select * into v_step from public.workflow_steps where id = new.workflow_step_id;
    new.status := v_step.status;
    if new.client_id is not null and (new.assignee_id is null or new.slot_month is not null) then
      v_who := private.step_assignee(new.client_id, new.workflow_step_id);
      new.assignee_id := coalesce(v_who, new.assignee_id);
    end if;
    if new.sector_id is null or new.slot_month is not null then
      new.sector_id := coalesce(v_step.sector_id, new.sector_id);
    end if;
  end if;
  if new.position = 0 then new.position := extract(epoch from now()); end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;
