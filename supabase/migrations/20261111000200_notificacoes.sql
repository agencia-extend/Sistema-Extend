-- =============================================================================
-- Etapa 01 · Notificações (central + Web Push) e relógio do banco
-- =============================================================================
-- * private.notify(...) é a função única usada por todos os módulos.
--   - nunca notifica quem fez a ação (auth.uid());
--   - deduplica por (user_id, dedupe_key);
--   - respeita as preferências por tipo (no sistema / push).
-- * O push sai pela rota /api/jobs/notifications, chamada a cada minuto pelo
--   pg_cron via pg_net com o token em private.app_settings.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  actor_id         uuid references public.profiles (id) on delete set null,
  kind             text not null check (kind ~ '^[a-z_]{2,40}$'),
  title            text not null check (char_length(title) between 1 and 200),
  body             text check (char_length(body) <= 1000),
  href             text check (href ~ '^/'),
  dedupe_key       text,
  push_status      text not null default 'pending' check (push_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_push_pending_idx on public.notifications (created_at) where push_status = 'pending';

create table public.notification_preferences (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind ~ '^[a-z_]{2,40}$'),
  in_app      boolean not null default true,
  push        boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind)
);

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique check (endpoint ~ '^https://'),
  p256dh        text not null,
  auth          text not null,
  user_agent    text check (char_length(user_agent) <= 400),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- notify
-- -----------------------------------------------------------------------------
create or replace function private.notify(
  p_users uuid[], p_kind text, p_title text, p_body text default null, p_href text default null, p_dedupe_key text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.notifications (organization_id, user_id, actor_id, kind, title, body, href, dedupe_key, push_status)
  select p.organization_id, p.id, auth.uid(), p_kind, left(p_title, 200), left(p_body, 1000), p_href, p_dedupe_key,
         case when coalesce(np.push, true) then 'pending' else 'skipped' end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id and np.kind = p_kind
  where p.id = any (p_users)
    and p.is_active
    and p.id is distinct from auth.uid()
    and coalesce(np.in_app, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Para o servidor (Server Actions com a chave secreta não têm auth.uid(): passe o autor).
create or replace function public.notify_users(
  p_users uuid[], p_kind text, p_title text, p_body text, p_href text, p_dedupe_key text, p_actor uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.notifications (organization_id, user_id, actor_id, kind, title, body, href, dedupe_key, push_status)
  select p.organization_id, p.id, p_actor, p_kind, left(p_title, 200), left(p_body, 1000), p_href, p_dedupe_key,
         case when coalesce(np.push, true) then 'pending' else 'skipped' end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id and np.kind = p_kind
  where p.id = any (p_users)
    and p.is_active
    and p.id is distinct from p_actor
    and coalesce(np.in_app, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_users(uuid[], text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.notify_users(uuid[], text, text, text, text, text, uuid) to service_role;

-- Notificação de teste (Configurações → Usuários). Quem dispara precisa gerenciar
-- usuários, ou mandar para si mesmo (teste do próprio aparelho).
create or replace function public.send_test_notification(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user <> auth.uid() and not private.has_perm('users.manage') then
    raise exception 'Você não tem permissão para notificar outros usuários.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and organization_id = private.org_id() and is_active) then
    raise exception 'Usuário não encontrado ou inativo.' using errcode = 'P0002';
  end if;
  insert into public.notifications (organization_id, user_id, actor_id, kind, title, body, href, push_status)
  select p.organization_id, p.id, auth.uid(), 'system',
         'Notificação de teste',
         'Se você está vendo isto, as notificações estão funcionando neste aparelho.',
         '/inicio',
         case when coalesce(np.push, true) then 'pending' else 'skipped' end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id and np.kind = 'system'
  where p.id = p_user;
  perform private.log_event('test_notification', 'profiles', p_user::text);
end;
$$;

grant execute on function public.send_test_notification(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- Fila do push: pega as pendentes (sem disputa entre execuções simultâneas).
create or replace function public.claim_pending_pushes(p_limit int default 200)
returns table (id uuid, user_id uuid, title text, body text, href text, kind text)
language sql
security definer
set search_path = ''
as $$
  update public.notifications n
     set push_status = 'sending'
   where n.id in (
     select x.id from public.notifications x
      where x.push_status = 'pending' and x.created_at > now() - interval '1 day'
      order by x.created_at
      limit p_limit
      for update skip locked)
  returning n.id, n.user_id, n.title, n.body, n.href, n.kind;
$$;

create or replace function public.finish_pushes(p_sent uuid[], p_skipped uuid[], p_failed uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set push_status = 'sent' where id = any (p_sent);
  update public.notifications set push_status = 'skipped' where id = any (p_skipped);
  update public.notifications set push_status = 'failed' where id = any (p_failed);
  -- Pendências antigas (servidor fora do ar) não viram push atrasado.
  update public.notifications set push_status = 'skipped'
   where push_status in ('pending', 'sending') and created_at < now() - interval '1 day';
$$;

revoke execute on function public.claim_pending_pushes(int), public.finish_pushes(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.claim_pending_pushes(int), public.finish_pushes(uuid[], uuid[], uuid[]) to service_role;

-- -----------------------------------------------------------------------------
-- Relógio: pg_cron → pg_net → /api/jobs/<nome>
-- Configurar uma vez (script scripts/configure-jobs.mjs):
--   private.app_settings: site_url, jobs_token
-- -----------------------------------------------------------------------------
create or replace function private.call_job(p_job text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := private.setting('site_url');
  v_token text := private.setting('jobs_token');
begin
  if v_url is null or v_token is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/' || p_job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function private.call_job(text) from public, anon, authenticated;

select cron.schedule('extend-notificacoes', '* * * * *', $$select private.call_job('notifications')$$);

-- -----------------------------------------------------------------------------
-- Privilégios e RLS
-- -----------------------------------------------------------------------------
revoke insert, delete, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sino em tempo real.
alter publication supabase_realtime add table public.notifications;
