-- Prospectador (RF-CRM-07): busca de empresas no Google Places (API da Extend), com limite mensal de buscas,
-- score de oportunidade e importação para o funil sem repetir.
--   prospect_searches: cada busca feita (conta para o limite do mês e mostra o histórico).
--   prospect_places:   locais do Google já levados ao Comercial (marca "já importado" nas buscas seguintes).

create table public.prospect_searches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  query           text not null check (char_length(query) between 2 and 200),
  city            text not null check (char_length(city) between 2 and 120),
  uf              text not null check (uf ~ '^[A-Z]{2}$'),
  pages           int not null default 1 check (pages between 1 and 3),
  result_count    int not null default 0 check (result_count >= 0),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index prospect_searches_org_idx on public.prospect_searches (organization_id, created_at desc);
alter table public.prospect_searches enable row level security;

create policy prospect_searches_read on public.prospect_searches for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('prospector.use')));
-- Gravação só pelo servidor (service role), depois de conferir o limite.

create table public.prospect_places (
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  place_id        text not null check (char_length(place_id) between 5 and 300),
  name            text not null check (char_length(name) between 1 and 200),
  lead_import_id  uuid references public.lead_imports (id) on delete set null,
  imported_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  imported_at     timestamptz not null default now(),
  primary key (organization_id, place_id)
);
alter table public.prospect_places enable row level security;

create policy prospect_places_read on public.prospect_places for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('prospector.use')));

/** Marca os locais importados (chamado logo depois de import_leads, pela mesma pessoa). */
create or replace function public.mark_prospect_places(p_import uuid, p_places jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_n int;
begin
  if not (private.has_perm('prospector.use') and private.has_perm('crm.leads.manage')) then
    raise exception 'Você não tem permissão para importar do prospectador.' using errcode = '42501';
  end if;
  if p_import is not null and not exists (select 1 from public.lead_imports where id = p_import and organization_id = v_org) then
    raise exception 'Importação não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_places) <> 'array' or jsonb_array_length(p_places) > 200 then
    raise exception 'Lista de locais inválida.' using errcode = 'P0001';
  end if;
  insert into public.prospect_places (organization_id, place_id, name, lead_import_id, imported_by)
  select v_org, left(p ->> 'id', 300), left(coalesce(nullif(btrim(p ->> 'name'), ''), '—'), 200), p_import, auth.uid()
    from jsonb_array_elements(p_places) p
   where char_length(coalesce(p ->> 'id', '')) between 5 and 300
  on conflict (organization_id, place_id) do update set lead_import_id = excluded.lead_import_id, imported_by = excluded.imported_by, imported_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.mark_prospect_places(uuid, jsonb) to authenticated;

/** Buscas feitas no mês corrente (fuso de São Paulo), para o limite. */
create or replace function public.prospector_month_usage()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.has_perm('prospector.use') then
    (select coalesce(sum(pages), 0)::int from public.prospect_searches
      where organization_id = private.org_id()
        and created_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
  else 0 end;
$$;
grant execute on function public.prospector_month_usage() to authenticated;

-- Desfazer a importação libera os locais para importar de novo.
create or replace function private.prospect_places_on_undo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.undone_at is not null and old.undone_at is null then
    delete from public.prospect_places where lead_import_id = new.id;
  end if;
  return new;
end;
$$;
create trigger lead_imports_prospect_undo after update of undone_at on public.lead_imports
  for each row execute function private.prospect_places_on_undo();

-- Retenção: buscas com mais de 1 ano saem (o histórico é só para o limite e a consulta recente).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('extend-prospectador-limpeza', '20 4 * * *', $c$delete from public.prospect_searches where created_at < now() - interval '1 year'$c$);
  end if;
end;
$$;
