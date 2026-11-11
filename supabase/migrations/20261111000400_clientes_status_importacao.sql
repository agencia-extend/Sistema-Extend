-- =============================================================================
-- Etapa 02 · Status do cliente, importação da planilha (com desfazer) e
-- configuração de quem recebe o aviso de cliente novo.
-- =============================================================================

-- Pausar, reativar ou encerrar (a ativação vem do onboarding).
create or replace function public.set_client_status(p_client uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not private.can_client('clients.manage', p_client) then
    raise exception 'Você não tem permissão para alterar o status deste cliente.' using errcode = '42501';
  end if;
  if p_status not in ('ativo', 'pausado', 'encerrado') then
    raise exception 'Status inválido.' using errcode = 'P0001';
  end if;
  select status into v_old from public.clients where id = p_client for update;
  if v_old = 'onboarding' then
    raise exception 'Conclua o onboarding antes de mudar o status.' using errcode = 'P0001';
  end if;
  if v_old = p_status then return; end if;
  update public.clients set status = p_status where id = p_client;
  perform private.timeline(p_client, 'status', 'Status alterado: ' || v_old || ' → ' || p_status);
end;
$$;

grant execute on function public.set_client_status(uuid, text) to authenticated;

-- Arquivar (soft delete): só quem gerencia todos os clientes.
create or replace function public.archive_client(p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.perm_scope('clients.manage') is distinct from 'all' then
    raise exception 'Somente quem gerencia todos os clientes pode arquivar.' using errcode = '42501';
  end if;
  update public.clients set deleted_at = now() where id = p_client and organization_id = private.org_id() and deleted_at is null;
  if not found then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;
end;
$$;

grant execute on function public.archive_client(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Importação da planilha "Controle de clientes" (RF-CLI-10)
-- p_rows: [{name, segment, contract_start, contract_end, services:[{service_id, monthly_qty}], notes, document}]
-- p_mode: 'ativo' (onboarding legado) | 'onboarding'
-- -----------------------------------------------------------------------------
create or replace function public.import_clients(p_file text, p_rows jsonb, p_mode text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_import uuid;
  v_row jsonb;
  v_client uuid;
  v_s jsonb;
  v_count int := 0;
begin
  if not private.has_perm('clients.import') then
    raise exception 'Você não tem permissão para importar clientes.' using errcode = '42501';
  end if;
  if p_mode not in ('ativo', 'onboarding') then
    raise exception 'Modo de importação inválido.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'A planilha precisa ter entre 1 e 1.000 clientes.' using errcode = 'P0001';
  end if;

  insert into public.client_imports (organization_id, file_name, created_by)
  values (v_org, left(p_file, 200), auth.uid()) returning id into v_import;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.clients (organization_id, name, segment, document, status, contract_start, contract_end,
                                notes, onboarding_legacy, onboarding_completed_at, import_id, created_by)
    values (v_org, trim(v_row ->> 'name'), nullif(trim(v_row ->> 'segment'), ''), nullif(trim(v_row ->> 'document'), ''),
            p_mode, nullif(v_row ->> 'contract_start', '')::date, nullif(v_row ->> 'contract_end', '')::date,
            nullif(trim(v_row ->> 'notes'), ''), p_mode = 'ativo', case when p_mode = 'ativo' then now() end, v_import, auth.uid())
    returning id into v_client;

    for v_s in select * from jsonb_array_elements(coalesce(v_row -> 'services', '[]')) loop
      insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
      select v_client, sc.id, coalesce((v_s ->> 'monthly_qty')::int, 0),
             coalesce(nullif(v_row ->> 'contract_start', '')::date, current_date)
      from public.service_catalog sc where sc.id = (v_s ->> 'service_id')::uuid and sc.organization_id = v_org;
    end loop;

    insert into public.client_onboarding (client_id, form_id, completed_at)
    select v_client, f.id, case when p_mode = 'ativo' then now() end
    from public.onboarding_forms f where f.organization_id = v_org and f.is_current;

    perform private.timeline(v_client, 'import', 'Cliente importado da planilha ' || left(p_file, 120));
    v_count := v_count + 1;
  end loop;

  update public.client_imports set row_count = v_count where id = v_import;
  perform private.log_event('clients_imported', 'client_imports', v_import::text, jsonb_build_object('rows', v_count, 'file', p_file));
  return v_import;
end;
$$;

grant execute on function public.import_clients(text, jsonb, text) to authenticated;

-- Desfazer: remove os clientes da importação que ainda não ganharam histórico próprio.
create or replace function public.undo_import(p_import uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not private.has_perm('clients.import') then
    raise exception 'Você não tem permissão para desfazer importações.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.client_imports where id = p_import and organization_id = private.org_id() and undone_at is null) then
    raise exception 'Importação não encontrada ou já desfeita.' using errcode = 'P0002';
  end if;
  delete from public.clients where import_id = p_import;
  get diagnostics v_count = row_count;
  update public.client_imports set undone_at = now(), undone_by = auth.uid() where id = p_import;
  perform private.log_event('clients_import_undone', 'client_imports', p_import::text, jsonb_build_object('rows', v_count));
  return v_count;
end;
$$;

grant execute on function public.undo_import(uuid) to authenticated;

-- Quem recebe o aviso de cliente novo (vazio = Coordenação de conteúdo + Gerente de tráfego).
create or replace function public.set_onboarding_recipients(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('settings.manage') then
    raise exception 'Você não tem permissão para alterar configurações.' using errcode = '42501';
  end if;
  update public.organizations
     set settings = settings || jsonb_build_object('onboarding_recipient_ids', to_jsonb(coalesce(p_ids, '{}')))
   where id = private.org_id();
end;
$$;

grant execute on function public.set_onboarding_recipients(uuid[]) to authenticated;

-- Novo modelo da ficha: vira a versão atual (as fichas em andamento continuam na versão delas).
create or replace function public.publish_onboarding_form(p_sections jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_version int;
begin
  if not private.has_perm('settings.manage') then
    raise exception 'Você não tem permissão para alterar a ficha.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'A ficha precisa ter ao menos uma seção.' using errcode = 'P0001';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.onboarding_forms where organization_id = v_org;
  update public.onboarding_forms set is_current = false where organization_id = v_org and is_current;
  insert into public.onboarding_forms (organization_id, version, sections, is_current, created_by)
  values (v_org, v_version, p_sections, true, auth.uid());
  -- Fichas ainda não concluídas passam para o modelo novo (respostas por chave são mantidas).
  update public.client_onboarding o
     set form_id = (select id from public.onboarding_forms where organization_id = v_org and is_current)
   where o.completed_at is null
     and exists (select 1 from public.clients c where c.id = o.client_id and c.organization_id = v_org);
  return v_version;
end;
$$;

grant execute on function public.publish_onboarding_form(jsonb) to authenticated;
