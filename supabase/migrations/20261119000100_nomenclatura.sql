-- Nomenclatura padrão (RF-PLA-03): o padrão de nome de campanha, conjunto e anúncio da agência. Quem conecta as
-- contas (admin e gerente de tráfego) edita; quem vê os anúncios lê (gerador e verificador). As peças entre chaves
-- são conferidas no servidor (src/domain/ads/naming.ts); aqui, tamanho e caracteres.

create table public.naming_conventions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  campaign        text not null default '{CLIENTE}_{OBJETIVO}_{PUBLICO}_{AAAA-MM}' check (char_length(campaign) between 3 and 120 and campaign ~ '^[A-Za-z0-9{}#_|. -]+$'),
  adset           text not null default '{PUBLICO}_{POSICIONAMENTO}_{IDADE}' check (char_length(adset) between 3 and 120 and adset ~ '^[A-Za-z0-9{}#_|. -]+$'),
  ad              text not null default '{FORMATO}_{ANGULO}_{V#}' check (char_length(ad) between 3 and 120 and ad ~ '^[A-Za-z0-9{}#_|. -]+$'),
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now()
);
create trigger audit_naming_conventions after insert or update on public.naming_conventions for each row execute function private.audit_row();
alter table public.naming_conventions enable row level security;
revoke all on public.naming_conventions from anon, authenticated;
grant select on public.naming_conventions to authenticated;
create policy naming_conventions_select on public.naming_conventions for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('ads.read')));

create or replace function public.save_naming_convention(p_campaign text, p_adset text, p_ad text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('ads.connect') then
    raise exception 'Só quem configura as contas de anúncio muda a nomenclatura.' using errcode = '42501';
  end if;
  insert into public.naming_conventions (organization_id, campaign, adset, ad, updated_by)
  values (private.org_id(), btrim(p_campaign), btrim(p_adset), btrim(p_ad), auth.uid())
  on conflict (organization_id) do update set campaign = excluded.campaign, adset = excluded.adset, ad = excluded.ad,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.save_naming_convention(text, text, text) from public, anon;
grant execute on function public.save_naming_convention(text, text, text) to authenticated;
