-- Números da agência no painel Operacional (RF-DSH-01): clientes por situação, mídia gerenciada no período e alertas de
-- anúncios abertos. São totais da agência inteira para quem tem "Ver painéis" (sócios e coordenação), mesmo sem acesso
-- às contas de cada cliente; nenhum detalhe por cliente sai daqui.
create or replace function public.agency_totals(p_since date, p_until date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
begin
  if not private.has_perm('dashboards.read') then
    raise exception 'Você não vê os painéis.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'active', (select count(*) from public.clients where organization_id = v_org and deleted_at is null and status = 'ativo'),
    'onboarding', (select count(*) from public.clients where organization_id = v_org and deleted_at is null and status = 'onboarding'),
    'paused', (select count(*) from public.clients where organization_id = v_org and deleted_at is null and status = 'pausado'),
    'spendCents', (select coalesce(sum(i.spend_cents), 0) from public.ad_insights_daily i
                     join public.ad_accounts a on a.id = i.ad_account_id
                    where a.organization_id = v_org and a.client_id is not null and i.level = 'account'
                      and i.date between p_since and p_until),
    'openAlerts', (select count(*) from public.ad_alerts where organization_id = v_org and status <> 'resolvido')
  );
end;
$$;
revoke all on function public.agency_totals(date, date) from public, anon;
grant execute on function public.agency_totals(date, date) to authenticated;
