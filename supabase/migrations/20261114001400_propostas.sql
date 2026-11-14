-- =============================================================================
-- Etapa 09 — Propostas comerciais (RF-PRO-01 a RF-PRO-06)
-- Modelos versionados por blocos, catálogo com preço, proposta ligada ao lead com versões,
-- link público com registro de visualizações e aceite, vencimento diário.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo comercial: descrição e preço padrão de cada serviço (RF-PRO-02).
-- Fica em tabela própria para que o preço só apareça para quem vê propostas.
-- -----------------------------------------------------------------------------
create table public.service_offers (
  service_id       uuid primary key references public.service_catalog (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  description      text not null default '' check (char_length(description) <= 1000),
  price_cents      bigint check (price_cents is null or price_cents between 0 and 100000000000),
  recurrence       text not null default 'mensal' check (recurrence in ('mensal', 'unico')),
  updated_at       timestamptz not null default now(),
  updated_by       uuid default auth.uid() references public.profiles (id) on delete set null
);

create trigger service_offers_updated_at before update on public.service_offers
  for each row execute function private.set_updated_at();

insert into public.service_offers (service_id, organization_id, description, recurrence)
select sc.id, sc.organization_id, d.descr, d.rec
  from public.service_catalog sc
  join (values
    ('meta_ads', 'Gestão de campanhas no Facebook e no Instagram: estratégia, públicos, acompanhamento diário e otimização para gerar contatos e vendas.', 'mensal'),
    ('google_ads', 'Gestão de campanhas no Google (pesquisa, YouTube e Maps) para aparecer para quem já procura o seu serviço.', 'mensal'),
    ('treinamento', 'Treinamento do time comercial para atender e converter os contatos que chegam pelos anúncios.', 'unico'),
    ('pacote_videos', 'Roteiro, gravação e edição de vídeos para anúncios e redes sociais.', 'mensal'),
    ('conteudo_mensal', 'Planejamento e criação das artes e textos do mês, alinhados à estratégia da marca.', 'mensal'),
    ('gerenciamento', 'Publicação e organização do perfil nas redes sociais, seguindo o cronograma aprovado.', 'mensal'),
    ('site', 'Criação de site ou página de vendas rápida, pensada para converter os visitantes dos anúncios.', 'unico')
  ) as d(key, descr, rec) on d.key = sc.key
on conflict (service_id) do nothing;

-- -----------------------------------------------------------------------------
-- Modelos de proposta (RF-PRO-01). Cada alteração gera uma versão.
-- blocks = [{ id, type, title, body, imagePath }]
-- -----------------------------------------------------------------------------
create table public.proposal_templates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 2 and 80),
  blocks            jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) between 1 and 30),
  whatsapp_message  text not null default 'Olá, {contato}! Segue a proposta da Agência Extend para {cliente}: {link} (válida até {validade}).'
                    check (char_length(whatsapp_message) between 10 and 1000 and position('{link}' in whatsapp_message) > 0),
  validity_days     int not null default 10 check (validity_days between 1 and 90),
  version           int not null default 1,
  is_default        boolean not null default false,
  archived_at       timestamptz,
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, name)
);
create unique index proposal_templates_default_idx on public.proposal_templates (organization_id) where is_default;

create table public.proposal_template_versions (
  template_id       uuid not null references public.proposal_templates (id) on delete cascade,
  version           int not null,
  name              text not null,
  blocks            jsonb not null,
  whatsapp_message  text not null,
  validity_days     int not null,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (template_id, version)
);

create or replace function private.proposal_template_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
    new.version := old.version;
    if new.blocks is distinct from old.blocks or new.name is distinct from old.name
       or new.whatsapp_message is distinct from old.whatsapp_message or new.validity_days is distinct from old.validity_days then
      new.version := old.version + 1;
    end if;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;
create trigger proposal_templates_before before insert or update on public.proposal_templates
  for each row execute function private.proposal_template_before();

create or replace function private.proposal_template_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.proposal_template_versions (template_id, version, name, blocks, whatsapp_message, validity_days, created_by)
    values (new.id, new.version, new.name, new.blocks, new.whatsapp_message, new.validity_days, new.updated_by)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger proposal_templates_after after insert or update on public.proposal_templates
  for each row execute function private.proposal_template_after();

-- Só um modelo padrão por organização: marcar um desmarca os outros.
create or replace function private.proposal_template_single_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.proposal_templates set is_default = false
     where organization_id = new.organization_id and id <> new.id and is_default;
  end if;
  return null;
end;
$$;
create trigger proposal_templates_single_default after insert or update of is_default on public.proposal_templates
  for each row when (new.is_default) execute function private.proposal_template_single_default();

-- Modelo inicial (estrutura das propostas da Extend; o texto é editável em Configurações).
insert into public.proposal_templates (organization_id, name, is_default, blocks, created_by, updated_by)
select o.id, 'Proposta padrão', true, $json$[
  {"id": "capa", "type": "capa", "title": "Proposta comercial", "body": "Preparada para **{cliente}**\nA/C {contato}"},
  {"id": "sobre", "type": "sobre", "title": "Sobre a Agência Extend", "body": "Somos uma agência de marketing focada em resultado: anúncios, conteúdo, vídeos e sites trabalhando juntos para trazer clientes para o seu negócio.\n\n- Estratégia pensada para o seu nicho\n- Equipe própria de tráfego, conteúdo, vídeo e sites\n- Relatórios claros e acompanhamento próximo"},
  {"id": "diagnostico", "type": "diagnostico", "title": "O que entendemos do seu momento", "body": "{observacoes}"},
  {"id": "servicos", "type": "servicos", "title": "O que vamos fazer", "body": "Os serviços abaixo foram escolhidos para o momento da **{cliente}**."},
  {"id": "investimento", "type": "investimento", "title": "Investimento", "body": "Forma de pagamento: {forma_pagamento}"},
  {"id": "condicoes", "type": "condicoes", "title": "Condições", "body": "- O investimento em mídia (valor pago diretamente à Meta e ao Google) não está incluso e é definido junto com você.\n- O contrato é mensal e começa na data do aceite.\n- Esta proposta vale até {validade}."},
  {"id": "proximos", "type": "proximos_passos", "title": "Próximos passos", "body": "- Aceite a proposta pelo botão no fim desta página\n- Assinatura do contrato\n- Reunião de onboarding com a nossa equipe"},
  {"id": "contato", "type": "contato", "title": "Fale com a gente", "body": "{vendedor}\nAgência Extend"}
]$json$::jsonb,
  null, null
  from public.organizations o
 where not exists (select 1 from public.proposal_templates t where t.organization_id = o.id);

-- -----------------------------------------------------------------------------
-- Propostas (RF-PRO-03 a RF-PRO-05)
-- items = [{ serviceId, name, description, priceCents, discountCents, quantity, recurrence }]
-- -----------------------------------------------------------------------------
create table public.proposals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  number           int not null,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  template_id      uuid references public.proposal_templates (id) on delete set null,
  client_name      text not null check (char_length(btrim(client_name)) between 2 and 160),
  contact_name     text not null default '' check (char_length(contact_name) <= 120),
  contact_phone    text check (contact_phone is null or contact_phone ~ '^[0-9]{10,15}$'),
  contact_email    text check (contact_email is null or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  items            jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  payment_terms    text not null default '' check (char_length(payment_terms) <= 300),
  notes            text not null default '' check (char_length(notes) <= 4000),
  valid_until      date not null,
  monthly_cents    bigint not null default 0,
  one_time_cents   bigint not null default 0,
  status           text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada')),
  version          int not null default 0,
  sent_version     int,
  public_token     text not null unique default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
  sent_at          timestamptz,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       int not null default 0,
  accepted_at      timestamptz,
  accepted_name    text,
  accepted_ip      text,
  refused_at       timestamptz,
  refused_reason   text,
  expired_at       timestamptz,
  owner_id         uuid references public.profiles (id) on delete set null,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, number)
);
create index proposals_lead_idx on public.proposals (lead_id);
create index proposals_status_idx on public.proposals (organization_id, status, valid_until);

create table public.proposal_versions (
  proposal_id     uuid not null references public.proposals (id) on delete cascade,
  version         int not null,
  snapshot        jsonb not null,
  monthly_cents   bigint not null,
  one_time_cents  bigint not null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (proposal_id, version)
);

create table public.proposal_views (
  id           bigint generated always as identity primary key,
  proposal_id  uuid not null references public.proposals (id) on delete cascade,
  version      int,
  viewed_at    timestamptz not null default now(),
  ip           text,
  user_agent   text
);
create index proposal_views_proposal_idx on public.proposal_views (proposal_id, viewed_at desc);

-- Quem vê a proposta: escopo "all" ou quem é dono/criou.
create or replace function private.can_proposal(p_key text, p_proposal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proposals x
     where x.id = p_proposal and x.organization_id = private.org_id() and private.has_perm(p_key)
       and (private.perm_scope(p_key) = 'all' or x.owner_id = auth.uid() or x.created_by = auth.uid()));
$$;

alter table public.service_offers enable row level security;
alter table public.proposal_templates enable row level security;
alter table public.proposal_template_versions enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_views enable row level security;

create policy service_offers_select on public.service_offers for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('proposals.read')));
create policy service_offers_write on public.service_offers for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('proposals.templates.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('proposals.templates.manage'))
              and exists (select 1 from public.service_catalog s where s.id = service_id and s.organization_id = (select private.org_id())));

create policy proposal_templates_select on public.proposal_templates for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('proposals.read')));
create policy proposal_templates_write on public.proposal_templates for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('proposals.templates.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('proposals.templates.manage')));
create policy proposal_template_versions_select on public.proposal_template_versions for select to authenticated
  using (exists (select 1 from public.proposal_templates t where t.id = template_id));

create policy proposals_select on public.proposals for select to authenticated
  using ((select private.can_proposal('proposals.read', id)));
create policy proposals_delete on public.proposals for delete to authenticated
  using (status = 'rascunho' and (select private.can_proposal('proposals.manage', id)));
create policy proposal_versions_select on public.proposal_versions for select to authenticated
  using ((select private.can_proposal('proposals.read', proposal_id)));
create policy proposal_views_select on public.proposal_views for select to authenticated
  using ((select private.can_proposal('proposals.read', proposal_id)));

revoke all on public.service_offers, public.proposal_templates, public.proposal_template_versions,
  public.proposals, public.proposal_versions, public.proposal_views from authenticated, anon;
grant select, insert, delete on public.service_offers to authenticated;
grant update (description, price_cents, recurrence) on public.service_offers to authenticated;
grant select, insert, delete on public.proposal_templates to authenticated;
grant update (name, blocks, whatsapp_message, validity_days, is_default, archived_at) on public.proposal_templates to authenticated;
grant select on public.proposal_template_versions, public.proposal_versions, public.proposal_views to authenticated;
grant select, delete on public.proposals to authenticated;

create trigger audit_proposal_templates after insert or update or delete on public.proposal_templates
  for each row execute function private.audit_row();
create trigger audit_service_offers after insert or update or delete on public.service_offers
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Salvar proposta (cria ou edita) e gravar uma versão com tudo o que é exibido.
-- -----------------------------------------------------------------------------
create or replace function private.proposal_items_check(p_items jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_i jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha ao menos um serviço.' using errcode = 'P0001';
  end if;
  for v_i in select * from jsonb_array_elements(p_items) loop
    if char_length(btrim(coalesce(v_i ->> 'name', ''))) < 2
       or coalesce((v_i ->> 'priceCents')::bigint, -1) < 0
       or coalesce((v_i ->> 'discountCents')::bigint, 0) < 0
       or coalesce((v_i ->> 'quantity')::int, 0) < 1
       or coalesce((v_i ->> 'discountCents')::bigint, 0) > (v_i ->> 'priceCents')::bigint * (v_i ->> 'quantity')::int
       or coalesce(v_i ->> 'recurrence', '') not in ('mensal', 'unico') then
      raise exception 'Revise os serviços: nome, valor, quantidade e desconto (o desconto não pode passar do valor).' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create or replace function public.save_proposal(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_x public.proposals;
  v_lead public.leads;
  v_tpl public.proposal_templates;
  v_monthly bigint;
  v_once bigint;
  v_number int;
  v_seller text;
  v_items jsonb := p -> 'items';
begin
  if v_id is null then
    select * into v_lead from public.leads where id = nullif(p ->> 'lead_id', '')::uuid;
    if v_lead.id is null or not (private.has_perm('proposals.manage') and private.can_lead(v_lead.id)) then
      raise exception 'Você não tem permissão para criar proposta para este lead.' using errcode = '42501';
    end if;
  else
    if not private.can_proposal('proposals.manage', v_id) then
      raise exception 'Você não tem permissão para editar esta proposta.' using errcode = '42501';
    end if;
    select * into v_x from public.proposals where id = v_id for update;
    if v_x.status = 'aceita' then raise exception 'Proposta aceita não pode ser alterada.' using errcode = 'P0001'; end if;
    select * into v_lead from public.leads where id = v_x.lead_id;
  end if;

  select * into v_tpl from public.proposal_templates
   where id = nullif(p ->> 'template_id', '')::uuid and organization_id = v_lead.organization_id and archived_at is null;
  if v_tpl.id is null then raise exception 'Escolha um modelo de proposta.' using errcode = 'P0001'; end if;

  perform private.proposal_items_check(v_items);
  select coalesce(sum(case when i ->> 'recurrence' = 'mensal' then (i ->> 'priceCents')::bigint * (i ->> 'quantity')::int - coalesce((i ->> 'discountCents')::bigint, 0) end), 0),
         coalesce(sum(case when i ->> 'recurrence' = 'unico' then (i ->> 'priceCents')::bigint * (i ->> 'quantity')::int - coalesce((i ->> 'discountCents')::bigint, 0) end), 0)
    into v_monthly, v_once
    from jsonb_array_elements(v_items) i;

  if (p ->> 'valid_until')::date < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A validade precisa ser hoje ou depois.' using errcode = 'P0001';
  end if;

  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('proposal_number:' || v_lead.organization_id));
    select coalesce(max(number), 0) + 1 into v_number from public.proposals where organization_id = v_lead.organization_id;
    insert into public.proposals (organization_id, number, lead_id, template_id, client_name, contact_name, contact_phone, contact_email,
                                  items, payment_terms, notes, valid_until, monthly_cents, one_time_cents, owner_id, created_by)
    values (v_lead.organization_id, v_number, v_lead.id, v_tpl.id, btrim(p ->> 'client_name'), btrim(coalesce(p ->> 'contact_name', '')),
            nullif(p ->> 'contact_phone', ''), nullif(lower(btrim(coalesce(p ->> 'contact_email', ''))), ''),
            v_items, btrim(coalesce(p ->> 'payment_terms', '')), btrim(coalesce(p ->> 'notes', '')), (p ->> 'valid_until')::date,
            v_monthly, v_once, coalesce(v_lead.owner_id, auth.uid()), auth.uid())
    returning * into v_x;
    insert into public.lead_activities (lead_id, kind, body)
    values (v_lead.id, 'sistema', 'Proposta nº ' || v_x.number || ' criada.');
  else
    update public.proposals
       set template_id = v_tpl.id, client_name = btrim(p ->> 'client_name'), contact_name = btrim(coalesce(p ->> 'contact_name', '')),
           contact_phone = nullif(p ->> 'contact_phone', ''), contact_email = nullif(lower(btrim(coalesce(p ->> 'contact_email', ''))), ''),
           items = v_items, payment_terms = btrim(coalesce(p ->> 'payment_terms', '')), notes = btrim(coalesce(p ->> 'notes', '')),
           valid_until = (p ->> 'valid_until')::date, monthly_cents = v_monthly, one_time_cents = v_once, updated_at = now()
     where id = v_id
     returning * into v_x;
  end if;

  select full_name into v_seller from public.profiles where id = coalesce(v_x.owner_id, auth.uid());
  update public.proposals set version = version + 1 where id = v_x.id returning * into v_x;
  insert into public.proposal_versions (proposal_id, version, snapshot, monthly_cents, one_time_cents, created_by)
  values (v_x.id, v_x.version, jsonb_build_object(
      'number', v_x.number,
      'issuedAt', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
      'templateName', v_tpl.name,
      'templateVersion', v_tpl.version,
      'blocks', v_tpl.blocks,
      'clientName', v_x.client_name,
      'contactName', v_x.contact_name,
      'contactPhone', v_x.contact_phone,
      'contactEmail', v_x.contact_email,
      'sellerName', coalesce(v_seller, ''),
      'items', v_x.items,
      'paymentTerms', v_x.payment_terms,
      'notes', v_x.notes,
      'validUntil', to_char(v_x.valid_until, 'YYYY-MM-DD')),
    v_monthly, v_once, auth.uid());
  return v_x.id;
end;
$$;
grant execute on function public.save_proposal(jsonb) to authenticated;

-- Enviar: o link passa a mostrar a versão atual.
create or replace function public.send_proposal(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x public.proposals;
begin
  if not private.can_proposal('proposals.manage', p_id) then
    raise exception 'Você não tem permissão para enviar esta proposta.' using errcode = '42501';
  end if;
  select * into v_x from public.proposals where id = p_id for update;
  if v_x.status = 'aceita' then raise exception 'Esta proposta já foi aceita.' using errcode = 'P0001'; end if;
  if v_x.valid_until < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A proposta venceu. Edite a validade antes de enviar de novo.' using errcode = 'P0001';
  end if;
  update public.proposals
     set status = case when status = 'visualizada' and sent_version = version then 'visualizada' else 'enviada' end,
         sent_version = version, sent_at = coalesce(sent_at, now()), refused_at = null, refused_reason = null, expired_at = null, updated_at = now()
   where id = p_id;
  if v_x.sent_version is distinct from v_x.version then
    insert into public.lead_activities (lead_id, kind, body)
    values (v_x.lead_id, 'sistema', 'Proposta nº ' || v_x.number || case when v_x.sent_version is null then ' enviada.' else ' reenviada (versão ' || v_x.version || ').' end);
  end if;
  return v_x.public_token;
end;
$$;
grant execute on function public.send_proposal(uuid) to authenticated;

-- Recusa registrada pelo vendedor.
create or replace function public.refuse_proposal(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x public.proposals;
begin
  if not private.can_proposal('proposals.manage', p_id) then
    raise exception 'Você não tem permissão para alterar esta proposta.' using errcode = '42501';
  end if;
  select * into v_x from public.proposals where id = p_id for update;
  if v_x.status not in ('enviada', 'visualizada', 'expirada') then
    raise exception 'Só uma proposta enviada pode ser marcada como recusada.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo da recusa.' using errcode = 'P0001'; end if;
  update public.proposals set status = 'recusada', refused_at = now(), refused_reason = left(btrim(p_reason), 300), updated_at = now() where id = p_id;
  insert into public.lead_activities (lead_id, kind, body) values (v_x.lead_id, 'sistema', 'Proposta nº ' || v_x.number || ' recusada: ' || left(btrim(p_reason), 300));
end;
$$;
grant execute on function public.refuse_proposal(uuid, text) to authenticated;

-- Vencida: status muda e o vendedor é avisado.
create or replace function private.expire_proposal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x public.proposals;
begin
  update public.proposals set status = 'expirada', expired_at = now(), updated_at = now()
   where id = p_id and status in ('enviada', 'visualizada') and valid_until < (now() at time zone 'America/Sao_Paulo')::date
  returning * into v_x;
  if v_x.id is null then return; end if;
  perform private.notify(array_remove(array[v_x.owner_id], null), 'proposal', 'Proposta vencida: ' || v_x.client_name,
    'A proposta nº ' || v_x.number || ' passou da validade sem aceite.', '/comercial/propostas/' || v_x.id, 'proposal_expired:' || v_x.id || ':' || v_x.valid_until);
end;
$$;

create or replace function private.proposals_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.expire_proposal(id) from public.proposals
   where status in ('enviada', 'visualizada') and valid_until < (now() at time zone 'America/Sao_Paulo')::date;
end;
$$;
select cron.schedule('extend-propostas', '5 3 * * *', $$select private.proposals_tick()$$);

-- Visualização pelo link público (chamada só pelo servidor).
create or replace function public.proposal_viewed(p_token text, p_ip text, p_user_agent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x public.proposals;
begin
  select * into v_x from public.proposals where public_token = p_token for update;
  if v_x.id is null or v_x.sent_version is null then return 'invalido'; end if;
  perform private.expire_proposal(v_x.id);
  select * into v_x from public.proposals where id = v_x.id;
  insert into public.proposal_views (proposal_id, version, ip, user_agent) values (v_x.id, v_x.sent_version, left(p_ip, 64), left(p_user_agent, 300));
  update public.proposals
     set view_count = view_count + 1, last_viewed_at = now(), first_viewed_at = coalesce(first_viewed_at, now()),
         status = case when status = 'enviada' then 'visualizada' else status end
   where id = v_x.id;
  if v_x.status in ('enviada', 'visualizada') then
    perform private.notify(array_remove(array[v_x.owner_id], null), 'proposal',
      'Proposta aberta: ' || v_x.client_name,
      case when v_x.view_count = 0 then 'O cliente abriu a proposta nº ' || v_x.number || ' pela primeira vez.' else 'A proposta nº ' || v_x.number || ' foi aberta de novo (' || (v_x.view_count + 1) || 'ª vez).' end,
      '/comercial/propostas/' || v_x.id,
      'proposal_view:' || v_x.id || ':' || to_char(now(), 'YYYYMMDDHH24'));
  end if;
  return v_x.status;
end;
$$;

-- Aceite pelo link público: proposta aceita, lead em Ganho e vendedor avisado para registrar o fechamento.
create or replace function public.accept_proposal(p_token text, p_name text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_x public.proposals;
  v_won uuid;
  v_from text;
begin
  select * into v_x from public.proposals where public_token = p_token for update;
  if v_x.id is null or v_x.sent_version is null then return 'invalido'; end if;
  if v_x.status = 'aceita' then return 'aceita'; end if;
  if v_x.status = 'recusada' then return 'recusada'; end if;
  if v_x.valid_until < (now() at time zone 'America/Sao_Paulo')::date then
    perform private.expire_proposal(v_x.id);
    return 'expirada';
  end if;
  if v_x.status not in ('enviada', 'visualizada') then return 'invalido'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Escreva seu nome completo para aceitar.' using errcode = 'P0001'; end if;

  update public.proposals
     set status = 'aceita', accepted_at = now(), accepted_name = left(btrim(p_name), 120), accepted_ip = left(p_ip, 64), updated_at = now()
   where id = v_x.id;

  select s.id into v_won from public.pipeline_stages s join public.leads l on l.pipeline_id = s.pipeline_id
   where l.id = v_x.lead_id and s.kind = 'ganho' order by s.position limit 1;
  select s.name into v_from from public.pipeline_stages s join public.leads l on l.stage_id = s.id where l.id = v_x.lead_id;
  if v_won is not null then
    update public.leads
       set stage_id = v_won, stage_changed_at = now(), won_at = coalesce(won_at, now()), lost_reason = null, lost_at = null,
           value_cents = coalesce(nullif(v_x.monthly_cents, 0), v_x.one_time_cents)
     where id = v_x.lead_id and stage_id <> v_won;
  end if;
  insert into public.lead_activities (lead_id, kind, body)
  values (v_x.lead_id, 'sistema', 'Proposta nº ' || v_x.number || ' aceita por ' || left(btrim(p_name), 120) || ' pelo link' ||
          case when v_from is not null then '. De “' || v_from || '” para Ganho.' else '.' end);

  perform private.notify(array_remove(array[v_x.owner_id, v_x.created_by], null), 'proposal',
    'Proposta aceita: ' || v_x.client_name,
    left(btrim(p_name), 120) || ' aceitou a proposta nº ' || v_x.number || '. Registre o fechamento para o cliente entrar em onboarding.',
    '/comercial/propostas/' || v_x.id, 'proposal_accepted:' || v_x.id);
  return 'ok';
end;
$$;

revoke all on function public.proposal_viewed(text, text, text) from public, anon, authenticated;
revoke all on function public.accept_proposal(text, text, text) from public, anon, authenticated;
grant execute on function public.proposal_viewed(text, text, text) to service_role;
grant execute on function public.accept_proposal(text, text, text) to service_role;
revoke all on function private.expire_proposal(uuid) from public, anon, authenticated;
revoke all on function private.proposals_tick() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Imagens dos modelos: bucket privado "propostas" (caminho modelos/<arquivo>).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propostas', 'propostas', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg'];

create policy propostas_select on storage.objects for select to authenticated
  using (bucket_id = 'propostas' and (select private.has_perm('proposals.read')));
create policy propostas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'propostas' and split_part(name, '/', 1) = 'modelos' and (select private.has_perm('proposals.templates.manage')));
create policy propostas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'propostas' and (select private.has_perm('proposals.templates.manage')));
