-- Etapa 02 · ajuste: prazo dos itens do checklist = fim do dia em São Paulo (antes vencia na hora do fechamento).
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
  v_start date := coalesce(nullif(p ->> 'contract_start', '')::date, current_date);
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
  values (v_client, auth.uid(), current_date, nullif(p ->> 'monthly_fee_cents', '')::bigint, nullif(p ->> 'setup_fee_cents', '')::bigint,
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


-- Itens já criados: leva o prazo para o fim do mesmo dia.
update public.onboarding_checklist_items
   set due_at = (((due_at at time zone 'America/Sao_Paulo')::date) + time '23:59') at time zone 'America/Sao_Paulo'
 where done_at is null and due_at is not null;
