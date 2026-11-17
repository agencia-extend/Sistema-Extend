-- As políticas consultavam whatsapp_connections com o login da pessoa (a tabela não tem grant, de propósito:
-- guarda a chave cifrada). A organização da conexão vem por função security definer.
create or replace function private.whatsapp_in_org(p_connection uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.whatsapp_connections c where c.id = p_connection and c.organization_id = private.org_id());
$$;
revoke all on function private.whatsapp_in_org(uuid) from public, anon;
grant execute on function private.whatsapp_in_org(uuid) to authenticated;

drop policy whatsapp_groups_select on public.whatsapp_groups;
create policy whatsapp_groups_select on public.whatsapp_groups for select to authenticated
  using ((select private.whatsapp_in_org(connection_id))
         and ((select private.has_perm('integrations.manage')) or (select private.has_perm('inbox.read'))
              or (client_id is not null and (select private.can_client('reports.manage', client_id)))));

drop policy whatsapp_messages_select on public.whatsapp_messages;
create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated
  using ((select private.whatsapp_in_org(connection_id)) and (select private.has_perm('inbox.read')));

drop policy whatsapp_outbox_select on public.whatsapp_outbox;
create policy whatsapp_outbox_select on public.whatsapp_outbox for select to authenticated
  using ((select private.whatsapp_in_org(connection_id)) and (select private.has_perm('integrations.manage')));
