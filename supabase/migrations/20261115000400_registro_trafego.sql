-- Briefing do Luiz, item 6 e 2ª fase: registro de alterações do tráfego (RF-OTI-03, parte manual) e
-- aprovações de verba do cliente (RF-T2-03). A parte automática (mudança de orçamento/status detectada
-- na sincronização, source = 'sync') e o alerta de gasto acima da verba entram com a sincronização.

create table public.change_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  ad_account_id   uuid references public.ad_accounts (id) on delete set null,
  platform        text check (platform in ('meta', 'google', 'outra')),
  category        text not null check (category in ('orcamento', 'campanha', 'publico', 'criativo', 'lance', 'pausa', 'ativacao', 'rastreamento', 'outro')),
  happened_on     date not null default private.today_sp(),
  what            text not null check (char_length(what) between 3 and 500),
  why             text not null check (char_length(why) between 3 and 1000),
  source          text not null default 'manual' check (source in ('manual', 'sync')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index change_logs_client on public.change_logs (client_id, happened_on desc, created_at desc);
create trigger change_logs_updated_at before update on public.change_logs for each row execute function private.set_updated_at();

create table public.budget_approvals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  amount_cents    bigint not null check (amount_cents > 0),
  platform        text not null check (platform in ('meta', 'google', 'todas')),
  period_start    date not null,
  period_end      date not null,
  approved_by     text not null check (char_length(approved_by) between 2 and 120),
  approved_on     date not null,
  channel         text not null check (channel in ('whatsapp', 'email', 'reuniao', 'ligacao', 'outro')),
  notes           text check (char_length(notes) <= 1000),
  proof_file_id   uuid references public.client_files (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (period_end >= period_start)
);
create index budget_approvals_client on public.budget_approvals (client_id, period_start desc);
create trigger budget_approvals_updated_at before update on public.budget_approvals for each row execute function private.set_updated_at();
create trigger audit_budget_approvals after insert or update or delete on public.budget_approvals
  for each row execute function private.audit_row('', 'amount_cents,platform,period_start,period_end,approved_by,approved_on');

-- Organização, autor e origem vêm do servidor, não do formulário.
create or replace function private.traffic_row_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if tg_table_name = 'change_logs' and auth.uid() is not null then new.source := 'manual'; end if;
  else
    new.created_by := old.created_by;
    new.client_id := old.client_id;
    new.organization_id := old.organization_id;
    if tg_table_name = 'change_logs' then new.source := old.source; end if;
  end if;
  if tg_table_name = 'change_logs' then
    if new.ad_account_id is not null
       and not exists (select 1 from public.ad_accounts a where a.id = new.ad_account_id and a.client_id = new.client_id) then
      raise exception 'Esta conta de anúncio não é deste cliente.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger change_logs_defaults before insert or update on public.change_logs for each row execute function private.traffic_row_defaults();
create trigger budget_approvals_defaults before insert or update on public.budget_approvals for each row execute function private.traffic_row_defaults();

-- Linha do tempo do cliente e aviso à equipe de tráfego.
create or replace function private.traffic_row_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client text;
  v_users uuid[];
begin
  if tg_table_name = 'change_logs' then
    perform private.timeline(new.client_id, 'trafego', 'Alteração no tráfego: ' || new.what);
    return null;
  end if;
  select name into v_client from public.clients where id = new.client_id;
  perform private.timeline(new.client_id, 'trafego',
    'Verba aprovada: R$ ' || translate(to_char(new.amount_cents / 100.0, 'FM999G999G990D00'), ',.', '.,') || ' de '
    || to_char(new.period_start, 'DD/MM/YYYY') || ' a ' || to_char(new.period_end, 'DD/MM/YYYY') || ' (' || new.approved_by || ')');
  select array_agg(distinct m.profile_id) into v_users
    from public.client_members m join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
   where m.client_id = new.client_id;
  if v_users is not null then
    perform public.notify_users(v_users, 'ad_alert', 'Verba aprovada: ' || v_client,
      'R$ ' || translate(to_char(new.amount_cents / 100.0, 'FM999G999G990D00'), ',.', '.,') || ' de ' || to_char(new.period_start, 'DD/MM') || ' a '
      || to_char(new.period_end, 'DD/MM') || ', aprovada por ' || new.approved_by || '.',
      '/clientes/' || new.client_id || '/trafego', 'verba:' || new.id, auth.uid());
  end if;
  return null;
end;
$$;
create trigger change_logs_events after insert on public.change_logs for each row execute function private.traffic_row_events();
create trigger budget_approvals_events after insert on public.budget_approvals for each row execute function private.traffic_row_events();

-- RLS: lê quem vê o tráfego do cliente; registra quem otimiza as contas do cliente.
-- Alteração: só quem registrou muda ou apaga (registros automáticos não mudam). Verba: quem otimiza o cliente.
alter table public.change_logs enable row level security;
create policy change_logs_select on public.change_logs for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id));
create policy change_logs_insert on public.change_logs for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy change_logs_update on public.change_logs for update to authenticated
  using (source = 'manual' and created_by = (select auth.uid()) and private.can_client('optimization.manage', client_id));
create policy change_logs_delete on public.change_logs for delete to authenticated
  using (source = 'manual' and created_by = (select auth.uid()) and private.can_client('optimization.manage', client_id));
revoke all on public.change_logs from anon, authenticated;
grant select, delete on public.change_logs to authenticated;
grant insert (client_id, ad_account_id, platform, category, happened_on, what, why) on public.change_logs to authenticated;
grant update (ad_account_id, platform, category, happened_on, what, why) on public.change_logs to authenticated;

alter table public.budget_approvals enable row level security;
create policy budget_approvals_select on public.budget_approvals for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id));
create policy budget_approvals_insert on public.budget_approvals for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy budget_approvals_update on public.budget_approvals for update to authenticated
  using (private.can_client('optimization.manage', client_id));
create policy budget_approvals_delete on public.budget_approvals for delete to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke all on public.budget_approvals from anon, authenticated;
grant select, delete on public.budget_approvals to authenticated;
grant insert (client_id, amount_cents, platform, period_start, period_end, approved_by, approved_on, channel, notes, proof_file_id) on public.budget_approvals to authenticated;
grant update (amount_cents, platform, period_start, period_end, approved_by, approved_on, channel, notes, proof_file_id) on public.budget_approvals to authenticated;

-- O gatilho acima sempre usa a organização do cliente; o padrão só deixa a coluna opcional no insert.
alter table public.change_logs alter column organization_id set default private.org_id();
alter table public.budget_approvals alter column organization_id set default private.org_id();
