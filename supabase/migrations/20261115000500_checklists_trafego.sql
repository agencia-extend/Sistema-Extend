-- Briefing do Luiz, item 6: checklists do tráfego (RF-OTI-01 diário, RF-OTI-02 semanal) e painel de
-- pendências do gestor (RF-OTI-04). Por enquanto o gestor confere no Gerenciador e marca aqui; com a
-- sincronização, os itens chegam pré-preenchidos com os números da API.

create table public.traffic_checks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  kind            text not null check (kind in ('diario', 'semanal')),
  -- diário: o dia; semanal: a segunda-feira da semana
  period_on       date not null,
  items           jsonb not null,
  decisions       jsonb not null default '[]',
  notes           text check (char_length(notes) <= 1000),
  problems        int not null default 0,
  done_by         uuid references public.profiles (id) on delete set null,
  done_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (client_id, kind, period_on)
);
create index traffic_checks_period on public.traffic_checks (kind, period_on desc);

-- Valida itens e decisões (devolve a mensagem do erro ou null).
create or replace function private.traffic_check_error(p_kind text, p_items jsonb, p_decisions jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys text[] := case p_kind when 'diario' then array['saldo', 'reprovados', 'gasto', 'entrega']
                               else array['criativos', 'publicos', 'custos'] end;
  v_seen text[] := '{}';
  v jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then return 'Itens inválidos.'; end if;
  for v in select * from jsonb_array_elements(p_items) loop
    if not (v ->> 'key' = any (v_keys)) or v ->> 'key' = any (v_seen) then return 'Item do checklist inválido.'; end if;
    if coalesce(v ->> 'status', '') not in ('ok', 'problema', 'na') then return 'Marque cada item.'; end if;
    if char_length(coalesce(v ->> 'note', '')) > 500 then return 'Comentário com mais de 500 caracteres.'; end if;
    if v ->> 'status' = 'problema' and char_length(btrim(coalesce(v ->> 'note', ''))) < 3 then
      return 'Conte qual é o problema em cada item marcado.';
    end if;
    v_seen := v_seen || (v ->> 'key');
  end loop;
  if cardinality(v_seen) <> cardinality(v_keys) then return 'Marque todos os itens do checklist.'; end if;

  if jsonb_typeof(p_decisions) <> 'array' then return 'Decisões inválidas.'; end if;
  if p_kind = 'diario' and jsonb_array_length(p_decisions) > 0 then return 'Decisões são do checklist semanal.'; end if;
  if jsonb_array_length(p_decisions) > 30 then return 'Use até 30 decisões.'; end if;
  for v in select * from jsonb_array_elements(p_decisions) loop
    if coalesce(v ->> 'level', '') not in ('campanha', 'conjunto', 'anuncio')
       or coalesce(v ->> 'decision', '') not in ('pausar', 'manter', 'escalar')
       or char_length(btrim(coalesce(v ->> 'target', ''))) not between 2 and 200
       or char_length(btrim(coalesce(v ->> 'why', ''))) not between 3 and 1000 then
      return 'Cada decisão precisa do nível, do nome, da decisão e do motivo.';
    end if;
  end loop;
  return null;
end;
$$;

-- Organização, autor, hora, contagem de problemas e período vêm do servidor.
create or replace function private.traffic_check_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_err text;
begin
  if tg_op = 'UPDATE' then
    new.client_id := old.client_id;
    new.kind := old.kind;
    new.period_on := old.period_on;
    new.created_at := old.created_at;
  end if;
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  v_err := private.traffic_check_error(new.kind, new.items, new.decisions);
  if v_err is not null then raise exception '%', v_err using errcode = 'P0001'; end if;
  if new.period_on > private.today_sp() then raise exception 'Não dá para fazer o checklist de um dia que ainda não chegou.' using errcode = 'P0001'; end if;
  if new.kind = 'semanal' and extract(isodow from new.period_on) <> 1 then
    raise exception 'O checklist semanal vale a partir da segunda-feira.' using errcode = 'P0001';
  end if;
  new.problems := (select count(*) from jsonb_array_elements(new.items) x where x ->> 'status' = 'problema');
  new.done_by := coalesce(auth.uid(), new.done_by);
  new.done_at := now();
  return new;
end;
$$;
create trigger traffic_checks_defaults before insert or update on public.traffic_checks
  for each row execute function private.traffic_check_defaults();

-- Problema vai para o histórico do cliente; saldo/cobrança com problema avisa o responsável pela comunicação.
create or replace function private.traffic_check_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_labels text;
  v_saldo jsonb;
begin
  if new.problems = 0 or (tg_op = 'UPDATE' and old.items = new.items) then return null; end if;
  select * into v_client from public.clients where id = new.client_id;
  select string_agg(case x ->> 'key'
           when 'saldo' then 'saldo e cobrança' when 'reprovados' then 'anúncios reprovados'
           when 'gasto' then 'gasto x orçamento' when 'entrega' then 'entrega parada'
           when 'criativos' then 'criativos' when 'publicos' then 'públicos' else 'custos' end, ', ')
    into v_labels
    from jsonb_array_elements(new.items) x where x ->> 'status' = 'problema';
  perform private.timeline(new.client_id, 'trafego',
    case new.kind when 'diario' then 'Checklist diário de ' || to_char(new.period_on, 'DD/MM')
                  else 'Checklist da semana de ' || to_char(new.period_on, 'DD/MM') end
    || ': problema em ' || v_labels);
  select x into v_saldo from jsonb_array_elements(new.items) x where x ->> 'key' = 'saldo' and x ->> 'status' = 'problema';
  if v_saldo is not null and v_client.owner_id is not null then
    perform public.notify_users(array[v_client.owner_id], 'ad_alert', 'Saldo ou cobrança: ' || v_client.name,
      'O tráfego apontou: ' || (v_saldo ->> 'note') || '. Fale com o cliente sobre o pagamento.',
      '/clientes/' || new.client_id || '/trafego', 'traffic_saldo:' || new.client_id || ':' || new.period_on, auth.uid());
  end if;
  return null;
end;
$$;
create trigger traffic_checks_events after insert or update on public.traffic_checks
  for each row execute function private.traffic_check_events();

alter table public.traffic_checks enable row level security;
create policy traffic_checks_select on public.traffic_checks for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id));
create policy traffic_checks_insert on public.traffic_checks for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy traffic_checks_update on public.traffic_checks for update to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke all on public.traffic_checks from anon, authenticated;
grant select on public.traffic_checks to authenticated;
grant insert (client_id, kind, period_on, items, decisions, notes) on public.traffic_checks to authenticated;
grant update (items, decisions, notes) on public.traffic_checks to authenticated;

-- Clientes com tráfego que entram na rotina: ativos, com serviço de anúncios vigente.
create or replace function private.traffic_routine_clients()
returns setof public.clients
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.clients c
   where c.deleted_at is null and c.status = 'ativo'
     and 'anuncios' = any (private.client_service_tabs(c.id));
$$;
revoke all on function private.traffic_routine_clients() from public, anon, authenticated;

-- Painel de pendências (RF-OTI-04): para quem otimiza, os clientes dele com o checklist de hoje e o da semana.
create or replace function public.traffic_routine()
returns table (
  client_id uuid, client_name text, client_code int, team text[],
  daily_id uuid, daily_done_at timestamptz, daily_problems int, daily_by text,
  weekly_id uuid, weekly_done_at timestamptz, weekly_problems int, weekly_decisions int, weekly_by text,
  last_daily_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select private.today_sp() as today, date_trunc('week', private.today_sp())::date as monday)
  select c.id, c.name, c.code,
         coalesce((select array_agg(p.full_name order by p.full_name) from public.client_members m
                     join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
                     join public.profiles p on p.id = m.profile_id and p.is_active
                    where m.client_id = c.id), '{}'),
         dc.id, dc.done_at, dc.problems, dp.full_name,
         wc.id, wc.done_at, wc.problems, coalesce(jsonb_array_length(wc.decisions), 0), wp.full_name,
         (select max(x.period_on) from public.traffic_checks x where x.client_id = c.id and x.kind = 'diario')
    from private.traffic_routine_clients() c
    cross join d
    left join public.traffic_checks dc on dc.client_id = c.id and dc.kind = 'diario' and dc.period_on = d.today
    left join public.profiles dp on dp.id = dc.done_by
    left join public.traffic_checks wc on wc.client_id = c.id and wc.kind = 'semanal' and wc.period_on = d.monday
    left join public.profiles wp on wp.id = wc.done_by
   where private.can_client('optimization.manage', c.id)
   order by c.name;
$$;
revoke all on function public.traffic_routine() from public, anon;
grant execute on function public.traffic_routine() to authenticated;

-- Lembretes (dias úteis, 11h): checklist diário de hoje em aberto; no último dia útil da semana, o semanal.
-- Vai para a equipe de tráfego de cada cliente, um aviso por pessoa com a lista.
create or replace function private.traffic_checks_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
  v_monday date := date_trunc('week', private.today_sp())::date;
  v_last_day boolean;
  r record;
begin
  if not private.is_business_day(v_today) then return; end if;
  v_last_day := not exists (select 1 from generate_series(v_today + 1, v_monday + 6, interval '1 day') g where private.is_business_day(g::date));

  for r in
    select m.profile_id, array_agg(distinct c.name order by c.name) as names
      from private.traffic_routine_clients() c
      join public.client_members m on m.client_id = c.id
      join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
     where not exists (select 1 from public.traffic_checks x where x.client_id = c.id and x.kind = 'diario' and x.period_on = v_today)
     group by m.profile_id
  loop
    perform public.notify_users(array[r.profile_id], 'traffic_check',
      'Checklist diário do tráfego: ' || cardinality(r.names) || case when cardinality(r.names) = 1 then ' cliente' else ' clientes' end || ' em aberto',
      array_to_string(r.names[1:8], ', ') || case when cardinality(r.names) > 8 then ' e mais ' || (cardinality(r.names) - 8) else '' end || '.',
      '/trafego', 'traffic_daily:' || v_today, null);
  end loop;

  if not v_last_day then return; end if;
  for r in
    select m.profile_id, array_agg(distinct c.name order by c.name) as names
      from private.traffic_routine_clients() c
      join public.client_members m on m.client_id = c.id
      join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
     where not exists (select 1 from public.traffic_checks x where x.client_id = c.id and x.kind = 'semanal' and x.period_on = v_monday)
     group by m.profile_id
  loop
    perform public.notify_users(array[r.profile_id], 'traffic_check',
      'Checklist semanal do tráfego: ' || cardinality(r.names) || case when cardinality(r.names) = 1 then ' cliente' else ' clientes' end || ' em aberto',
      'Último dia útil da semana. ' || array_to_string(r.names[1:8], ', ') || case when cardinality(r.names) > 8 then ' e mais ' || (cardinality(r.names) - 8) else '' end || '.',
      '/trafego', 'traffic_weekly:' || v_monday, null);
  end loop;
end;
$$;
revoke all on function private.traffic_checks_tick() from public, anon, authenticated;

-- Dias úteis às 11h (Brasília = UTC-3)
select cron.schedule('extend-checklists-trafego', '0 14 * * 1-5', $$select private.traffic_checks_tick()$$);
