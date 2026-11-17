-- RF-T2-04: metas de anúncios por cliente e mês (investimento, resultados, custo máximo por resultado, ROAS mínimo),
-- com progresso e projeção na aba Anúncios e alerta quando o ritmo não bate (CPL acima da meta, RF-ALE-01).
-- Lê quem vê os anúncios do cliente; define quem otimiza as contas dele.

create table public.ad_goals (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  month              date not null check (extract(day from month) = 1),
  result_kind        text not null check (result_kind in ('leads', 'messages', 'purchases', 'link_clicks')),
  results_target     integer check (results_target > 0),
  spend_cents        bigint check (spend_cents > 0),
  max_cost_cents     bigint check (max_cost_cents > 0),
  min_roas           numeric(6, 2) check (min_roas > 0),
  notes              text check (char_length(notes) <= 500),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (client_id, month),
  check (results_target is not null or spend_cents is not null or max_cost_cents is not null or min_roas is not null)
);
create trigger ad_goals_updated_at before update on public.ad_goals for each row execute function private.set_updated_at();
create trigger audit_ad_goals after insert or update or delete on public.ad_goals
  for each row execute function private.audit_row('', 'results_target,spend_cents,max_cost_cents,min_roas,result_kind');

create or replace function private.ad_goal_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id and deleted_at is null;
  if new.organization_id is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by);
  else new.created_by := old.created_by; new.client_id := old.client_id; new.organization_id := old.organization_id;
  end if;
  return new;
end;
$$;
create trigger ad_goals_defaults before insert or update on public.ad_goals for each row execute function private.ad_goal_defaults();

alter table public.ad_goals enable row level security;
revoke all on public.ad_goals from anon, authenticated;
grant select, delete on public.ad_goals to authenticated;
grant insert (client_id, month, result_kind, results_target, spend_cents, max_cost_cents, min_roas, notes) on public.ad_goals to authenticated;
grant update (result_kind, results_target, spend_cents, max_cost_cents, min_roas, notes) on public.ad_goals to authenticated;
create policy ad_goals_select on public.ad_goals for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('ads.read', client_id)));
create policy ad_goals_insert on public.ad_goals for insert to authenticated
  with check ((select private.can_client('optimization.manage', client_id)));
create policy ad_goals_update on public.ad_goals for update to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('optimization.manage', client_id)));
create policy ad_goals_delete on public.ad_goals for delete to authenticated
  using (organization_id = (select private.org_id()) and (select private.can_client('optimization.manage', client_id)));

-- Alertas de meta (uma vez por semana por cliente e regra), a partir do 5º dia do mês:
--   custo por resultado do mês acima do máximo; resultados projetados abaixo de 80% da meta.
create or replace function private.ad_goals_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := private.today_sp();
  v_month date := date_trunc('month', private.today_sp())::date;
  v_days int := extract(day from (date_trunc('month', private.today_sp()) + interval '1 month - 1 day'))::int;
  v_elapsed int := extract(day from private.today_sp())::int - 1; -- dias completos (até ontem)
  v_week text := to_char(private.today_sp(), 'IYYY-IW');
  v_label text;
begin
  if v_elapsed < 5 then return; end if;
  for r in
    select g.*, c.name as client_name,
           coalesce(sum(i.spend_cents), 0) as spend,
           coalesce(sum(case g.result_kind when 'leads' then i.leads when 'messages' then i.messages when 'purchases' then i.purchases else i.link_clicks end), 0) as results
      from public.ad_goals g
      join public.clients c on c.id = g.client_id and c.deleted_at is null and c.status = 'ativo'
      left join public.ad_accounts a on a.client_id = g.client_id and a.is_enabled
      left join public.ad_insights_daily i on i.ad_account_id = a.id and i.level = 'account' and i.date >= v_month and i.date < v_today
     where g.month = v_month
     group by g.id, c.name
  loop
    v_label := case r.result_kind when 'leads' then 'lead' when 'messages' then 'conversa' when 'purchases' then 'compra' else 'clique' end;
    if r.max_cost_cents is not null and r.results > 0 and r.spend / r.results > r.max_cost_cents then
      perform public.notify_client_ads_team(r.client_id, null,
        'Custo por ' || v_label || ' acima da meta: ' || r.client_name,
        'No mês: R$ ' || to_char(r.spend / r.results / 100.0, 'FM999G990D00') || ' por ' || v_label || ' (meta: até R$ ' || to_char(r.max_cost_cents / 100.0, 'FM999G990D00') || ').',
        '/clientes/' || r.client_id || '/anuncios#metas', 'meta-custo:' || r.id || ':' || v_week);
    end if;
    if r.results_target is not null and r.results * v_days / v_elapsed < r.results_target * 0.8 then
      perform public.notify_client_ads_team(r.client_id, null,
        'Ritmo abaixo da meta: ' || r.client_name,
        r.results || ' ' || v_label || '(s) até ontem; no ritmo atual, ' || (r.results * v_days / v_elapsed) || ' no mês (meta: ' || r.results_target || ').',
        '/clientes/' || r.client_id || '/anuncios#metas', 'meta-ritmo:' || r.id || ':' || v_week);
    end if;
  end loop;
end;
$$;
revoke all on function private.ad_goals_tick() from public, anon, authenticated;
select cron.schedule('extend-metas-anuncios', '0 13 * * 1-5', $$select private.ad_goals_tick()$$);
