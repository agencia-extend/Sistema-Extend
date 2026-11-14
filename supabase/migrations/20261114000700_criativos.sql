-- Etapa 04 — Criativos: pedido do tráfego para as mídias, fluxo próprio, versões (genéricas
-- para qualquer entrega), aprovação interna, aprovação do cliente por link e biblioteca.

insert into public.permissions (key, module, label, scoped, position) values
  ('creatives.request', 'Criativos', 'Pedir criativos e aprovar internamente', false, 40),
  ('creatives.library', 'Criativos', 'Ver e organizar a biblioteca de criativos', false, 41)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, p.key, 'all'
  from public.roles r
  cross join (values ('creatives.request'), ('creatives.library')) p(key)
 where r.key in ('admin', 'gerente_trafego', 'gestor_trafego', 'coord_conteudo')
    or (p.key = 'creatives.library' and r.key in ('designer', 'editor_video', 'atendimento'))
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Fluxo do criativo
-- -----------------------------------------------------------------------------
insert into public.workflows (organization_id, task_type, name)
select id, 'criativo', 'Criativo' from public.organizations
on conflict (organization_id, task_type) do nothing;

insert into public.workflow_steps (workflow_id, name, position, status, waits_client, is_rework, color)
select w.id, s.name, s.pos, s.status, s.waits, s.rework, s.color
  from public.workflows w
 cross join (values
   ('Solicitado', 1, 'pendente', false, false, '#DC2626'),
   ('Em produção', 2, 'em_andamento', false, false, '#2563EB'),
   ('Em revisão', 3, 'aguardando_aprovacao', false, false, '#7C3AED'),
   ('Ajustes solicitados', 4, 'em_andamento', false, true, '#EA580C'),
   ('Aprovação do cliente', 5, 'aguardando_aprovacao', true, false, '#9333EA'),
   ('Aprovado', 6, 'aprovado', false, false, '#16A34A'),
   ('Entregue', 7, 'aprovado', false, false, '#0D9488'),
   ('No ar', 8, 'concluido', false, false, '#15803D')
 ) s(name, pos, status, waits, rework, color)
 where w.task_type = 'criativo'
   and not exists (select 1 from public.workflow_steps x where x.workflow_id = w.id);

create or replace function private.creative_step(p_org uuid, p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.workflow_steps s join public.workflows w on w.id = s.workflow_id
   where w.organization_id = p_org and w.task_type = 'criativo' and s.name = p_name and s.archived_at is null
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Pedido de criativo
-- -----------------------------------------------------------------------------
create table public.creative_requests (
  task_id         uuid primary key references public.tasks (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  requested_by    uuid references public.profiles (id) on delete set null,
  campaign        text not null check (char_length(campaign) between 2 and 160),
  objective       text not null check (objective in ('vendas', 'leads', 'mensagens', 'trafego', 'reconhecimento', 'engajamento', 'outro')),
  format          text not null check (format in ('imagem', 'video', 'story', 'carrossel', 'reels')),
  quantity        int not null default 1 check (quantity between 1 and 50),
  variations      int not null default 0 check (variations between 0 and 20),
  angle           text not null check (char_length(angle) between 2 and 300),
  audience        text not null check (char_length(audience) between 2 and 300),
  cta             text not null check (char_length(cta) between 2 and 120),
  copy_suggestion text check (char_length(copy_suggestion) <= 3000),
  reference_links text[] not null default '{}' check (cardinality(reference_links) <= 10),
  notes           text check (char_length(notes) <= 2000),
  source_ad_ref   text check (char_length(source_ad_ref) <= 200), -- etapa 05: anúncio que originou o pedido
  created_at      timestamptz not null default now()
);
create index creative_requests_client_idx on public.creative_requests (client_id, created_at desc);
create index creative_requests_requester_idx on public.creative_requests (requested_by);
alter table public.creative_requests enable row level security;
create policy creative_requests_select on public.creative_requests for select to authenticated
  using ((select private.task_visible(task_id)));
revoke all on public.creative_requests from authenticated, anon;
grant select on public.creative_requests to authenticated;

-- Quem produz: a pessoa da mídia no cliente (Edição para vídeo/reels, Design para o resto);
-- sem ninguém marcado, o líder do setor.
create or replace function private.creative_producer(p_client uuid, p_format text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sector uuid;
  v_id uuid;
begin
  select s.id into v_sector from public.sectors s join public.clients c on c.organization_id = s.organization_id
   where c.id = p_client and s.key = case when p_format in ('video', 'reels') then 'edicao' else 'design' end;
  select m.profile_id into v_id from public.client_members m join public.profiles p on p.id = m.profile_id and p.is_active
   where m.client_id = p_client and m.sector_id = v_sector order by m.is_default desc, m.created_at limit 1;
  if v_id is null then
    select ps.profile_id into v_id from public.profile_sectors ps join public.profiles p on p.id = ps.profile_id and p.is_active
     where ps.sector_id = v_sector order by ps.is_lead desc, ps.created_at limit 1;
  end if;
  return v_id;
end;
$$;

create or replace function public.create_creative_request(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_task uuid;
  v_format text := p ->> 'format';
  v_due timestamptz := nullif(p ->> 'due_at', '')::timestamptz;
  v_producer uuid;
  v_sector uuid;
  v_label text;
begin
  if not private.has_perm('creatives.request') then
    raise exception 'Você não tem permissão para pedir criativos.' using errcode = '42501';
  end if;
  select * into v_client from public.clients where id = (p ->> 'client_id')::uuid and deleted_at is null;
  if v_client.id is null or not private.can_client('clients.read', v_client.id) then
    raise exception 'Cliente não encontrado ou sem acesso.' using errcode = '42501';
  end if;
  if v_due is null then raise exception 'Informe o prazo.' using errcode = 'P0001'; end if;
  if v_due < now() - interval '1 day' then raise exception 'O prazo já passou. Escolha uma data a partir de hoje.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'priority', '') not in ('baixa', 'media', 'alta', 'urgente') then raise exception 'Escolha a prioridade.' using errcode = 'P0001'; end if;

  v_producer := private.creative_producer(v_client.id, v_format);
  select s.id into v_sector from public.sectors s where s.organization_id = v_client.organization_id
     and s.key = case when v_format in ('video', 'reels') then 'edicao' else 'design' end;
  v_label := case v_format when 'imagem' then 'imagem' when 'video' then 'vídeo' when 'story' then 'story' when 'carrossel' then 'carrossel' else 'reels' end;

  insert into public.tasks (organization_id, client_id, sector_id, type, title, description, priority, assignee_id, due_at, created_by, workflow_step_id)
  values (v_client.organization_id, v_client.id, v_sector, 'criativo',
          left('Criativo (' || v_label || '): ' || btrim(p ->> 'angle'), 200),
          nullif(btrim(p ->> 'notes'), ''), p ->> 'priority', v_producer, v_due, auth.uid(),
          private.creative_step(v_client.organization_id, 'Solicitado'))
  returning id into v_task;

  insert into public.creative_requests (task_id, client_id, requested_by, campaign, objective, format, quantity, variations, angle, audience, cta,
                                        copy_suggestion, reference_links, notes, source_ad_ref)
  values (v_task, v_client.id, auth.uid(), btrim(p ->> 'campaign'), p ->> 'objective', v_format,
          coalesce((p ->> 'quantity')::int, 1), coalesce((p ->> 'variations')::int, 0), btrim(p ->> 'angle'), btrim(p ->> 'audience'), btrim(p ->> 'cta'),
          nullif(btrim(p ->> 'copy_suggestion'), ''),
          coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(p -> 'reference_links', '[]')) x where btrim(x) <> ''), '{}'),
          nullif(btrim(p ->> 'notes'), ''), nullif(btrim(p ->> 'source_ad_ref'), ''));

  -- Quem pede acompanha a demanda (comentários e avisos).
  insert into public.task_participants (task_id, profile_id) values (v_task, auth.uid()) on conflict do nothing;
  perform private.timeline(v_client.id, 'creative', 'Criativo pedido: ' || btrim(p ->> 'angle'), jsonb_build_object('task_id', v_task));
  return v_task;
end;
$$;
grant execute on function public.create_creative_request(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Versões (entregas) — genéricas para qualquer demanda
-- -----------------------------------------------------------------------------
create table public.task_deliveries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  version    int not null,
  note       text check (char_length(note) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, version)
);
create table public.delivery_assets (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references public.task_deliveries (id) on delete cascade,
  kind         text not null check (kind in ('arquivo', 'link')),
  name         text not null check (char_length(name) between 1 and 200),
  storage_path text check (storage_path ~ '^tarefas/[0-9a-f-]{36}/entregas/'),
  url          text check (url ~* '^https?://' and char_length(url) <= 1000),
  mime_type    text,
  size_bytes   bigint,
  check ((kind = 'arquivo' and storage_path is not null) or (kind = 'link' and url is not null))
);
create table public.delivery_comments (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.task_deliveries (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index task_deliveries_task_idx on public.task_deliveries (task_id, version desc);
create index delivery_assets_delivery_idx on public.delivery_assets (delivery_id);
create index delivery_comments_delivery_idx on public.delivery_comments (delivery_id, created_at);

alter table public.task_deliveries enable row level security;
alter table public.delivery_assets enable row level security;
alter table public.delivery_comments enable row level security;
create policy task_deliveries_select on public.task_deliveries for select to authenticated using ((select private.task_visible(task_id)));
create policy delivery_assets_select on public.delivery_assets for select to authenticated
  using (exists (select 1 from public.task_deliveries d where d.id = delivery_id and private.task_visible(d.task_id)));
create policy delivery_comments_select on public.delivery_comments for select to authenticated
  using (exists (select 1 from public.task_deliveries d where d.id = delivery_id and private.task_visible(d.task_id)));
create policy delivery_comments_insert on public.delivery_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.task_deliveries d where d.id = delivery_id and private.task_visible(d.task_id)));
revoke all on public.task_deliveries, public.delivery_assets, public.delivery_comments from authenticated, anon;
grant select on public.task_deliveries, public.delivery_assets, public.delivery_comments to authenticated;
grant insert (delivery_id, body) on public.delivery_comments to authenticated;

-- Nova versão: quem produz (responsável) ou quem gerencia a demanda. No criativo, a entrega em
-- produção ou em ajustes vai para "Em revisão" e avisa quem pediu ("criativo pronto").
create or replace function public.add_delivery(p_task uuid, p_note text, p_assets jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_version int;
  v_id uuid;
  v_a jsonb;
  v_step text;
  v_requester uuid;
begin
  select * into v_t from public.tasks where id = p_task and deleted_at is null for update;
  if v_t.id is null then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;
  if not (v_t.assignee_id = auth.uid() or private.can_task('tasks.manage', p_task)) then
    raise exception 'Só quem produz ou gerencia a demanda envia versões.' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_assets, '[]')) = 0 then raise exception 'Envie ao menos um arquivo ou link.' using errcode = 'P0001'; end if;

  select coalesce(max(version), 0) + 1 into v_version from public.task_deliveries where task_id = p_task;
  insert into public.task_deliveries (task_id, version, note) values (p_task, v_version, nullif(btrim(p_note), '')) returning id into v_id;
  for v_a in select * from jsonb_array_elements(p_assets) loop
    if v_a ->> 'kind' = 'arquivo' and v_a ->> 'storage_path' not like 'tarefas/' || p_task || '/entregas/%' then
      raise exception 'Arquivo inválido para esta demanda.' using errcode = 'P0001';
    end if;
    insert into public.delivery_assets (delivery_id, kind, name, storage_path, url, mime_type, size_bytes)
    values (v_id, v_a ->> 'kind', left(coalesce(nullif(v_a ->> 'name', ''), 'Arquivo'), 200), nullif(v_a ->> 'storage_path', ''), nullif(v_a ->> 'url', ''),
            nullif(v_a ->> 'mime_type', ''), nullif(v_a ->> 'size_bytes', '')::bigint);
  end loop;

  insert into public.task_activity (task_id, actor_id, kind, title) values (p_task, auth.uid(), 'delivery', 'Versão v' || v_version || ' enviada');

  if v_t.type = 'criativo' then
    select s.name into v_step from public.workflow_steps s where s.id = v_t.workflow_step_id;
    if v_step in ('Solicitado', 'Em produção', 'Ajustes solicitados') then
      update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'Em revisão') where id = p_task;
      select requested_by into v_requester from public.creative_requests where task_id = p_task;
      perform private.notify(array[v_requester], 'creative', 'Criativo pronto para revisar: v' || v_version,
        v_t.title, '/criativos/' || p_task, 'creative_ready:' || p_task || ':' || v_version);
    end if;
  end if;
  return v_version;
end;
$$;
grant execute on function public.add_delivery(uuid, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Biblioteca
-- -----------------------------------------------------------------------------
create table public.creative_library (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null unique references public.tasks (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  delivery_id  uuid references public.task_deliveries (id) on delete set null,
  campaign     text not null,
  format       text not null,
  angle        text not null,
  primary_text text check (char_length(primary_text) <= 3000),
  headline     text check (char_length(headline) <= 200),
  description  text check (char_length(description) <= 500),
  status       text not null default 'em_teste' check (status in ('em_teste', 'vencedor', 'fadigado', 'reprovado_meta', 'arquivado')),
  ad_ref       text check (char_length(ad_ref) <= 200), -- etapa 05: anúncio na Meta/Google
  approved_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index creative_library_client_idx on public.creative_library (client_id, approved_at desc);
create trigger creative_library_updated_at before update on public.creative_library for each row execute function private.set_updated_at();
alter table public.creative_library enable row level security;
create policy creative_library_select on public.creative_library for select to authenticated
  using ((select private.has_perm('creatives.library')) and (select private.can_client('clients.read', client_id)));
create policy creative_library_update on public.creative_library for update to authenticated
  using ((select private.has_perm('creatives.request')) and (select private.can_client('clients.read', client_id)))
  with check ((select private.has_perm('creatives.request')) and (select private.can_client('clients.read', client_id)));
revoke all on public.creative_library from authenticated, anon;
grant select on public.creative_library to authenticated;
grant update (primary_text, headline, description, status) on public.creative_library to authenticated;

-- Criativo aprovado (internamente sem cliente ou pelo cliente) entra na biblioteca com a última versão.
create or replace function private.creative_to_library(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creative_library (task_id, client_id, delivery_id, campaign, format, angle, primary_text)
  select r.task_id, r.client_id, (select d.id from public.task_deliveries d where d.task_id = r.task_id order by d.version desc limit 1),
         r.campaign, r.format, r.angle, r.copy_suggestion
    from public.creative_requests r where r.task_id = p_task
  on conflict (task_id) do update set delivery_id = excluded.delivery_id, approved_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- Aprovação interna (quem pediu)
-- -----------------------------------------------------------------------------
create or replace function public.review_creative(p_task uuid, p_decision text, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_r public.creative_requests;
  v_step text;
begin
  select * into v_t from public.tasks where id = p_task and type = 'criativo' and deleted_at is null for update;
  select * into v_r from public.creative_requests where task_id = p_task;
  if v_t.id is null or v_r.task_id is null then raise exception 'Criativo não encontrado.' using errcode = 'P0002'; end if;
  if not (v_r.requested_by = auth.uid() or (private.has_perm('creatives.request') and private.can_client('clients.read', v_t.client_id))) then
    raise exception 'Só quem pediu ou o tráfego do cliente revisa o criativo.' using errcode = '42501';
  end if;
  select s.name into v_step from public.workflow_steps s where s.id = v_t.workflow_step_id;

  if p_decision in ('ajustes', 'ajustes_entregue') and char_length(btrim(coalesce(p_comment, ''))) < 3 then
    raise exception 'Descreva o que precisa mudar.' using errcode = 'P0001';
  end if;

  if p_decision = 'ajustes' then
    if v_step not in ('Em revisão', 'Aprovação do cliente') then raise exception 'O criativo não está em revisão.' using errcode = 'P0001'; end if;
    update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'Ajustes solicitados') where id = p_task;
  elsif p_decision = 'cliente' then
    if v_step <> 'Em revisão' then raise exception 'O criativo não está em revisão.' using errcode = 'P0001'; end if;
    update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'Aprovação do cliente') where id = p_task;
  elsif p_decision = 'aprovado' then
    if v_step not in ('Em revisão', 'Aprovação do cliente') then raise exception 'O criativo não está em revisão.' using errcode = 'P0001'; end if;
    update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'Aprovado') where id = p_task;
    perform private.creative_to_library(p_task);
  elsif p_decision = 'entregue' then
    if v_step <> 'Aprovado' then raise exception 'Só criativo aprovado pode ser marcado como entregue.' using errcode = 'P0001'; end if;
    update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'Entregue') where id = p_task;
  elsif p_decision = 'no_ar' then
    if v_step not in ('Aprovado', 'Entregue') then raise exception 'Só criativo aprovado ou entregue pode ir para "No ar".' using errcode = 'P0001'; end if;
    update public.tasks set workflow_step_id = private.creative_step(v_t.organization_id, 'No ar') where id = p_task;
  else
    raise exception 'Decisão inválida.' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_comment, '')), '') is not null then
    insert into public.task_comments (task_id, author_id, body) values (p_task, auth.uid(), btrim(p_comment));
  end if;
  insert into public.task_activity (task_id, actor_id, kind, title)
  values (p_task, auth.uid(), 'review', case p_decision when 'ajustes' then 'Ajustes pedidos' when 'cliente' then 'Aprovado internamente; enviado ao cliente'
    when 'aprovado' then 'Aprovado' when 'entregue' then 'Entregue' else 'No ar' end);
  if p_decision = 'ajustes' and v_t.assignee_id is not null then
    perform private.notify(array[v_t.assignee_id], 'creative', 'Ajustes no criativo: ' || v_t.title, left(btrim(p_comment), 300), '/criativos/' || p_task, 'creative_fix:' || p_task || ':' || now()::text);
  end if;
end;
$$;
grant execute on function public.review_creative(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Aprovação do cliente por link (genérica: criativo ou qualquer demanda com etapa de cliente)
-- -----------------------------------------------------------------------------
create table public.approval_links (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  delivery_id   uuid references public.task_deliveries (id) on delete cascade,
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at    timestamptz not null,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  decided_at    timestamptz,
  decision      text check (decision in ('aprovado', 'ajustes')),
  comment       text check (char_length(comment) <= 2000),
  reviewer_name text check (char_length(reviewer_name) <= 120),
  reviewer_ip   text check (char_length(reviewer_ip) <= 64)
);
create index approval_links_task_idx on public.approval_links (task_id, created_at desc);
alter table public.approval_links enable row level security;
create policy approval_links_select on public.approval_links for select to authenticated using ((select private.task_visible(task_id)));
revoke all on public.approval_links from authenticated, anon;
grant select (id, task_id, delivery_id, expires_at, created_by, created_at, revoked_at, decided_at, decision, comment, reviewer_name) on public.approval_links to authenticated;

-- Gera o link (o código vem pronto e só o hash é guardado). Links anteriores em aberto da mesma demanda caducam.
create or replace function public.create_approval_link(p_task uuid, p_token_hash text, p_days int default 7)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_delivery uuid;
  v_id uuid;
begin
  select * into v_t from public.tasks where id = p_task and deleted_at is null;
  if v_t.id is null then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;
  if not (private.can_task('tasks.manage', p_task) or exists (select 1 from public.creative_requests r where r.task_id = p_task and r.requested_by = auth.uid())) then
    raise exception 'Você não tem permissão para pedir a aprovação do cliente.' using errcode = '42501';
  end if;
  select id into v_delivery from public.task_deliveries where task_id = p_task order by version desc limit 1;
  if v_delivery is null then raise exception 'Envie uma versão antes de pedir a aprovação do cliente.' using errcode = 'P0001'; end if;
  if v_t.type = 'criativo' and (select name from public.workflow_steps where id = v_t.workflow_step_id) <> 'Aprovação do cliente' then
    raise exception 'Aprove internamente antes de enviar ao cliente.' using errcode = 'P0001';
  end if;
  update public.approval_links set revoked_at = now() where task_id = p_task and decided_at is null and revoked_at is null;
  insert into public.approval_links (task_id, delivery_id, token_hash, expires_at)
  values (p_task, v_delivery, p_token_hash, now() + make_interval(days => greatest(1, least(p_days, 30))))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_approval_link(uuid, text, int) to authenticated;

-- Decisão do cliente (chamada só pelo servidor, com a chave de serviço). Uma decisão por link.
create or replace function public.decide_approval(p_token_hash text, p_decision text, p_comment text, p_name text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.approval_links;
  v_t public.tasks;
  v_requester uuid;
  v_target uuid;
  v_waits boolean;
  v_pos int;
  v_wf uuid;
begin
  select * into v_l from public.approval_links where token_hash = p_token_hash for update;
  if v_l.id is null then return 'invalido'; end if;
  if v_l.decided_at is not null then return 'usado'; end if;
  if v_l.revoked_at is not null then return 'substituido'; end if;
  if v_l.expires_at < now() then return 'expirado'; end if;
  if p_decision not in ('aprovado', 'ajustes') then raise exception 'Decisão inválida.' using errcode = 'P0001'; end if;
  if p_decision = 'ajustes' and char_length(btrim(coalesce(p_comment, ''))) < 3 then raise exception 'Descreva o que precisa mudar.' using errcode = 'P0001'; end if;

  update public.approval_links
     set decided_at = now(), decision = p_decision, comment = nullif(btrim(p_comment), ''), reviewer_name = nullif(btrim(p_name), ''), reviewer_ip = left(p_ip, 64)
   where id = v_l.id;

  select * into v_t from public.tasks where id = v_l.task_id for update;
  select requested_by into v_requester from public.creative_requests where task_id = v_t.id;

  if v_t.type = 'criativo' then
    v_target := private.creative_step(v_t.organization_id, case p_decision when 'aprovado' then 'Aprovado' else 'Ajustes solicitados' end);
  else
    select s.waits_client, s.position, s.workflow_id into v_waits, v_pos, v_wf from public.workflow_steps s where s.id = v_t.workflow_step_id;
    if coalesce(v_waits, false) then
      if p_decision = 'aprovado' then
        select id into v_target from public.workflow_steps where workflow_id = v_wf and position > v_pos and archived_at is null order by position limit 1;
      else
        select id into v_target from public.workflow_steps where workflow_id = v_wf and is_rework and archived_at is null order by position limit 1;
        if v_target is null then
          select id into v_target from public.workflow_steps where workflow_id = v_wf and position < v_pos and archived_at is null order by position desc limit 1;
        end if;
      end if;
    end if;
  end if;
  if v_target is not null then update public.tasks set workflow_step_id = v_target where id = v_t.id; end if;
  if v_t.type = 'criativo' and p_decision = 'aprovado' then perform private.creative_to_library(v_t.id); end if;

  insert into public.task_comments (task_id, author_id, body)
  select v_t.id, coalesce(v_l.created_by, v_requester, v_t.created_by),
         'Cliente' || coalesce(' (' || nullif(btrim(p_name), '') || ')', '') || case p_decision when 'aprovado' then ' aprovou pelo link.' else ' pediu alteração pelo link: ' || btrim(p_comment) end
   where coalesce(v_l.created_by, v_requester, v_t.created_by) is not null;
  insert into public.task_activity (task_id, actor_id, kind, title) values (v_t.id, null, 'client_review', case p_decision when 'aprovado' then 'Cliente aprovou' else 'Cliente pediu alteração' end);

  perform private.notify(array_remove(array[v_t.assignee_id, v_requester, v_l.created_by], null), 'creative',
    case p_decision when 'aprovado' then 'Cliente aprovou: ' else 'Cliente pediu alteração: ' end || v_t.title,
    case when p_decision = 'ajustes' then left(btrim(p_comment), 300) end,
    case when v_t.type = 'criativo' then '/criativos/' || v_t.id else '/tarefas/' || v_t.id end, 'client_review:' || v_l.id);
  return 'ok';
end;
$$;
revoke all on function public.decide_approval(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.decide_approval(text, text, text, text, text) to service_role;
