-- Criativos: usa as permissões que já existiam desde a fundação (pedir, produzir, revisar e
-- organizar a biblioteca) em vez de duas novas, e o tipo de aviso "creative_ready" para "criativo pronto".

-- Políticas que dependem das permissões repetidas saem antes.
drop policy if exists creative_library_select on public.creative_library;
drop policy if exists creative_library_update on public.creative_library;
delete from public.role_permissions where permission_key in ('creatives.request', 'creatives.library');
delete from public.user_permission_overrides where permission_key in ('creatives.request', 'creatives.library');
delete from public.permissions where key in ('creatives.request', 'creatives.library');

create policy creative_library_select on public.creative_library for select to authenticated
  using ((select private.can_client('clients.read', client_id))
         and ((select private.has_perm('creatives.request.create')) or (select private.has_perm('creatives.produce'))
              or (select private.has_perm('creatives.review')) or (select private.has_perm('creatives.library.manage'))));
create policy creative_library_update on public.creative_library for update to authenticated
  using ((select private.can_client('clients.read', client_id)) and ((select private.has_perm('creatives.library.manage')) or (select private.has_perm('creatives.review'))))
  with check ((select private.can_client('clients.read', client_id)) and ((select private.has_perm('creatives.library.manage')) or (select private.has_perm('creatives.review'))));

create or replace function private.creative_can_request(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.has_perm('creatives.request.create') and private.can_client('clients.read', p_client) $$;

-- Recria as funções trocando a permissão (o corpo é o mesmo da migração anterior).
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.create_creative_request(jsonb)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$private.has_perm('creatives.request')$q$, $q$private.has_perm('creatives.request.create')$q$);
  execute v_src;

  select pg_get_functiondef('public.review_creative(uuid,text,text)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$private.has_perm('creatives.request')$q$, $q$private.has_perm('creatives.review')$q$);
  execute v_src;

  select pg_get_functiondef('public.add_delivery(uuid,text,jsonb)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$'creative', 'Criativo pronto para revisar$q$, $q$'creative_ready', 'Criativo pronto para revisar$q$);
  execute v_src;
end;
$$;
