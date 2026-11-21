-- Qualidade dos leads dos clientes (RF-T2-01). Os leads que as campanhas do cliente geram (planilha exportada da
-- Central de leads da Meta ou do CRM do cliente) entram por cliente, sem duplicar, e ficam ligados à campanha das contas
-- dele. O cliente avalia cada lead por um link público (bom, médio, ruim, não atendeu + comentário) e a equipe vê, por
-- campanha, a % de qualificados e o custo por lead qualificado. Não é o funil comercial da Extend (tabela leads).

create table public.client_leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  client_id        uuid not null references public.clients (id) on delete cascade,
  external_key     text not null check (char_length(external_key) between 1 and 200),
  name             text check (char_length(name) <= 200),
  phone            text check (char_length(phone) <= 40),
  email            text check (char_length(email) <= 200),
  lead_at          timestamptz not null,
  campaign_ext_id  text check (char_length(campaign_ext_id) <= 64),
  campaign_name    text check (char_length(campaign_name) <= 300),
  ad_name          text check (char_length(ad_name) <= 300),
  form_name        text check (char_length(form_name) <= 300),
  campaign_id      uuid references public.ad_campaigns (id) on delete set null,
  quality          text check (quality in ('bom', 'medio', 'ruim', 'nao_atendeu')),
  quality_note     text check (char_length(quality_note) <= 1000),
  rated_at         timestamptz,
  rated_by         uuid references public.profiles (id) on delete set null,
  rated_by_name    text check (char_length(rated_by_name) <= 120),
  import_batch     uuid,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (client_id, external_key),
  check (name is not null or phone is not null or email is not null)
);
create index client_leads_client_idx on public.client_leads (client_id, lead_at desc);
create index client_leads_campaign_idx on public.client_leads (campaign_id) where campaign_id is not null;

-- Campanha do lead: pelo id da Meta (quando a planilha traz) ou pelo nome, nas contas do cliente.
create or replace function private.client_lead_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select o.organization_id into new.organization_id from public.clients o where o.id = new.client_id;
  if tg_op = 'INSERT' or new.campaign_name is distinct from old.campaign_name or new.campaign_ext_id is distinct from old.campaign_ext_id then
    select c.id into new.campaign_id
      from public.ad_campaigns c join public.ad_accounts a on a.id = c.ad_account_id
     where a.client_id = new.client_id
       and ((new.campaign_ext_id is not null and c.external_id = new.campaign_ext_id)
            or (new.campaign_name is not null and lower(btrim(c.name)) = lower(btrim(new.campaign_name))))
     order by (c.external_id = new.campaign_ext_id) desc nulls last
     limit 1;
  end if;
  if new.quality is distinct from (case when tg_op = 'UPDATE' then old.quality end) then
    new.rated_at := case when new.quality is null then null else now() end;
    if auth.uid() is not null then new.rated_by := auth.uid(); new.rated_by_name := null; end if;
    if new.quality is null then new.rated_by := null; new.rated_by_name := null; new.quality_note := null; end if;
  end if;
  return new;
end;
$$;
create trigger client_leads_defaults before insert or update on public.client_leads
  for each row execute function private.client_lead_defaults();

-- Campanha que chega depois pela sincronização liga os leads que estavam sem campanha.
create or replace function private.client_leads_link_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.client_leads l set campaign_id = new.id
    from public.ad_accounts a
   where a.id = new.ad_account_id and l.client_id = a.client_id and l.campaign_id is null
     and ((l.campaign_ext_id is not null and l.campaign_ext_id = new.external_id)
          or (l.campaign_name is not null and lower(btrim(l.campaign_name)) = lower(btrim(new.name))));
  return new;
end;
$$;
create trigger ad_campaigns_client_leads after insert on public.ad_campaigns
  for each row execute function private.client_leads_link_campaign();

alter table public.client_leads enable row level security;
create policy client_leads_select on public.client_leads for select to authenticated
  using (organization_id = (select private.org_id())
         and (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id)));
create policy client_leads_insert on public.client_leads for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy client_leads_update on public.client_leads for update to authenticated
  using (private.can_client('optimization.manage', client_id)) with check (private.can_client('optimization.manage', client_id));
create policy client_leads_delete on public.client_leads for delete to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke insert, update on public.client_leads from authenticated;
grant insert (organization_id, client_id, external_key, name, phone, email, lead_at, campaign_ext_id, campaign_name, ad_name, form_name, import_batch, created_by)
  on public.client_leads to authenticated;
grant update (quality, quality_note) on public.client_leads to authenticated;

-- Link de avaliação: um ativo por cliente; criar outro cancela o anterior. Só o hash do código fica no banco.
create table public.lead_review_links (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  last_used_at timestamptz
);
create unique index lead_review_links_active on public.lead_review_links (client_id) where revoked_at is null;
alter table public.lead_review_links enable row level security;
create policy lead_review_links_select on public.lead_review_links for select to authenticated
  using (private.can_client('optimization.manage', client_id));
revoke insert, update, delete on public.lead_review_links from authenticated;
revoke select on public.lead_review_links from authenticated;
grant select (id, client_id, created_by, created_at, revoked_at, last_used_at) on public.lead_review_links to authenticated;

create or replace function public.create_lead_review_link(p_client uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_client('optimization.manage', p_client) then
    raise exception 'Você não cuida das campanhas deste cliente.' using errcode = '42501';
  end if;
  update public.lead_review_links set revoked_at = now() where client_id = p_client and revoked_at is null;
  insert into public.lead_review_links (client_id, token_hash, created_by) values (p_client, p_token_hash, auth.uid());
  perform private.timeline(p_client, 'trafego', 'Link de avaliação de leads criado');
end;
$$;

create or replace function public.revoke_lead_review_link(p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_client('optimization.manage', p_client) then
    raise exception 'Você não cuida das campanhas deste cliente.' using errcode = '42501';
  end if;
  update public.lead_review_links set revoked_at = now() where client_id = p_client and revoked_at is null;
end;
$$;

-- Avaliação pelo link público (chamada pelo servidor com a chave secreta, depois do limite de tentativas).
-- Avisa a equipe de tráfego do cliente uma vez por dia.
create or replace function public.rate_client_lead(p_token_hash text, p_lead uuid, p_quality text, p_note text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.lead_review_links;
  v_lead public.client_leads;
  v_team uuid[];
  v_client text;
begin
  select * into v_link from public.lead_review_links where token_hash = p_token_hash;
  if v_link.id is null then return 'invalido'; end if;
  if v_link.revoked_at is not null then return 'cancelado'; end if;
  if p_quality is not null and p_quality not in ('bom', 'medio', 'ruim', 'nao_atendeu') then
    raise exception 'Avaliação inválida.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Diga seu nome.' using errcode = 'P0001';
  end if;
  select * into v_lead from public.client_leads where id = p_lead and client_id = v_link.client_id for update;
  if v_lead.id is null then return 'invalido'; end if;
  update public.client_leads
     set quality = p_quality, quality_note = nullif(left(btrim(coalesce(p_note, '')), 1000), ''), rated_by = null,
         rated_by_name = case when p_quality is null then null else left(btrim(p_name), 120) end
   where id = p_lead;
  update public.lead_review_links set last_used_at = now() where id = v_link.id;

  select name into v_client from public.clients where id = v_link.client_id;
  select coalesce(array_agg(distinct m.profile_id), '{}') into v_team
    from public.client_members m join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
   where m.client_id = v_link.client_id;
  perform public.notify_users(v_team, 'ad_alert', v_client || ' avaliou leads',
    left(btrim(p_name), 120) || ' está avaliando os leads pelo link.',
    '/clientes/' || v_link.client_id || '/trafego#leads',
    'leadrate:' || v_link.client_id || ':' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'), null);
  return 'ok';
end;
$$;

revoke all on function public.create_lead_review_link(uuid, text) from public, anon;
revoke all on function public.revoke_lead_review_link(uuid) from public, anon;
revoke all on function public.rate_client_lead(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_lead_review_link(uuid, text) to authenticated;
grant execute on function public.revoke_lead_review_link(uuid) to authenticated;
grant execute on function public.rate_client_lead(text, uuid, text, text, text) to service_role;
