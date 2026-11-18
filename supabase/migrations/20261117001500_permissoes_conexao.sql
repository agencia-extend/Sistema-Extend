-- A tela de Integrações mostra as permissões que a conexão recebeu (e as que faltam para cada recurso), para quem
-- configura o app da Meta conferir se a reconexão trouxe o que foi pedido.
drop function public.integration_status();
create function public.integration_status()
returns table (
  id uuid, provider text, purpose text, owner_kind text, method text, account_name text, account_email text,
  status text, last_error text, expires_at timestamptz, accounts_synced_at timestamptz, connected_by_name text, created_at timestamptz,
  client_id uuid, client_name text, scopes text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.provider, c.purpose, c.owner_kind, c.method, c.account_name, c.account_email,
         case when c.status = 'active' and c.expires_at is not null and c.expires_at < now() and c.refresh_token_enc is null then 'expired' else c.status end,
         c.last_error, c.expires_at, c.accounts_synced_at, p.full_name, c.created_at, c.client_id, cl.name, c.scopes
    from public.integration_connections c
    left join public.profiles p on p.id = c.connected_by
    left join public.clients cl on cl.id = c.client_id
   where c.organization_id = private.org_id()
     and ((c.owner_kind = 'agency' and (private.has_perm('ads.connect') or private.has_perm('ads.read') or private.has_perm('integrations.manage')))
          or c.profile_id = auth.uid()
          or (c.owner_kind = 'client' and (private.has_perm('ads.connect') or private.can_client('ads.read', c.client_id) or private.can_client('ads.manage', c.client_id))));
$$;
revoke all on function public.integration_status() from public, anon;
grant execute on function public.integration_status() to authenticated;
