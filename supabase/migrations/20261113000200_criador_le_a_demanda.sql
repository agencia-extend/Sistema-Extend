-- Correção: criar demanda pela tela ("Nova demanda") era negado para todo mundo.
-- O insert devolve a linha (RETURNING) e a política de leitura chamava can_task(),
-- que procura a tarefa na própria tabela — dentro do mesmo comando a linha nova
-- ainda não aparece, então a leitura falhava e o Postgres recusava o insert.
-- Quem criou passa a ler a demanda direto pela coluna (mesma correção da agenda).
drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (organization_id = (select private.org_id()) and deleted_at is null
         and (created_by = (select auth.uid())
              or assignee_id = (select auth.uid())
              or (select private.can_task('tasks.read', id))
              or exists (select 1 from public.task_participants tp where tp.task_id = id and tp.profile_id = (select auth.uid()))));
