-- Quadros no estilo Trello: quadros próprios de cada cliente (criados por quem distribui as demandas do cliente, já
-- com colunas prontas, editáveis e reordenáveis) e "Minhas tarefas" em quadro por situação, arrastando o card.

-- Quadro de cliente: quem distribui as demandas daquele cliente cria e edita; quadros livres seguem só com
-- "Configurar quadros".
drop policy boards_write on public.boards;
create policy boards_write on public.boards for all to authenticated
  using (organization_id = (select private.org_id())
         and ((select private.has_perm('tasks.boards.configure')) or (client_id is not null and (select private.can_client('tasks.assign', client_id)))))
  with check (organization_id = (select private.org_id())
         and ((select private.has_perm('tasks.boards.configure')) or (client_id is not null and (select private.can_client('tasks.assign', client_id)))));

drop policy board_columns_write on public.board_columns;
create policy board_columns_write on public.board_columns for all to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id
                  and ((select private.has_perm('tasks.boards.configure')) or (b.client_id is not null and private.can_client('tasks.assign', b.client_id)))))
  with check (exists (select 1 from public.boards b where b.id = board_id
                  and ((select private.has_perm('tasks.boards.configure')) or (b.client_id is not null and private.can_client('tasks.assign', b.client_id)))));

-- Reordenar colunas (troca com a vizinha). A RLS acima decide quem pode.
create or replace function public.move_board_column(p_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.board_columns;
  v_other public.board_columns;
begin
  select * into v from public.board_columns where id = p_id;
  if v.id is null then raise exception 'Coluna não encontrada.' using errcode = 'P0002'; end if;
  -- Posições repetidas (colunas antigas) viram sequência antes de trocar.
  with o as (select id, row_number() over (order by position, name) as rn from public.board_columns where board_id = v.board_id)
  update public.board_columns c set position = o.rn from o where c.id = o.id and c.position is distinct from o.rn;
  select * into v from public.board_columns where id = p_id;
  if p_direction = 'left' then
    select * into v_other from public.board_columns where board_id = v.board_id and position < v.position order by position desc limit 1;
  else
    select * into v_other from public.board_columns where board_id = v.board_id and position > v.position order by position limit 1;
  end if;
  if v_other.id is null then return; end if;
  update public.board_columns set position = v_other.position where id = v.id;
  update public.board_columns set position = v.position where id = v_other.id;
  if not found then raise exception 'Você não edita as colunas deste quadro.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.move_board_column(uuid, text) from public, anon;
grant execute on function public.move_board_column(uuid, text) to authenticated;

-- "Minhas tarefas" em quadro: arrastar para A fazer, Fazendo, Aguardando aprovação ou Concluída.
-- Demanda com fluxo vai para a etapa mais próxima com aquela situação (e passa para o responsável dela, como no
-- quadro do cliente); demanda de quadro livre vai para a coluna de concluído (ou sai dela); demanda solta só muda
-- a situação.
create or replace function public.set_task_status(p_task uuid, p_status text, p_position double precision default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_cur public.workflow_steps;
  v_step uuid;
  v_col uuid;
  v_done boolean;
  v_label text := case p_status when 'pendente' then 'A fazer' when 'em_andamento' then 'Fazendo'
                                when 'aguardando_aprovacao' then 'Aguardando aprovação' when 'concluido' then 'Concluída' end;
begin
  if v_label is null then raise exception 'Situação inválida.' using errcode = 'P0001'; end if;
  if not private.can_task('tasks.manage', p_task) then
    raise exception 'Você não tem permissão para mover esta demanda.' using errcode = '42501';
  end if;
  select * into v_t from public.tasks where id = p_task and deleted_at is null for update;
  if v_t.id is null then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;
  if v_t.status = 'cancelado' then raise exception 'Demanda cancelada não muda de situação.' using errcode = 'P0001'; end if;

  if v_t.workflow_step_id is not null then
    select * into v_cur from public.workflow_steps where id = v_t.workflow_step_id;
    select s.id into v_step from public.workflow_steps s
     where s.workflow_id = v_cur.workflow_id and s.archived_at is null and s.status = p_status
     order by abs(s.position - v_cur.position), s.position desc limit 1;
    if v_step is null then
      raise exception 'O fluxo desta demanda não tem etapa "%". Mova pelo quadro do cliente.', v_label using errcode = 'P0001';
    end if;
    perform public.move_task(p_task, v_step, null, p_position);
    return;
  end if;

  if v_t.board_column_id is not null then
    select is_done into v_done from public.board_columns where id = v_t.board_column_id;
    if p_status = 'concluido' and not v_done then
      select id into v_col from public.board_columns where board_id = v_t.board_id and is_done order by position limit 1;
      if v_col is null then raise exception 'O quadro desta demanda não tem coluna de concluído.' using errcode = 'P0001'; end if;
      perform public.move_task(p_task, null, v_col, p_position);
    elsif p_status <> 'concluido' and v_done then
      select id into v_col from public.board_columns where board_id = v_t.board_id and not is_done order by position desc limit 1;
      if v_col is null then raise exception 'O quadro desta demanda só tem coluna de concluído.' using errcode = 'P0001'; end if;
      perform public.move_task(p_task, null, v_col, p_position);
    end if;
  end if;

  update public.tasks set status = p_status, position = coalesce(p_position, position),
    completed_at = case when p_status = 'concluido' then coalesce(completed_at, now()) else null end
   where id = p_task;
  if v_t.status is distinct from p_status then
    insert into public.task_activity (task_id, actor_id, kind, title) values (p_task, auth.uid(), 'move', 'Movida para ' || v_label);
  end if;
end;
$$;
revoke all on function public.set_task_status(uuid, text, double precision) from public, anon;
grant execute on function public.set_task_status(uuid, text, double precision) to authenticated;
