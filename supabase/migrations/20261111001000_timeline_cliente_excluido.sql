-- Excluir um cliente (cascata) disparava gatilhos que tentavam escrever na linha do
-- tempo do próprio cliente já removido, e a exclusão falhava por chave estrangeira.
-- A linha do tempo só é escrita se o cliente ainda existir.
create or replace function private.timeline(p_client uuid, p_kind text, p_title text, p_data jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.client_timeline (client_id, kind, title, data, actor_id)
  select p_client, p_kind, left(p_title, 300), coalesce(p_data, '{}'::jsonb), auth.uid()
   where exists (select 1 from public.clients c where c.id = p_client);
$$;
