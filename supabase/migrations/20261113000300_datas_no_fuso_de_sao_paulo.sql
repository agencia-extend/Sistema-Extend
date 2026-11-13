-- Correção de fuso: entre 21h e meia-noite em São Paulo, current_date (UTC) já é o
-- dia seguinte. O fechamento gravava o início do contrato "amanhã" e, ao concluir o
-- onboarding na mesma noite, o mês do cliente ainda não tinha começado: nenhuma
-- demanda era criada. As datas de negócio passam a usar o dia de São Paulo.
create or replace function private.today_sp()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

grant execute on function private.today_sp() to authenticated, service_role;

alter table public.client_services alter column starts_on set default private.today_sp();
alter table public.commercial_handoffs alter column closed_on set default private.today_sp();

-- public.create_handoff: 2 troca(s) de current_date
create or replace function public.create_handoff(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_client uuid;
  v_handoff uuid;
  v_start date := coalesce(nullif(p ->> 'contract_start', '')::date, private.today_sp());
  v_months int := nullif(p ->> 'contract_months', '')::int;
  v_s jsonb;
  v_t record;
  v_assignee uuid;
  v_recipients uuid[];
begin
  if not private.has_perm('commercial.handoff.create') then
    raise exception 'Você não tem permissão para registrar fechamentos.' using errcode = '42501';
  end if;
  if coalesce(trim(p ->> 'name'), '') = '' then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'services', '[]')) = 0 then
    raise exception 'Escolha ao menos um serviço vendido.' using errcode = 'P0001';
  end if;

  insert into public.clients (organization_id, name, legal_name, document, segment, status, contract_start, contract_end,
                              renewal_date, media_budget_cents, monthly_fee_cents, payment_method, communication_channel, created_by)
  values (v_org, trim(p ->> 'name'), nullif(trim(p ->> 'legal_name'), ''), nullif(trim(p ->> 'document'), ''),
          nullif(trim(p ->> 'segment'), ''), 'onboarding', v_start,
          case when v_months is not null then (v_start + make_interval(months => v_months) - interval '1 day')::date end,
          case when v_months is not null then (v_start + make_interval(months => v_months) - interval '30 days')::date end,
          nullif(p ->> 'media_budget_cents', '')::bigint, nullif(p ->> 'monthly_fee_cents', '')::bigint,
          nullif(trim(p ->> 'payment_method'), ''), nullif(trim(p ->> 'communication_channel'), ''), auth.uid())
  returning id into v_client;

  for v_s in select * from jsonb_array_elements(p -> 'services') loop
    insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
    select v_client, sc.id, coalesce((v_s ->> 'monthly_qty')::int, 0), nullif(v_s ->> 'price_cents', '')::bigint, v_start
    from public.service_catalog sc where sc.id = (v_s ->> 'service_id')::uuid and sc.organization_id = v_org;
  end loop;

  if coalesce(trim(p -> 'contact' ->> 'name'), '') <> '' then
    insert into public.client_contacts (client_id, name, role, phone, email, is_primary)
    values (v_client, trim(p -> 'contact' ->> 'name'), nullif(trim(p -> 'contact' ->> 'role'), ''),
            nullif(trim(p -> 'contact' ->> 'phone'), ''), nullif(lower(trim(p -> 'contact' ->> 'email')), ''), true);
  end if;

  insert into public.commercial_handoffs (client_id, sold_by, closed_on, monthly_fee_cents, setup_fee_cents, payment_method,
                                          contract_months, notes, created_by)
  values (v_client, auth.uid(), private.today_sp(), nullif(p ->> 'monthly_fee_cents', '')::bigint, nullif(p ->> 'setup_fee_cents', '')::bigint,
          nullif(trim(p ->> 'payment_method'), ''), v_months, nullif(trim(p ->> 'notes'), ''), auth.uid())
  returning id into v_handoff;

  insert into public.handoff_promises (client_id, handoff_id, description, due_at)
  select v_client, v_handoff, trim(x ->> 'description'), (x ->> 'due_at')::timestamptz
  from jsonb_array_elements(coalesce(p -> 'promises', '[]')) x
  where coalesce(trim(x ->> 'description'), '') <> '' and nullif(x ->> 'due_at', '') is not null;

  insert into public.client_onboarding (client_id, form_id)
  select v_client, f.id from public.onboarding_forms f where f.organization_id = v_org and f.is_current;

  v_recipients := private.onboarding_recipients(v_org);
  for v_t in select * from public.onboarding_checklist_templates where organization_id = v_org and is_active order by position loop
    -- Responsável padrão: alguém do setor do item que recebe o aviso de onboarding; senão, primeiro do setor.
    select ps.profile_id into v_assignee
      from public.profile_sectors ps join public.profiles pr on pr.id = ps.profile_id and pr.is_active
     where ps.sector_id = v_t.default_sector_id
     order by (ps.profile_id = any (v_recipients)) desc, ps.is_lead desc, ps.created_at
     limit 1;
    insert into public.onboarding_checklist_items (client_id, title, assignee_id, due_at, position)
    values (v_client, v_t.title, v_assignee,
            -- Prazo = fim do dia (23:59 em São Paulo) N dias após o fechamento.
            (((now() at time zone 'America/Sao_Paulo')::date + v_t.due_days) + time '23:59') at time zone 'America/Sao_Paulo',
            v_t.position);
    v_assignee := null;
  end loop;

  perform private.timeline(v_client, 'handoff', 'Fechamento comercial registrado', jsonb_build_object('handoff_id', v_handoff));
  perform private.log_event('handoff_created', 'clients', v_client::text, jsonb_build_object('name', p ->> 'name'));
  perform public.notify_users(v_recipients, 'client_onboarding', 'Cliente novo em onboarding: ' || trim(p ->> 'name'),
    'O comercial registrou o fechamento. Abra a ficha e o checklist de onboarding.', '/clientes/' || v_client,
    'onboarding:' || v_client, auth.uid());
  return v_client;
end;
$$;

-- public.import_clients: 1 troca(s) de current_date
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
             coalesce(nullif(v_row ->> 'contract_start', '')::date, private.today_sp())
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

-- public.set_client_service: 2 troca(s) de current_date
create or replace function public.set_client_service(p_client uuid, p_service uuid, p_qty int, p_price_cents bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_cur public.client_services;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_next date;
  v_name text;
begin
  if not private.can_manage_client(p_client) then
    raise exception 'Você não tem permissão para alterar os serviços deste cliente.' using errcode = '42501';
  end if;
  select * into v_client from public.clients where id = p_client;
  select name into v_name from public.service_catalog where id = p_service and organization_id = v_client.organization_id;
  if v_name is null then raise exception 'Serviço não encontrado.' using errcode = 'P0002'; end if;
  if p_qty is not null and (p_qty < 0 or p_qty > 200) then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;

  select cy.ends_on + 1 into v_next from private.cycle_of(private.cycle_anchor(v_client), v_today) cy;
  v_next := coalesce(v_next, v_today);

  select * into v_cur from public.client_services
   where client_id = p_client and service_id = p_service and (ends_on is null or ends_on >= private.today_sp())
   order by starts_on desc limit 1;

  if v_client.status = 'onboarding' then
    if p_qty is null then
      delete from public.client_services where id = v_cur.id;
    elsif v_cur.id is null then
      insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
      values (p_client, p_service, p_qty, p_price_cents, coalesce(v_client.contract_start, private.today_sp()));
    else
      update public.client_services set monthly_qty = p_qty, price_cents = p_price_cents where id = v_cur.id;
    end if;
  else
    if v_cur.id is not null then
      if v_cur.starts_on >= v_next then
        delete from public.client_services where id = v_cur.id;
      else
        update public.client_services set ends_on = v_next - 1 where id = v_cur.id;
      end if;
    end if;
    if p_qty is not null then
      insert into public.client_services (client_id, service_id, monthly_qty, price_cents, starts_on)
      values (p_client, p_service, p_qty, p_price_cents, v_next);
    end if;
  end if;

  perform private.timeline(p_client, 'service',
    case when p_qty is null then 'Serviço removido: ' || v_name
         else 'Serviço ' || v_name || ': ' || p_qty || ' por mês' end
    || case when v_client.status = 'onboarding' then '' else ' (a partir de ' || to_char(v_next, 'DD/MM/YYYY') || ')' end,
    jsonb_build_object('service_id', p_service, 'qty', p_qty));
end;
$$;

