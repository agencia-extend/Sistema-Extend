-- Presença "quem está online" (docs/10): canal privado do Realtime por organização.
-- Só a equipe ativa da organização entra no canal (private.org_id() já exclui usuários da área do cliente
-- e pessoas desativadas). Quem não passa na política não vê nem anuncia presença.

create policy "equipe lê a presença da organização"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'equipe:' || (select private.org_id())::text
  );

create policy "equipe anuncia a presença na organização"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'equipe:' || (select private.org_id())::text
  );
