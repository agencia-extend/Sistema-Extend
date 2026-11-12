-- Agenda: quem cria o evento precisa conseguir lê-lo já no INSERT ... RETURNING.
-- private.can_event() é STABLE e consulta a própria tabela; dentro do mesmo comando
-- a linha nova ainda não é visível para ela, então o retorno do insert era negado
-- ("Você não tem permissão para esta ação") mesmo para quem pode criar eventos.
-- A checagem do criador passa a ser feita direto nas colunas da linha.
drop policy calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using (organization_id = (select private.org_id())
         and (created_by = (select auth.uid()) or (select private.can_event(id))));
