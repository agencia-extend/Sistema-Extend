-- Privacidade (LGPD): dados do controlador, ciência da política, pedidos dos titulares,
-- exportação dos próprios dados e retenção (apagar o que não precisa mais ser guardado).

insert into public.permissions (key, module, label, scoped, position) values
  ('privacy.manage', 'Administração', 'Atender pedidos de privacidade (LGPD) e editar os dados do controlador', false, 95)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'privacy.manage', 'all' from public.roles r where r.key = 'admin'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Controlador (quem responde pelos dados) e encarregado (DPO)
-- -----------------------------------------------------------------------------
create table public.privacy_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  legal_name      text check (char_length(legal_name) <= 160),
  cnpj            text check (cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'),
  address         text check (char_length(address) <= 300),
  dpo_name        text check (char_length(dpo_name) <= 120),
  dpo_email       text check (dpo_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(dpo_email) <= 200),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);
alter table public.privacy_settings enable row level security;

create policy privacy_settings_select on public.privacy_settings for select to authenticated
  using (organization_id = (select private.org_id()));
create policy privacy_settings_write on public.privacy_settings for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('privacy.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('privacy.manage')));
grant select, insert, update on public.privacy_settings to authenticated;

-- -----------------------------------------------------------------------------
-- Ciência da política (uma linha por pessoa e versão)
-- -----------------------------------------------------------------------------
create table public.privacy_consents (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  version     text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (profile_id, version)
);
alter table public.privacy_consents enable row level security;

create policy privacy_consents_select on public.privacy_consents for select to authenticated
  using (profile_id = auth.uid()
     or ((select private.has_perm('privacy.manage'))
         and exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id()))));
create policy privacy_consents_insert on public.privacy_consents for insert to authenticated
  with check (profile_id = auth.uid());
grant select, insert on public.privacy_consents to authenticated;

-- -----------------------------------------------------------------------------
-- Pedidos dos titulares (art. 18 da LGPD), com prazo de 15 dias (art. 19, II)
-- -----------------------------------------------------------------------------
create table public.privacy_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  profile_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind            text not null check (kind in ('acesso', 'correcao', 'exclusao', 'portabilidade', 'revogacao', 'informacao', 'oposicao')),
  details         text check (char_length(details) <= 2000),
  status          text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'concluido', 'recusado')),
  response        text check (char_length(response) <= 2000),
  due_on          date not null default (private.today_sp() + 15),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  constraint privacy_requests_response_ck check (status not in ('concluido', 'recusado') or char_length(coalesce(response, '')) >= 5)
);
create index privacy_requests_org_idx on public.privacy_requests (organization_id, status, due_on);
create index privacy_requests_profile_idx on public.privacy_requests (profile_id, created_at desc);
alter table public.privacy_requests enable row level security;

create policy privacy_requests_select on public.privacy_requests for select to authenticated
  using (profile_id = auth.uid()
     or (organization_id = (select private.org_id()) and (select private.has_perm('privacy.manage'))));
create policy privacy_requests_insert on public.privacy_requests for insert to authenticated
  with check (profile_id = auth.uid() and organization_id = (select private.org_id()) and status = 'aberto' and response is null);
create policy privacy_requests_update on public.privacy_requests for update to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('privacy.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('privacy.manage')));
grant select, insert on public.privacy_requests to authenticated;
grant update (status, response) on public.privacy_requests to authenticated;

create or replace function private.privacy_managers(p_org uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}')
  from public.profiles p
  where p.organization_id = p_org and p.is_active
    and private.user_perm_scope(p.id, 'privacy.manage') is not null;
$$;

create or replace function private.privacy_request_label(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'acesso' then 'ver meus dados'
    when 'correcao' then 'corrigir dados'
    when 'exclusao' then 'apagar dados'
    when 'portabilidade' then 'levar meus dados'
    when 'revogacao' then 'retirar consentimento'
    when 'oposicao' then 'se opor a um uso'
    else 'informação sobre meus dados'
  end;
$$;

create or replace function private.privacy_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = new.profile_id;
  perform private.notify(
    private.privacy_managers(new.organization_id), 'privacy',
    'Pedido de privacidade: ' || private.privacy_request_label(new.kind),
    coalesce(v_name, 'Uma pessoa') || ' fez um pedido sobre os próprios dados. Prazo legal: ' || to_char(new.due_on, 'DD/MM/YYYY') || '.',
    '/configuracoes/privacidade', 'privacy_request:' || new.id
  );
  return new;
end;
$$;
create trigger privacy_request_created after insert on public.privacy_requests
  for each row execute function private.privacy_request_created();

create or replace function private.privacy_request_answered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('concluido', 'recusado') and old.status not in ('concluido', 'recusado') then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  elsif new.status not in ('concluido', 'recusado') then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$$;
create trigger privacy_request_answered before update on public.privacy_requests
  for each row execute function private.privacy_request_answered();

create or replace function private.privacy_request_notify_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('concluido', 'recusado') and old.status not in ('concluido', 'recusado') then
    perform private.notify(
      array[new.profile_id], 'privacy',
      case new.status when 'concluido' then 'Seu pedido de privacidade foi atendido' else 'Seu pedido de privacidade foi respondido' end,
      left(new.response, 300), '/configuracoes/perfil#privacidade', 'privacy_answer:' || new.id || ':' || new.status
    );
  end if;
  return new;
end;
$$;
create trigger privacy_request_notify_owner after update on public.privacy_requests
  for each row execute function private.privacy_request_notify_owner();

-- -----------------------------------------------------------------------------
-- Exportação dos próprios dados (direito de acesso e portabilidade)
-- -----------------------------------------------------------------------------
create or replace function public.my_personal_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'papeis', (select coalesce(jsonb_agg(r.name), '[]') from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid()),
    'setores', (select coalesce(jsonb_agg(s.name), '[]') from public.profile_sectors ps join public.sectors s on s.id = ps.sector_id where ps.profile_id = auth.uid()),
    'preferencias_de_aviso', (select coalesce(jsonb_agg(to_jsonb(n) - 'user_id'), '[]') from public.notification_preferences n where n.user_id = auth.uid()),
    'aparelhos_com_avisos', (select coalesce(jsonb_agg(jsonb_build_object('aparelho', s.user_agent, 'ativado_em', s.created_at, 'ultimo_uso', s.last_used_at)), '[]') from public.push_subscriptions s where s.user_id = auth.uid()),
    'comentarios', (select coalesce(jsonb_agg(jsonb_build_object('demanda', c.task_id, 'texto', c.body, 'em', c.created_at) order by c.created_at), '[]') from public.task_comments c where c.author_id = auth.uid()),
    'tempo_registrado', (select coalesce(jsonb_agg(jsonb_build_object('demanda', t.task_id, 'inicio', t.started_at, 'fim', t.ended_at) order by t.started_at), '[]') from public.task_time_entries t where t.profile_id = auth.uid()),
    'treinamentos_concluidos', (select coalesce(jsonb_agg(jsonb_build_object('aula', l.title, 'treinamento', tr.title, 'em', g.completed_at)), '[]') from public.training_progress g join public.training_lessons l on l.id = g.lesson_id join public.trainings tr on tr.id = l.training_id where g.profile_id = auth.uid()),
    'avisos_ultimos_90_dias', (select coalesce(jsonb_agg(jsonb_build_object('titulo', n.title, 'texto', n.body, 'em', n.created_at, 'lido_em', n.read_at) order by n.created_at desc), '[]') from public.notifications n where n.user_id = auth.uid() and n.created_at > now() - interval '90 days'),
    'ciencia_da_politica', (select coalesce(jsonb_agg(jsonb_build_object('versao', c.version, 'em', c.accepted_at)), '[]') from public.privacy_consents c where c.profile_id = auth.uid()),
    'pedidos_de_privacidade', (select coalesce(jsonb_agg(to_jsonb(r) - 'organization_id' - 'resolved_by'), '[]') from public.privacy_requests r where r.profile_id = auth.uid())
  )
  where auth.uid() is not null;
$$;
revoke all on function public.my_personal_data() from public, anon;
grant execute on function public.my_personal_data() to authenticated;

-- -----------------------------------------------------------------------------
-- Retenção: guardar só pelo tempo necessário (art. 15 e 16)
-- -----------------------------------------------------------------------------
create or replace function private.privacy_retention_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Avisos lidos há mais de 180 dias e quaisquer avisos com mais de 1 ano.
  delete from public.notifications where (read_at is not null and read_at < now() - interval '180 days') or created_at < now() - interval '365 days';
  -- Convites que não viraram acesso, depois de 90 dias.
  delete from public.invitations where status in ('cancelado') and created_at < now() - interval '90 days';
  delete from public.invitations where status = 'pendente' and expires_at < now() - interval '90 days';
  -- Aparelhos que não recebem aviso há 1 ano.
  delete from public.push_subscriptions where coalesce(last_used_at, created_at) < now() - interval '365 days';
  -- Auditoria: 5 anos (prazo prescricional de ações cíveis e trabalhistas).
  delete from public.audit_logs where created_at < now() - interval '5 years';
  -- Pedidos de privacidade resolvidos: 5 anos (prova de atendimento).
  delete from public.privacy_requests where resolved_at < now() - interval '5 years';

  -- Pedidos perto do prazo legal: avisa quem atende (uma vez por pedido).
  perform private.notify(
    private.privacy_managers(r.organization_id), 'privacy',
    'Pedido de privacidade vence em ' || to_char(r.due_on, 'DD/MM/YYYY'),
    'Responda dentro do prazo da LGPD.', '/configuracoes/privacidade', 'privacy_due:' || r.id
  )
  from public.privacy_requests r
  where r.status in ('aberto', 'em_andamento') and r.due_on <= private.today_sp() + 3;
end;
$$;

select cron.schedule('extend-privacidade', '20 9 * * *', $$select private.privacy_retention_tick()$$);
