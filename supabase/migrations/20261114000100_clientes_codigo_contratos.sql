-- Central do cliente (parte A): código, responsável pela comunicação, escopo em texto
-- e histórico de contratos com renovação e aviso de fim de contrato.

-- -----------------------------------------------------------------------------
-- Cliente: código, responsável pela comunicação e escopo
-- -----------------------------------------------------------------------------
alter table public.clients
  add column code int check (code between 1 and 99999),
  add column owner_id uuid references public.profiles (id) on delete set null,
  add column scope_text text check (char_length(scope_text) <= 500);

-- Códigos para os clientes que já existem, na ordem em que entraram.
update public.clients c set code = n.rn
  from (select id, row_number() over (partition by organization_id order by created_at, name) rn from public.clients) n
 where n.id = c.id;

create unique index clients_code_uq on public.clients (organization_id, code);
create index clients_owner_idx on public.clients (owner_id) where deleted_at is null;

-- Cliente novo recebe o próximo código da organização.
create or replace function private.client_next_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is null then
    perform pg_advisory_xact_lock(hashtext('client_code:' || new.organization_id));
    select coalesce(max(code), 0) + 1 into new.code from public.clients where organization_id = new.organization_id;
  end if;
  return new;
end;
$$;
create trigger clients_next_code before insert on public.clients for each row execute function private.client_next_code();

grant update (code, owner_id, scope_text) on public.clients to authenticated;

-- O responsável precisa ser alguém ativo da mesma organização.
create or replace function private.client_owner_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id
     and not exists (select 1 from public.profiles p where p.id = new.owner_id and p.organization_id = new.organization_id and p.is_active) then
    raise exception 'Escolha alguém ativo da equipe como responsável.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger clients_owner_check before update of owner_id on public.clients for each row execute function private.client_owner_check();

-- Novo responsável pela comunicação é avisado.
create or replace function private.client_owner_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id then
    perform private.notify(array[new.owner_id], 'client_onboarding', 'Você é o responsável pela comunicação com ' || new.name,
      'É você quem atende este cliente. Os avisos de contrato chegam para você.', '/clientes/' || new.id, 'client_owner:' || new.id || ':' || new.owner_id);
  end if;
  return new;
end;
$$;
create trigger clients_owner_notify after update of owner_id on public.clients for each row execute function private.client_owner_notify();

-- -----------------------------------------------------------------------------
-- Contratos
-- -----------------------------------------------------------------------------
create table public.client_contracts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  starts_on         date not null,
  ends_on           date,
  scope_text        text check (char_length(scope_text) <= 500),
  monthly_fee_cents bigint check (monthly_fee_cents >= 0),
  notes             text check (char_length(notes) <= 2000),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index client_contracts_client_idx on public.client_contracts (client_id, starts_on desc);
alter table public.client_contracts enable row level security;

create policy client_contracts_select on public.client_contracts for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
create policy client_contracts_write on public.client_contracts for all to authenticated
  using ((select private.can_manage_client(client_id)))
  with check ((select private.can_manage_client(client_id)));

-- O valor só aparece para quem vê valores (mesma regra da Visão geral): por função, não pela tabela.
grant select (id, client_id, starts_on, ends_on, scope_text, notes, created_by, created_at) on public.client_contracts to authenticated;
grant insert (client_id, starts_on, ends_on, scope_text, monthly_fee_cents, notes) on public.client_contracts to authenticated;
grant update (starts_on, ends_on, scope_text, monthly_fee_cents, notes) on public.client_contracts to authenticated;
grant delete on public.client_contracts to authenticated;

create or replace function public.client_contract_fees(p_client uuid)
returns table (id uuid, monthly_fee_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.monthly_fee_cents from public.client_contracts c
  where c.client_id = p_client and private.can_client('clients.onboarding.read', p_client);
$$;
revoke all on function public.client_contract_fees(uuid) from public, anon;
grant execute on function public.client_contract_fees(uuid) to authenticated;

-- Contratos do mesmo cliente não se sobrepõem.
create or replace function private.contract_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.client_contracts o
     where o.client_id = new.client_id and o.id <> new.id
       and daterange(o.starts_on, coalesce(o.ends_on, 'infinity'::date), '[]') && daterange(new.starts_on, coalesce(new.ends_on, 'infinity'::date), '[]')
  ) then
    raise exception 'As datas se sobrepõem a outro contrato deste cliente. O novo contrato precisa começar depois do fim do anterior.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger client_contracts_no_overlap before insert or update of starts_on, ends_on on public.client_contracts
  for each row execute function private.contract_no_overlap();

-- O contrato mais recente alimenta o cadastro (fim, renovação, mensalidade e escopo).
-- O início do relacionamento (clients.contract_start) fica: ele ancora o ciclo do mês do cliente.
create or replace function private.contract_sync_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := coalesce(new.client_id, old.client_id);
  v_cur public.client_contracts;
begin
  select * into v_cur from public.client_contracts where client_id = v_client order by starts_on desc limit 1;
  if v_cur.id is null then return null; end if;
  update public.clients
     set contract_end = v_cur.ends_on,
         renewal_date = case when v_cur.ends_on is not null then v_cur.ends_on - 30 end,
         monthly_fee_cents = coalesce(v_cur.monthly_fee_cents, monthly_fee_cents),
         scope_text = coalesce(v_cur.scope_text, scope_text),
         contract_start = coalesce(contract_start, (select min(starts_on) from public.client_contracts where client_id = v_client))
   where id = v_client;
  if tg_op = 'INSERT' and exists (select 1 from public.client_contracts where client_id = v_client and id <> new.id) then
    perform private.timeline(v_client, 'contract', 'Contrato renovado: ' || to_char(new.starts_on, 'DD/MM/YYYY')
      || coalesce(' a ' || to_char(new.ends_on, 'DD/MM/YYYY'), ''), jsonb_build_object('contract_id', new.id));
  end if;
  return null;
end;
$$;
create trigger client_contracts_sync after insert or update or delete on public.client_contracts
  for each row execute function private.contract_sync_client();

-- Contratos que já existem no cadastro viram o primeiro contrato de cada cliente.
insert into public.client_contracts (client_id, starts_on, ends_on, monthly_fee_cents, created_by)
select c.id, c.contract_start, c.contract_end, c.monthly_fee_cents, c.created_by
  from public.clients c
 where c.contract_start is not null and c.deleted_at is null
   and (c.contract_end is null or c.contract_end >= c.contract_start);

-- Fechamento comercial cria o primeiro contrato junto com o cliente.
create or replace function private.client_first_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contract_start is not null and not exists (select 1 from public.client_contracts where client_id = new.id) then
    insert into public.client_contracts (client_id, starts_on, ends_on, monthly_fee_cents, created_by)
    values (new.id, new.contract_start, new.contract_end, new.monthly_fee_cents, new.created_by);
  end if;
  return new;
end;
$$;
create trigger clients_first_contract after insert on public.clients for each row execute function private.client_first_contract();

-- -----------------------------------------------------------------------------
-- Aviso de fim de contrato: 30 e 7 dias antes e no dia seguinte ao fim sem renovação
-- -----------------------------------------------------------------------------
create or replace function private.contracts_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
begin
  perform private.notify(
    array_remove(private.onboarding_recipients(c.organization_id) || c.owner_id, null),
    'client_onboarding',
    case when k.ends_on < v_today then 'Contrato de ' || c.name || ' venceu sem renovação'
         else 'Contrato de ' || c.name || ' termina em ' || (k.ends_on - v_today) || ' dias' end,
    'Fim em ' || to_char(k.ends_on, 'DD/MM/YYYY') || '. Combine a renovação e registre em Contratos.',
    '/clientes/' || c.id || '/contratos',
    'contract_end:' || k.id || ':' || case when k.ends_on < v_today then 'venceu' when k.ends_on - v_today <= 7 then '7' else '30' end)
  from public.clients c
  join lateral (select * from public.client_contracts x where x.client_id = c.id order by x.starts_on desc limit 1) k on true
  where c.deleted_at is null and c.status in ('ativo', 'onboarding', 'pausado') and k.ends_on is not null
    and (k.ends_on - v_today in (30, 7) or k.ends_on = v_today - 1);
end;
$$;

select cron.schedule('extend-contratos', '0 9 * * *', $$select private.contracts_tick()$$);
