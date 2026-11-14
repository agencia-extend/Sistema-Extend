-- =============================================================================
-- Etapa 12 · Área do cliente (RF-ACL-01..03)
-- =============================================================================
-- * O usuário do cliente é um perfil marcado com `portal_client_id`. Ele não tem
--   papel, setor nem permissão: `private.org_id()` e `private.user_perm_scope()`
--   devolvem nulo para ele, então nenhuma política interna o deixa ler nada.
-- * Tudo o que o cliente vê sai de funções `portal_*` (security definer) que
--   devolvem só colunas escolhidas: nada de valores, comentários internos,
--   outros clientes ou dados de setores.
-- * A equipe que vê o cliente pode abrir as mesmas telas como prévia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Marca do usuário do cliente
-- -----------------------------------------------------------------------------
alter table public.profiles add column portal_client_id uuid references public.clients (id) on delete cascade;
create index profiles_portal_client_idx on public.profiles (portal_client_id) where portal_client_id is not null;
grant select (portal_client_id) on public.profiles to authenticated;

-- Usuário do cliente não pertence à organização para as políticas internas.
create or replace function private.org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.id = auth.uid() and p.is_active and p.portal_client_id is null;
$$;

-- ... nem tem permissão interna, mesmo que alguém tente dar um papel a ele.
create or replace function private.user_perm_scope(p_user uuid, p_key text)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id from public.profiles p where p.id = p_user and p.is_active and p.portal_client_id is null
  ),
  ovr as (
    select o.effect, o.scope
    from public.user_permission_overrides o
    where o.user_id = (select id from me) and o.permission_key = p_key
  ),
  candidates as (
    select rp.scope
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select id from me) and rp.permission_key = p_key
    union all
    select scope from ovr where effect = 'grant'
  )
  select case
    when not exists (select 1 from me) then null
    when exists (select 1 from ovr where effect = 'deny') then null
    else (select max(scope) from candidates)
  end;
$$;

-- Cliente do usuário atual (só usuário do cliente ativo).
create or replace function private.portal_client()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.portal_client_id from public.profiles p where p.id = auth.uid() and p.is_active and p.portal_client_id is not null;
$$;

-- Pode ver a área deste cliente: o próprio usuário do cliente ou, como prévia, a equipe que vê o cliente.
create or replace function private.portal_can(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_client is not null
     and exists (select 1 from public.clients c where c.id = p_client and c.deleted_at is null)
     and (coalesce(private.portal_client() = p_client, false) or coalesce(private.can_client('clients.read', p_client), false));
$$;

-- Usuários do cliente ativos (destinatários dos avisos do portal).
create or replace function private.portal_users(p_client uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p where p.portal_client_id = p_client and p.is_active;
$$;

revoke execute on function private.portal_client(), private.portal_can(uuid), private.portal_users(uuid) from public, anon;
grant execute on function private.portal_client(), private.portal_can(uuid) to authenticated, service_role;

-- A equipe só enxerga o perfil de um usuário do cliente se vê aquele cliente.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (organization_id = (select private.org_id())
      and (portal_client_id is null or (select private.can_client('clients.read', portal_client_id))))
);

-- Usuário do cliente nunca entra no trabalho interno (papel, setor, equipe, demanda, responsável).
create or replace function private.guard_internal_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
begin
  if v is not null and exists (select 1 from public.profiles where id = v and portal_client_id is not null) then
    raise exception 'Usuários da área do cliente não participam do trabalho interno.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_roles_internal before insert or update on public.user_roles
  for each row execute function private.guard_internal_user('user_id');
create trigger user_overrides_internal before insert or update on public.user_permission_overrides
  for each row execute function private.guard_internal_user('user_id');
create trigger profile_sectors_internal before insert or update on public.profile_sectors
  for each row execute function private.guard_internal_user('profile_id');
create trigger client_members_internal before insert or update on public.client_members
  for each row execute function private.guard_internal_user('profile_id');
create trigger task_participants_internal before insert or update on public.task_participants
  for each row execute function private.guard_internal_user('profile_id');
create trigger tasks_assignee_internal before insert or update of assignee_id on public.tasks
  for each row execute function private.guard_internal_user('assignee_id');
create trigger clients_owner_internal before insert or update of owner_id on public.clients
  for each row execute function private.guard_internal_user('owner_id');

-- -----------------------------------------------------------------------------
-- Permissão
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, label, description, scoped, position) values
  ('clients.portal.manage', 'Clientes', 'Gerenciar a área do cliente',
   'Convidar pessoas do cliente, publicar a estratégia e compartilhar arquivos e relatórios com o cliente.', true, 15)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'clients.portal.manage', case when r.key in ('admin', 'coord_conteudo', 'gerente_trafego') then 'all' else 'clients' end::public.permission_scope
  from public.roles r
 where r.key in ('admin', 'coord_conteudo', 'gerente_trafego', 'gestor_trafego', 'social_media')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Convite do cliente (mesmo fluxo do convite da equipe, sem papel)
-- -----------------------------------------------------------------------------
alter table public.invitations alter column role_id drop not null;
alter table public.invitations add column portal_client_id uuid references public.clients (id) on delete cascade;
alter table public.invitations add constraint invitations_role_or_portal check ((role_id is null) = (portal_client_id is not null));
create index invitations_portal_client_idx on public.invitations (portal_client_id) where portal_client_id is not null;
grant select (portal_client_id) on public.invitations to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := (select id from public.organizations order by created_at limit 1);
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first boolean;
  v_role uuid;
  v_portal uuid;
begin
  v_first := not exists (select 1 from public.profiles where organization_id = v_org);
  if not v_first and v_meta ? 'invitation_id' then
    select i.portal_client_id into v_portal from public.invitations i where i.id = nullif(v_meta ->> 'invitation_id', '')::uuid;
  end if;

  insert into public.profiles (id, organization_id, full_name, email, is_active, portal_client_id)
  values (new.id, v_org, coalesce(v_meta ->> 'full_name', ''), coalesce(new.email, ''),
          v_first or not (v_meta ? 'invitation_id'), v_portal);

  -- Usuário do cliente: sem papel.
  if v_portal is not null then return new; end if;

  if v_first then
    select id into v_role from public.roles where organization_id = v_org and key = 'admin';
  else
    select id into v_role from public.roles
     where organization_id = v_org and id = nullif(v_meta ->> 'role_id', '')::uuid;
    if v_role is null then
      select id into v_role from public.roles where organization_id = v_org and key = 'leitura';
    end if;
  end if;

  insert into public.user_roles (user_id, role_id, created_by) values (new.id, v_role, null);
  return new;
end;
$$;

create or replace function public.finalize_invitation(p_invitation uuid, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_name text;
begin
  select * into v_inv from public.invitations where id = p_invitation for update;
  if v_inv.id is null or v_inv.status <> 'pendente' or v_inv.expires_at < now() or v_inv.user_id is null then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001', hint = 'invalid_invitation';
  end if;
  v_name := coalesce(nullif(trim(p_full_name), ''), v_inv.full_name);

  if v_inv.portal_client_id is not null then
    delete from public.user_roles where user_id = v_inv.user_id;
    delete from public.profile_sectors where profile_id = v_inv.user_id;
    update public.profiles
       set is_active = true, deactivated_at = null, portal_client_id = v_inv.portal_client_id,
           full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
     where id = v_inv.user_id;
    update public.invitations set status = 'aceito', accepted_at = now() where id = v_inv.id;
    perform private.log_event('portal_invitation_accepted', 'invitations', v_inv.id::text,
      jsonb_build_object('email', v_inv.email, 'client_id', v_inv.portal_client_id), v_inv.organization_id);
    perform private.timeline(v_inv.portal_client_id, 'portal', v_name || ' entrou na área do cliente', jsonb_build_object('email', v_inv.email));
    perform public.notify_users(array_remove(array[v_inv.invited_by], null), 'portal', v_name || ' entrou na área do cliente',
      (select name from public.clients where id = v_inv.portal_client_id), '/clientes/' || v_inv.portal_client_id || '/area-do-cliente',
      'portal_joined:' || v_inv.id, v_inv.user_id);
    return v_inv.user_id;
  end if;

  update public.profiles
     set is_active = true, deactivated_at = null,
         full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
   where id = v_inv.user_id;

  delete from public.user_roles where user_id = v_inv.user_id and role_id <> v_inv.role_id;
  insert into public.user_roles (user_id, role_id) values (v_inv.user_id, v_inv.role_id) on conflict do nothing;

  insert into public.profile_sectors (profile_id, sector_id)
  select v_inv.user_id, s.id from public.sectors s
   where s.id = any (v_inv.sector_ids) and s.organization_id = v_inv.organization_id
  on conflict do nothing;

  update public.invitations set status = 'aceito', accepted_at = now() where id = v_inv.id;
  perform private.log_event('invitation_accepted', 'invitations', v_inv.id::text,
    jsonb_build_object('email', v_inv.email), v_inv.organization_id);
  return v_inv.user_id;
end;
$$;

-- Pessoas do cliente com acesso e convites em aberto (aba "Área do cliente").
create or replace function public.portal_people(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_client('clients.read', p_client) then
    raise exception 'Você não tem acesso a este cliente.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'active', p.is_active,
               'last_seen_at', p.last_seen_at, 'created_at', p.created_at) order by p.full_name)
        from public.profiles p
       where p.portal_client_id = p_client
         and (p.is_active or p.deactivated_at is not null)), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.full_name, 'email', i.email, 'expires_at', i.expires_at,
               'send_count', i.send_count, 'last_sent_at', i.last_sent_at) order by i.created_at desc)
        from public.invitations i
       where i.portal_client_id = p_client and i.status = 'pendente'), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.portal_people(uuid) to authenticated;

-- Pode convidar/pausar pessoas do cliente e compartilhar com ele?
create or replace function public.can_manage_portal(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_client('clients.portal.manage', p_client);
$$;
grant execute on function public.can_manage_portal(uuid) to authenticated;

-- Pausar ou reativar o acesso de uma pessoa do cliente.
create or replace function public.set_portal_user_active(p_user uuid, p_active boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_user and portal_client_id is not null for update;
  if v_p.id is null then raise exception 'Pessoa não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_client('clients.portal.manage', v_p.portal_client_id) then
    raise exception 'Você não tem permissão para gerenciar a área deste cliente.' using errcode = '42501';
  end if;
  update public.profiles
     set is_active = p_active, deactivated_at = case when p_active then null else now() end
   where id = p_user;
  perform private.timeline(v_p.portal_client_id, 'portal',
    case when p_active then 'Acesso reativado: ' else 'Acesso pausado: ' end || coalesce(nullif(v_p.full_name, ''), v_p.email),
    jsonb_build_object('profile_id', p_user));
  perform private.log_event(case when p_active then 'portal_user_reactivated' else 'portal_user_paused' end, 'profiles', p_user::text);
  return v_p.email;
end;
$$;
grant execute on function public.set_portal_user_active(uuid, boolean) to authenticated;

-- Teste de notificação: o usuário do cliente pode testar o próprio aparelho.
create or replace function public.send_test_notification(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user <> auth.uid() and not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para notificar outros usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and is_active
                   and (organization_id = private.org_id() or id = auth.uid())) then
    raise exception 'Usuário não encontrado ou inativo.' using errcode = 'P0002';
  end if;
  insert into public.notifications (organization_id, user_id, actor_id, kind, title, body, href, push_status)
  select p.organization_id, p.id, auth.uid(), 'system',
         'Notificação de teste',
         'Se você está vendo isto, as notificações estão funcionando neste aparelho.',
         case when p.portal_client_id is null then '/inicio' else '/portal' end,
         case when coalesce(np.push, true) then 'pending' else 'skipped' end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id and np.kind = 'system'
  where p.id = p_user;
  perform private.log_event('test_notification', 'profiles', p_user::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Estratégia / planejamento publicado para o cliente
-- -----------------------------------------------------------------------------
create table public.client_strategies (
  client_id     uuid primary key references public.clients (id) on delete cascade,
  draft         text not null default '' check (char_length(draft) <= 20000),
  published     text check (char_length(published) <= 20000),
  published_at  timestamptz,
  published_by  uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null
);
alter table public.client_strategies enable row level security;
create policy client_strategies_select on public.client_strategies for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
revoke all on public.client_strategies from authenticated, anon;
grant select on public.client_strategies to authenticated;

-- Salvar rascunho e, opcionalmente, publicar (o cliente vê só o publicado e é avisado).
create or replace function public.save_client_strategy(p_client uuid, p_body text, p_publish boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_at timestamptz;
begin
  if not private.can_client('clients.portal.manage', p_client) then
    raise exception 'Você não tem permissão para publicar a estratégia deste cliente.' using errcode = '42501';
  end if;
  if char_length(v_body) > 20000 then raise exception 'Texto longo demais (máximo de 20 mil caracteres).' using errcode = 'P0001'; end if;
  if p_publish and char_length(v_body) < 20 then
    raise exception 'Escreva a estratégia antes de publicar (pelo menos 20 caracteres).' using errcode = 'P0001';
  end if;

  insert into public.client_strategies as s (client_id, draft, updated_at, updated_by)
  values (p_client, v_body, now(), auth.uid())
  on conflict (client_id) do update set draft = excluded.draft, updated_at = now(), updated_by = auth.uid();

  if p_publish then
    update public.client_strategies set published = v_body, published_at = now(), published_by = auth.uid()
     where client_id = p_client
    returning published_at into v_at;
    perform private.timeline(p_client, 'portal', 'Estratégia publicada na área do cliente');
    perform private.notify(private.portal_users(p_client), 'portal', 'Estratégia atualizada',
      'A Agência Extend publicou o planejamento do seu projeto.', '/portal/estrategia', 'portal_strategy:' || p_client || ':' || extract(epoch from v_at)::bigint);
  end if;
  return v_at;
end;
$$;
grant execute on function public.save_client_strategy(uuid, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Arquivos para o cliente: pastas "Relatórios" e "Para o cliente" de Documentos
-- -----------------------------------------------------------------------------
alter table public.client_files drop constraint client_files_folder_check;
alter table public.client_files add constraint client_files_folder_check
  check (folder in ('geral', 'midias', 'trafego', 'relatorios', 'cliente'));

create or replace function private.client_file_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folder not in ('relatorios', 'cliente') or (tg_op = 'UPDATE' and old.folder = new.folder) then
    return new;
  end if;
  -- Só quem gerencia a área do cliente compartilha com ele (o servidor, sem usuário, também pode).
  if auth.uid() is not null and not private.can_client('clients.portal.manage', new.client_id) then
    raise exception 'Só quem gerencia a área do cliente pode compartilhar arquivos com o cliente.' using errcode = '42501';
  end if;
  perform private.notify(private.portal_users(new.client_id), 'portal',
    case new.folder when 'relatorios' then 'Novo relatório: ' else 'Novo arquivo: ' end || new.name,
    'Disponível na sua área do cliente.', case new.folder when 'relatorios' then '/portal/relatorios' else '/portal/materiais' end,
    'portal_file:' || new.id);
  return new;
end;
$$;
create trigger client_files_portal after insert or update of folder on public.client_files
  for each row execute function private.client_file_portal();

-- -----------------------------------------------------------------------------
-- Aprovação do cliente: regra comum ao link e à área do cliente
-- -----------------------------------------------------------------------------
-- Demanda aguardando o cliente com algo para ver (versão enviada ou roteiro).
create or replace function private.portal_pending(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tasks t
      join public.workflow_steps s on s.id = t.workflow_step_id and s.waits_client
     where t.id = p_task and t.deleted_at is null and t.status <> 'cancelado' and t.client_id is not null
       and (exists (select 1 from public.task_deliveries d where d.task_id = t.id)
            or (s.name ilike '%roteiro%' and exists (select 1 from public.task_content c where c.task_id = t.id and char_length(btrim(coalesce(c.script, ''))) > 0)))
  );
$$;

-- Aplica a decisão do cliente registrada no link (p_link) — usada pelo link público e pela área do cliente.
create or replace function private.apply_client_decision(p_link uuid, p_decision text, p_comment text, p_name text, p_via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.approval_links;
  v_t public.tasks;
  v_requester uuid;
  v_target uuid;
  v_waits boolean;
  v_pos int;
  v_wf uuid;
  v_via text := case p_via when 'portal' then 'pela área do cliente' else 'pelo link' end;
begin
  select * into v_l from public.approval_links where id = p_link;
  select * into v_t from public.tasks where id = v_l.task_id for update;
  select requested_by into v_requester from public.creative_requests where task_id = v_t.id;

  if v_t.type = 'criativo' then
    v_target := private.creative_step(v_t.organization_id, case p_decision when 'aprovado' then 'Aprovado' else 'Ajustes solicitados' end);
  else
    select s.waits_client, s.position, s.workflow_id into v_waits, v_pos, v_wf from public.workflow_steps s where s.id = v_t.workflow_step_id;
    if coalesce(v_waits, false) then
      if p_decision = 'aprovado' then
        select id into v_target from public.workflow_steps where workflow_id = v_wf and position > v_pos and archived_at is null order by position limit 1;
      else
        select id into v_target from public.workflow_steps where workflow_id = v_wf and is_rework and archived_at is null order by position limit 1;
        if v_target is null then
          select id into v_target from public.workflow_steps where workflow_id = v_wf and position < v_pos and archived_at is null order by position desc limit 1;
        end if;
      end if;
    end if;
  end if;
  if v_target is not null then update public.tasks set workflow_step_id = v_target where id = v_t.id; end if;
  if v_t.type = 'criativo' and p_decision = 'aprovado' then perform private.creative_to_library(v_t.id); end if;

  insert into public.task_comments (task_id, author_id, body)
  select v_t.id, coalesce(v_l.created_by, v_requester, v_t.created_by),
         'Cliente' || coalesce(' (' || nullif(btrim(p_name), '') || ')', '') || case p_decision when 'aprovado' then ' aprovou ' || v_via || '.' else ' pediu alteração ' || v_via || ': ' || btrim(p_comment) end
   where coalesce(v_l.created_by, v_requester, v_t.created_by) is not null;
  insert into public.task_activity (task_id, actor_id, kind, title) values (v_t.id, null, 'client_review', case p_decision when 'aprovado' then 'Cliente aprovou' else 'Cliente pediu alteração' end);

  perform public.notify_users(array_remove(array[v_t.assignee_id, v_requester, v_l.created_by], null), 'client_approval',
    case p_decision when 'aprovado' then 'Cliente aprovou: ' else 'Cliente pediu alteração: ' end || v_t.title,
    case when p_decision = 'ajustes' then left(btrim(p_comment), 300) end,
    case when v_t.type = 'criativo' then '/criativos/' || v_t.id else '/tarefas/' || v_t.id end, 'client_review:' || v_l.id, null);
end;
$$;

-- Link público: mesmas verificações de antes; a regra da decisão passou para apply_client_decision.
create or replace function public.decide_approval(p_token_hash text, p_decision text, p_comment text, p_name text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.approval_links;
begin
  select * into v_l from public.approval_links where token_hash = p_token_hash for update;
  if v_l.id is null then return 'invalido'; end if;
  if v_l.decided_at is not null then return 'usado'; end if;
  if v_l.revoked_at is not null then return 'substituido'; end if;
  if v_l.expires_at < now() then return 'expirado'; end if;
  if p_decision not in ('aprovado', 'ajustes') then raise exception 'Decisão inválida.' using errcode = 'P0001'; end if;
  if p_decision = 'ajustes' and char_length(btrim(coalesce(p_comment, ''))) < 3 then raise exception 'Descreva o que precisa mudar.' using errcode = 'P0001'; end if;

  update public.approval_links
     set decided_at = now(), decision = p_decision, comment = nullif(btrim(p_comment), ''), reviewer_name = nullif(btrim(p_name), ''), reviewer_ip = left(p_ip, 64)
   where id = v_l.id;
  perform private.apply_client_decision(v_l.id, p_decision, p_comment, p_name, 'link');
  return 'ok';
end;
$$;
revoke all on function public.decide_approval(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.decide_approval(text, text, text, text, text) to service_role;

-- Decisão pela área do cliente (só o usuário do cliente, logado). Usa o link em aberto da demanda
-- ou registra um novo, já decidido, para o histórico ficar igual ao do link.
create or replace function public.portal_decide(p_task uuid, p_decision text, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := private.portal_client();
  v_t public.tasks;
  v_link uuid;
  v_delivery uuid;
  v_name text;
begin
  if v_client is null then
    raise exception 'Só a pessoa do cliente pode aprovar pela área do cliente.' using errcode = '42501';
  end if;
  select * into v_t from public.tasks where id = p_task for update;
  if v_t.id is null or v_t.client_id is distinct from v_client then
    raise exception 'Conteúdo não encontrado.' using errcode = 'P0002';
  end if;
  if not private.portal_pending(p_task) then
    raise exception 'Este conteúdo não está mais aguardando a sua aprovação.' using errcode = 'P0001';
  end if;
  if p_decision not in ('aprovado', 'ajustes') then raise exception 'Decisão inválida.' using errcode = 'P0001'; end if;
  if p_decision = 'ajustes' and char_length(btrim(coalesce(p_comment, ''))) < 3 then raise exception 'Descreva o que precisa mudar.' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_comment, '')) > 2000 then raise exception 'Comentário longo demais (máximo de 2.000 caracteres).' using errcode = 'P0001'; end if;

  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = auth.uid();
  select id into v_delivery from public.task_deliveries where task_id = p_task order by version desc limit 1;
  select id into v_link from public.approval_links
   where task_id = p_task and decided_at is null and revoked_at is null and expires_at > now()
   order by created_at desc limit 1 for update;
  if v_link is null then
    insert into public.approval_links (task_id, delivery_id, token_hash, expires_at, created_by)
    values (p_task, v_delivery, encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex'), now(), null)
    returning id into v_link;
  end if;
  update public.approval_links
     set decided_at = now(), decision = p_decision, comment = nullif(btrim(p_comment), ''), reviewer_name = left(v_name, 120), reviewer_ip = 'área do cliente'
   where id = v_link;
  perform private.apply_client_decision(v_link, p_decision, p_comment, v_name, 'portal');
end;
$$;
revoke all on function public.portal_decide(uuid, text, text) from public, anon;
grant execute on function public.portal_decide(uuid, text, text) to authenticated;

-- Aviso ao cliente: conteúdo chegou para aprovar (mudança de etapa ou nova versão na etapa do cliente).
create or replace function private.portal_approval_notify(p_task uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  if not private.portal_pending(p_task) then return; end if;
  select * into v_t from public.tasks where id = p_task;
  perform private.notify(private.portal_users(v_t.client_id), 'portal', 'Conteúdo para aprovar: ' || v_t.title,
    'Abra a área do cliente para aprovar ou pedir alteração.', '/portal/aprovacoes', 'portal_approval:' || p_key);
end;
$$;

create or replace function private.tasks_portal_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workflow_step_id is distinct from old.workflow_step_id then
    perform private.portal_approval_notify(new.id, new.id || ':' || coalesce(new.workflow_step_id::text, '') || ':' || extract(epoch from now())::bigint);
  end if;
  return new;
end;
$$;
create trigger tasks_portal_notify after update of workflow_step_id on public.tasks
  for each row execute function private.tasks_portal_notify();

create or replace function private.deliveries_portal_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.portal_approval_notify(new.task_id, 'delivery:' || new.id);
  return new;
end;
$$;
create trigger task_deliveries_portal_notify after insert on public.task_deliveries
  for each row execute function private.deliveries_portal_notify();

-- -----------------------------------------------------------------------------
-- Leituras do portal (só colunas escolhidas)
-- -----------------------------------------------------------------------------
create or replace function private.portal_guard(p_client uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.portal_can(p_client), false) then
    raise exception 'Você não tem acesso a esta área.' using errcode = '42501';
  end if;
end;
$$;

-- Visão geral: projeto, serviços, marcos, progresso do mês e atalhos.
create or replace function public.portal_home(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
  v_month public.client_months;
begin
  perform private.portal_guard(p_client);
  select * into v_month from public.client_months where client_id = p_client and starts_on <= v_today and ends_on >= v_today limit 1;

  return jsonb_build_object(
    'client', (select jsonb_build_object('id', c.id, 'name', c.name, 'segment', c.segment, 'status', c.status)
                 from public.clients c where c.id = p_client),
    'owner', (select jsonb_build_object('name', p.full_name)
                from public.clients c join public.profiles p on p.id = c.owner_id where c.id = p_client),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('name', sc.name, 'qty', cs.monthly_qty, 'unit', sc.unit) order by sc.position)
        from public.client_services cs join public.service_catalog sc on sc.id = cs.service_id
       where cs.client_id = p_client and cs.starts_on <= v_today and (cs.ends_on is null or cs.ends_on >= v_today)), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('title', m.title, 'due_on', m.due_on, 'done_at', m.done_at) order by m.position)
        from public.client_milestones m where m.client_id = p_client), '[]'::jsonb),
    'month', case when v_month.id is null then null else jsonb_build_object(
      'number', v_month.number, 'starts_on', v_month.starts_on, 'ends_on', v_month.ends_on,
      'services', coalesce((
        select jsonb_agg(x order by x ->> 'name')
          from (select jsonb_build_object('name', coalesce(sc.name, 'Outros'),
                         'total', count(*), 'done', count(*) filter (where t.status in ('concluido', 'aprovado'))) as x
                  from public.tasks t left join public.service_catalog sc on sc.id = t.service_id
                 where t.client_id = p_client and t.slot_month = v_month.starts_on and t.deleted_at is null and t.status <> 'cancelado'
                 group by sc.name) q), '[]'::jsonb)) end,
    'pending_approvals', (select count(*) from public.tasks t where t.client_id = p_client and private.portal_pending(t.id)),
    'next_posts', coalesce((
      select jsonb_agg(jsonb_build_object('title', q.title, 'post_on', q.post_on, 'format', q.format) order by q.post_on)
        from (select t.title, c.post_on, c.format
                from public.tasks t join public.task_content c on c.task_id = t.id
               where t.client_id = p_client and t.deleted_at is null and t.status <> 'cancelado'
                 and c.post_on >= v_today and c.post_url is null
               order by c.post_on limit 3) q), '[]'::jsonb),
    'strategy_at', (select published_at from public.client_strategies where client_id = p_client),
    'latest_report', (select jsonb_build_object('name', f.name, 'created_at', f.created_at)
                        from public.client_files f where f.client_id = p_client and f.folder = 'relatorios'
                       order by f.created_at desc limit 1)
  );
end;
$$;
grant execute on function public.portal_home(uuid) to authenticated;

-- Cronograma do mês (mesma regra da aba Cronograma da equipe).
create or replace function public.portal_schedule(p_client uuid, p_start date, p_end date)
returns table (task_id uuid, title text, format text, caption text, post_on date, post_url text, final_url text, cover_path text, done boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.portal_guard(p_client);
  if p_end < p_start or p_end - p_start > 62 then raise exception 'Período inválido.' using errcode = 'P0001'; end if;
  return query
    select t.id, t.title, c.format, c.caption, c.post_on, c.post_url, c.final_url, c.cover_path, t.status in ('concluido', 'aprovado')
      from public.tasks t join public.task_content c on c.task_id = t.id
     where t.client_id = p_client and t.deleted_at is null and t.status <> 'cancelado'
       and ((c.post_on between p_start and p_end) or (c.post_on is null and 'cronograma' = any (c.destination)))
     order by c.post_on nulls last, t.title;
end;
$$;
grant execute on function public.portal_schedule(uuid, date, date) to authenticated;

-- Aprovações pendentes (com a última versão) e as decisões recentes.
create or replace function public.portal_approvals(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.portal_guard(p_client);
  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(x order by x ->> 'since')
        from (
          select jsonb_build_object(
                   'task_id', t.id,
                   'title', coalesce(r.angle, t.title),
                   'step', s.name,
                   'since', t.updated_at,
                   'version', d.version,
                   'caption', c.caption,
                   'script', case when s.name ilike '%roteiro%' then c.script end,
                   'copy', r.copy_suggestion,
                   'cta', r.cta,
                   'assets', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'kind', a.kind, 'path', a.storage_path, 'url', a.url, 'mime', a.mime_type) order by a.name)
                                         from public.delivery_assets a where a.delivery_id = d.id), '[]'::jsonb)
                 ) as x
            from public.tasks t
            join public.workflow_steps s on s.id = t.workflow_step_id
            left join public.task_content c on c.task_id = t.id
            left join public.creative_requests r on r.task_id = t.id
            left join lateral (select dd.id, dd.version from public.task_deliveries dd where dd.task_id = t.id order by dd.version desc limit 1) d on true
           where t.client_id = p_client and private.portal_pending(t.id)
        ) q), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(x order by x ->> 'decided_at' desc)
        from (
          select jsonb_build_object('title', coalesce(r.angle, t.title), 'decision', l.decision, 'comment', l.comment,
                                    'name', l.reviewer_name, 'decided_at', l.decided_at) as x
            from public.approval_links l
            join public.tasks t on t.id = l.task_id and t.deleted_at is null
            left join public.creative_requests r on r.task_id = t.id
           where t.client_id = p_client and l.decided_at is not null
           order by l.decided_at desc limit 20
        ) q), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.portal_approvals(uuid) to authenticated;

-- Relatórios, arquivos compartilhados e conteúdos prontos para baixar.
create or replace function public.portal_files(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.portal_guard(p_client);
  return jsonb_build_object(
    'files', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'folder', f.folder, 'mime', f.mime_type, 'size', f.size_bytes, 'created_at', f.created_at)
                       order by f.created_at desc)
        from public.client_files f where f.client_id = p_client and f.folder in ('relatorios', 'cliente')), '[]'::jsonb),
    'contents', coalesce((
      select jsonb_agg(x order by x ->> 'at' desc)
        from (
          select jsonb_build_object('title', t.title, 'format', c.format, 'url', c.final_url, 'post_url', c.post_url,
                                    'at', coalesce(t.completed_at, c.updated_at)) as x
            from public.tasks t join public.task_content c on c.task_id = t.id
           where t.client_id = p_client and t.deleted_at is null and t.status in ('concluido', 'aprovado')
             and c.final_url is not null
           order by coalesce(t.completed_at, c.updated_at) desc limit 60
        ) q), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.portal_files(uuid) to authenticated;

-- Caminho do arquivo para baixar (só arquivos compartilhados e versões que aguardam o cliente).
create or replace function public.portal_file_path(p_client uuid, p_kind text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  perform private.portal_guard(p_client);
  if p_kind = 'arquivo' then
    select f.storage_path into v_path from public.client_files f
     where f.id = p_id and f.client_id = p_client and f.folder in ('relatorios', 'cliente');
  elsif p_kind = 'versao' then
    select a.storage_path into v_path
      from public.delivery_assets a
      join public.task_deliveries d on d.id = a.delivery_id
      join public.tasks t on t.id = d.task_id
     where a.id = p_id and t.client_id = p_client and a.storage_path is not null
       and private.portal_pending(t.id)
       and d.version = (select max(version) from public.task_deliveries where task_id = t.id);
  end if;
  return v_path;
end;
$$;
grant execute on function public.portal_file_path(uuid, text, uuid) to authenticated;

-- Estratégia publicada.
create or replace function public.portal_strategy(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.portal_guard(p_client);
  return (select jsonb_build_object('body', s.published, 'published_at', s.published_at)
            from public.client_strategies s where s.client_id = p_client and s.published is not null);
end;
$$;
grant execute on function public.portal_strategy(uuid) to authenticated;

revoke execute on function private.portal_pending(uuid), private.apply_client_decision(uuid, text, text, text, text),
  private.portal_approval_notify(uuid, text), private.portal_guard(uuid), private.guard_internal_user(),
  private.client_file_portal(), private.tasks_portal_notify(), private.deliveries_portal_notify() from public, anon;
grant execute on function private.portal_pending(uuid), private.portal_guard(uuid) to authenticated, service_role;
