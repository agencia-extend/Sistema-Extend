-- Quantidade mensal dos serviços em lote (clientes vindos do Trello sem o contratado). Para cliente ativo, mudar a
-- quantidade vale a partir do próximo mês (set_client_service). Esta função é o "vale já neste mês": ajusta o serviço
-- do mês atual no lugar e cria na hora as demandas do mês que faltarem (generate_slots não duplica).
create or replace function public.set_client_service_now(p_client uuid, p_service uuid, p_qty int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_cycle record;
  v_cur public.client_services;
  v_name text;
  v_today date := private.today_sp();
begin
  if not private.can_manage_client(p_client) then
    raise exception 'Você não tem permissão para alterar os serviços deste cliente.' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 0 or p_qty > 200 then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;
  select * into v_client from public.clients where id = p_client and deleted_at is null;
  if v_client.status <> 'ativo' then
    raise exception 'Só vale para cliente ativo. Em onboarding, ajuste pela ficha do cliente.' using errcode = 'P0001';
  end if;
  select name into v_name from public.service_catalog where id = p_service and organization_id = v_client.organization_id;
  if v_name is null then raise exception 'Serviço não encontrado.' using errcode = 'P0002'; end if;
  select * into v_cycle from private.cycle_of(private.cycle_anchor(v_client), v_today);

  select * into v_cur from public.client_services
   where client_id = p_client and service_id = p_service and starts_on <= v_today and (ends_on is null or ends_on >= v_today)
   order by starts_on desc limit 1;
  if v_cur.id is not null then
    update public.client_services set monthly_qty = p_qty, ends_on = null where id = v_cur.id;
  else
    insert into public.client_services (client_id, service_id, monthly_qty, starts_on)
    values (p_client, p_service, p_qty, coalesce(v_cycle.starts_on, v_today));
  end if;
  -- Mudança já agendada para o próximo mês com outra quantidade deixa de valer: fica a deste ajuste.
  delete from public.client_services where client_id = p_client and service_id = p_service and starts_on > v_today;

  perform private.timeline(p_client, 'service', 'Serviço ' || v_name || ': ' || p_qty || ' por mês (já neste mês)',
    jsonb_build_object('service_id', p_service, 'qty', p_qty));
  return private.generate_slots(p_client, v_today);
end;
$$;
revoke all on function public.set_client_service_now(uuid, uuid, int) from public, anon;
grant execute on function public.set_client_service_now(uuid, uuid, int) to authenticated;
