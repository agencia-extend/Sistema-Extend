-- Grupo de relatórios (decisão do Henrique, 17/11/2026): todos os relatórios dos clientes vão para um grupo interno;
-- o gestor encaminha manualmente para cada cliente. Um grupo de relatórios por conexão (pode ser o mesmo dos alertas).
alter table public.whatsapp_groups add column is_reports boolean not null default false;
create unique index whatsapp_groups_reports on public.whatsapp_groups (connection_id) where is_reports;

drop function public.save_whatsapp_group(uuid, uuid, boolean);
create function public.save_whatsapp_group(p_id uuid, p_client uuid, p_alerts boolean, p_reports boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conn uuid;
begin
  if not private.has_perm('integrations.manage') then
    raise exception 'Você não tem permissão para configurar o WhatsApp.' using errcode = '42501';
  end if;
  select g.connection_id into v_conn from public.whatsapp_groups g join public.whatsapp_connections c on c.id = g.connection_id
   where g.id = p_id and c.organization_id = private.org_id();
  if v_conn is null then
    raise exception 'Grupo não encontrado.' using errcode = 'P0002';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and organization_id = private.org_id() and deleted_at is null) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  if p_alerts then
    update public.whatsapp_groups set is_alerts = false where connection_id = v_conn and id <> p_id and is_alerts;
  end if;
  if p_reports then
    update public.whatsapp_groups set is_reports = false where connection_id = v_conn and id <> p_id and is_reports;
  end if;
  update public.whatsapp_groups set client_id = p_client, is_alerts = p_alerts, is_reports = p_reports where id = p_id;
end;
$$;
revoke all on function public.save_whatsapp_group(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.save_whatsapp_group(uuid, uuid, boolean, boolean) to authenticated;

-- Relatório semanal dos anúncios no grupo de relatórios: toda segunda às 9h (12h UTC), semana anterior (segunda a domingo).
select cron.schedule('extend-whatsapp-relatorios', '0 12 * * 1', $$select private.call_job('whatsapp-reports')$$);
