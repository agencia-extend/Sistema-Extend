-- RF-ADS-11: gerador de links com UTM por cliente e lista dos links gerados.
-- A URL final é montada no servidor (src/domain/traffic/utm.ts); o banco confere que ela parte do destino
-- informado e tem as UTMs obrigatórias, e não deixa gerar o mesmo link duas vezes no cliente.

create table public.utm_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  label           text not null check (char_length(label) between 2 and 120),
  platform        text not null check (platform in ('meta', 'google', 'outro')),
  base_url        text not null check (base_url ~ '^https?://' and char_length(base_url) <= 2000),
  source          text not null check (char_length(source) between 1 and 200),
  medium          text not null check (char_length(medium) between 1 and 200),
  campaign        text not null check (char_length(campaign) between 1 and 300),
  term            text check (char_length(term) <= 300),
  content         text check (char_length(content) <= 300),
  url             text not null check (char_length(url) <= 4000),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint utm_links_unique unique (client_id, url)
);
create index utm_links_client on public.utm_links (client_id, created_at desc);

create or replace function private.utm_link_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  new.created_by := coalesce(auth.uid(), new.created_by);
  if position(split_part(split_part(new.base_url, '#', 1), '?', 1) in new.url) <> 1
     or new.url !~ '[?&]utm_source=' or new.url !~ '[?&]utm_medium=' or new.url !~ '[?&]utm_campaign=' then
    raise exception 'O link não corresponde ao destino e às UTMs informadas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger utm_links_defaults before insert on public.utm_links for each row execute function private.utm_link_defaults();

-- Lê quem vê o tráfego do cliente; gera e apaga quem otimiza as contas dele. Link não se edita: gera outro.
alter table public.utm_links enable row level security;
create policy utm_links_select on public.utm_links for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id));
create policy utm_links_insert on public.utm_links for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy utm_links_delete on public.utm_links for delete to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke all on public.utm_links from anon, authenticated;
grant select, delete on public.utm_links to authenticated;
grant insert (client_id, label, platform, base_url, source, medium, campaign, term, content, url) on public.utm_links to authenticated;
