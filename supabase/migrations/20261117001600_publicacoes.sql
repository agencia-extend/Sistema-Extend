-- Programar publicações no Facebook e no Instagram dos clientes (RF-CON-03): Feed (foto ou carrossel), Reels, vídeo e
-- Stories, com legenda e horário; cancelar e reagendar; situação publicado/erro com o motivo. A fila roda no servidor a
-- cada 5 minutos (job publish-posts). Quem programa: "Programar e publicar nas redes" no cliente (content.publish).
-- Só perfis cuja conexão da Meta tem as permissões de publicar (pages_manage_posts; instagram_basic +
-- instagram_content_publish) aceitam agendamento.

-- Arquivos das publicações: clientes/<cliente>/publicacoes/<arquivo>, até 50 MB (vídeo de Reels).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicacoes', 'publicacoes', false, 52428800, array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy publicacoes_select on storage.objects for select to authenticated
  using (bucket_id = 'publicacoes' and (select private.can_client('clients.read', private.storage_client(name))));
create policy publicacoes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'publicacoes' and split_part(name, '/', 3) = 'publicacoes'
              and (select private.can_client('content.publish', private.storage_client(name))));
create policy publicacoes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'publicacoes' and owner_id = (select auth.uid())::text);

create table public.post_schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  profile_id      uuid not null references public.social_profiles (id) on delete cascade,
  task_id         uuid references public.tasks (id) on delete set null,
  format          text not null check (format in ('feed', 'reels', 'video', 'stories')),
  caption         text not null default '' check (char_length(caption) <= 5000),
  images          text[] not null default '{}' check (cardinality(images) <= 10),
  video_path      text check (char_length(video_path) <= 400),
  video_drive_id  text check (video_drive_id ~ '^[A-Za-z0-9_-]{10,}$'),
  scheduled_at    timestamptz not null,
  status          text not null default 'agendado' check (status in ('agendado', 'publicando', 'publicado', 'erro', 'cancelado')),
  attempts        integer not null default 0,
  container_id    text,
  external_id     text,
  permalink       text,
  error           text check (char_length(error) <= 500),
  published_at    timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (not (video_path is not null and video_drive_id is not null))
);
create index post_schedules_due on public.post_schedules (scheduled_at) where status in ('agendado', 'publicando');
create index post_schedules_client on public.post_schedules (client_id, scheduled_at desc);
create trigger post_schedules_updated_at before update on public.post_schedules for each row execute function private.set_updated_at();
create trigger audit_post_schedules after insert or update or delete on public.post_schedules
  for each row execute function private.audit_row('', 'status,scheduled_at,format,error');

alter table public.post_schedules enable row level security;
revoke all on public.post_schedules from anon, authenticated;
grant select on public.post_schedules to authenticated;
create policy post_schedules_select on public.post_schedules for select to authenticated
  using ((select private.can_client('content.publish', client_id)) or (select private.can_client('content.read', client_id)));

-- Perfil pronto para publicar: conexão ativa com as permissões da plataforma.
create or replace function private.profile_publish_missing(p_profile uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.id is null or c.status <> 'active' then array['conexão da Meta ativa']
    when p.platform = 'facebook' then array(select s from unnest(array['pages_manage_posts', 'pages_read_engagement']) s where not s = any(c.scopes))
    else array(select s from unnest(array['instagram_basic', 'instagram_content_publish']) s where not s = any(c.scopes))
  end
    from public.social_profiles p
    left join public.integration_connections c on c.id = p.connection_id
   where p.id = p_profile;
$$;
revoke all on function private.profile_publish_missing(uuid) from public, anon, authenticated;

-- Perfis do cliente para o diálogo de programar, com o que falta para publicar em cada um.
create or replace function public.publish_targets(p_client uuid)
returns table (profile_id uuid, platform text, name text, username text, missing text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.platform, p.name, p.username, coalesce(private.profile_publish_missing(p.id), '{}')
    from public.social_profiles p
   where p.client_id = p_client and p.organization_id = private.org_id()
     and private.can_client('content.publish', p_client)
   order by p.platform, p.name;
$$;
revoke all on function public.publish_targets(uuid) from public, anon;
grant execute on function public.publish_targets(uuid) to authenticated;

-- Programa a mesma publicação em um ou mais perfis do cliente. Formato e mídia são conferidos aqui e no Zod.
create or replace function public.schedule_post(
  p_client uuid, p_profiles uuid[], p_format text, p_caption text, p_images text[], p_video_path text, p_video_drive_id text,
  p_at timestamptz, p_task uuid
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_p public.social_profiles;
  v_missing text[];
  v_imgs int := coalesce(cardinality(p_images), 0);
  v_vid int := (p_video_path is not null)::int + (p_video_drive_id is not null)::int;
  v_path text;
begin
  select organization_id into v_org from public.clients where id = p_client and organization_id = private.org_id() and deleted_at is null;
  if v_org is null then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;
  if not private.can_client('content.publish', p_client) then
    raise exception 'Você não tem permissão para programar publicações deste cliente.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_profiles), 0) = 0 then raise exception 'Escolha onde publicar.' using errcode = '22023'; end if;
  if p_format not in ('feed', 'reels', 'video', 'stories') then raise exception 'Formato inválido.' using errcode = '22023'; end if;
  if p_at < now() + interval '5 minutes' then raise exception 'Escolha um horário a partir de 5 minutos daqui.' using errcode = '22023'; end if;
  if p_at > now() + interval '75 days' then raise exception 'Programe com até 75 dias de antecedência.' using errcode = '22023'; end if;
  if v_vid > 1 then raise exception 'Use um vídeo só: o arquivo ou o link do Drive.' using errcode = '22023'; end if;
  if p_format = 'feed' and (v_vid > 0 or v_imgs = 0) then raise exception 'Feed leva de 1 a 10 imagens. Para vídeo, use Reels ou Vídeo.' using errcode = '22023'; end if;
  if p_format in ('reels', 'video') and (v_vid <> 1 or v_imgs > 0) then raise exception 'Reels e Vídeo levam um vídeo, sem imagens.' using errcode = '22023'; end if;
  if p_format = 'stories' and v_imgs + v_vid <> 1 then raise exception 'Stories leva uma imagem ou um vídeo.' using errcode = '22023'; end if;
  foreach v_path in array coalesce(p_images, '{}') || array_remove(array[p_video_path], null) loop
    if v_path not like 'clientes/' || p_client || '/publicacoes/%' then raise exception 'Arquivo inválido para este cliente.' using errcode = 'P0001'; end if;
  end loop;
  if p_task is not null and not exists (select 1 from public.tasks t where t.id = p_task and t.client_id = p_client) then
    raise exception 'O conteúdo não é deste cliente.' using errcode = 'P0001';
  end if;

  for v_p in select * from public.social_profiles where id = any(p_profiles) loop
    if v_p.client_id is distinct from p_client then raise exception 'Perfil não é deste cliente.' using errcode = 'P0001'; end if;
    v_missing := private.profile_publish_missing(v_p.id);
    if cardinality(v_missing) > 0 then
      raise exception 'Ainda não dá para publicar em %: falta %.', coalesce('@' || v_p.username, v_p.name), array_to_string(v_missing, ', ') using errcode = 'P0001';
    end if;
    if v_p.platform = 'instagram' then
      if char_length(coalesce(p_caption, '')) > 2200 then raise exception 'A legenda do Instagram aceita até 2.200 caracteres.' using errcode = '22023'; end if;
      if (select count(*) from regexp_matches(coalesce(p_caption, ''), '#[[:alnum:]_]+', 'g')) > 30 then
        raise exception 'O Instagram aceita até 30 hashtags.' using errcode = '22023';
      end if;
    end if;
    insert into public.post_schedules (organization_id, client_id, profile_id, task_id, format, caption, images, video_path, video_drive_id, scheduled_at, created_by)
    values (v_org, p_client, v_p.id, p_task, p_format, case when p_format = 'stories' then '' else coalesce(p_caption, '') end,
            coalesce(p_images, '{}'), p_video_path, p_video_drive_id, p_at, auth.uid())
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  if cardinality(v_ids) <> cardinality(p_profiles) then raise exception 'Perfil não encontrado.' using errcode = 'P0002'; end if;
  return v_ids;
end;
$$;
revoke all on function public.schedule_post(uuid, uuid[], text, text, text[], text, text, timestamptz, uuid) from public, anon;
grant execute on function public.schedule_post(uuid, uuid[], text, text, text[], text, text, timestamptz, uuid) to authenticated;

-- Cancelar (agendada ou com erro) e reagendar (agendada, com erro ou cancelada: volta para a fila).
create or replace function public.cancel_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.post_schedules;
begin
  select * into v from public.post_schedules where id = p_id and organization_id = private.org_id() for update;
  if v.id is null then raise exception 'Publicação não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_client('content.publish', v.client_id) then raise exception 'Você não tem permissão para esta publicação.' using errcode = '42501'; end if;
  if v.status not in ('agendado', 'erro') then raise exception 'Esta publicação já foi % e não pode ser cancelada.', v.status using errcode = 'P0001'; end if;
  update public.post_schedules set status = 'cancelado' where id = p_id;
end;
$$;

create or replace function public.reschedule_post(p_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.post_schedules;
  v_missing text[];
begin
  select * into v from public.post_schedules where id = p_id and organization_id = private.org_id() for update;
  if v.id is null then raise exception 'Publicação não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_client('content.publish', v.client_id) then raise exception 'Você não tem permissão para esta publicação.' using errcode = '42501'; end if;
  if v.status not in ('agendado', 'erro', 'cancelado') then raise exception 'Esta publicação já foi % e não pode ser reagendada.', v.status using errcode = 'P0001'; end if;
  if p_at < now() + interval '5 minutes' then raise exception 'Escolha um horário a partir de 5 minutos daqui.' using errcode = '22023'; end if;
  if p_at > now() + interval '75 days' then raise exception 'Programe com até 75 dias de antecedência.' using errcode = '22023'; end if;
  v_missing := private.profile_publish_missing(v.profile_id);
  if cardinality(v_missing) > 0 then raise exception 'Ainda não dá para publicar neste perfil: falta %.', array_to_string(v_missing, ', ') using errcode = 'P0001'; end if;
  update public.post_schedules set status = 'agendado', scheduled_at = p_at, attempts = 0, container_id = null, error = null where id = p_id;
end;
$$;
revoke all on function public.cancel_post(uuid), public.reschedule_post(uuid, timestamptz) from public, anon;
grant execute on function public.cancel_post(uuid), public.reschedule_post(uuid, timestamptz) to authenticated;

-- Fila (só o servidor): pega as vencidas e as que esperam o Instagram processar o vídeo.
create or replace function public.claim_due_posts(p_limit integer)
returns table (id uuid, organization_id uuid, client_id uuid, profile_id uuid, container_id text, attempts integer)
language sql
security definer
set search_path = ''
as $$
  update public.post_schedules s
     set status = 'publicando', attempts = s.attempts + 1
   where s.id in (
     select x.id from public.post_schedules x
      where (x.status = 'agendado' and x.scheduled_at <= now())
         or (x.status = 'publicando' and x.updated_at < now() - interval '4 minutes')
      order by x.scheduled_at
      limit p_limit
      for update skip locked)
  returning s.id, s.organization_id, s.client_id, s.profile_id, s.container_id, s.attempts;
$$;

-- Resultado de uma publicação. Publicada ou com erro: avisa quem programou; o link vai para o conteúdo do cronograma.
create or replace function public.finish_post(p_id uuid, p_status text, p_external text, p_permalink text, p_error text, p_container text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.post_schedules;
  v_profile text;
  v_client text;
begin
  if p_status not in ('publicado', 'erro', 'publicando') then raise exception 'Situação inválida.' using errcode = '22023'; end if;
  update public.post_schedules p
     set status = p_status, external_id = coalesce(p_external, external_id), permalink = coalesce(p_permalink, permalink),
         error = case when p_status = 'erro' then left(coalesce(p_error, 'Falha ao publicar.'), 500) else null end,
         container_id = coalesce(p_container, container_id),
         published_at = case when p_status = 'publicado' then now() else published_at end
   where id = p_id
  returning * into v;
  if v.id is null or p_status = 'publicando' then return; end if;
  select coalesce('@' || p.username, p.name) into v_profile from public.social_profiles p where p.id = v.profile_id;
  select c.name into v_client from public.clients c where c.id = v.client_id;
  if p_status = 'publicado' and v.task_id is not null and v.permalink is not null then
    update public.task_content set post_url = v.permalink, updated_at = now() where task_id = v.task_id and (post_url is null or post_url = '');
  end if;
  if v.created_by is not null then
    perform public.notify_users(
      array[v.created_by], 'post',
      case when p_status = 'publicado' then 'Publicado em ' || v_profile else 'Não publicou em ' || v_profile end,
      v_client || case when p_status = 'publicado' then '.' else ': ' || coalesce(v.error, 'falha ao publicar.') end,
      '/clientes/' || v.client_id || '/redes#programacao',
      'post:' || v.id || ':' || p_status, null);
  end if;
end;
$$;
revoke all on function public.claim_due_posts(integer), public.finish_post(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_posts(integer), public.finish_post(uuid, text, text, text, text, text) to service_role;




-- Retomar só o que espera o Instagram processar (tem contêiner). Publicação interrompida no meio sem contêiner não é
-- refeita (poderia duplicar o post): vira erro para a pessoa conferir no perfil antes de reagendar.
create or replace function public.claim_due_posts(p_limit integer)
returns table (id uuid, organization_id uuid, client_id uuid, profile_id uuid, container_id text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.post_schedules p
     set status = 'erro', error = 'A publicação foi interrompida no meio. Confira no perfil se saiu antes de reagendar.'
   where p.status = 'publicando' and p.container_id is null and p.updated_at < now() - interval '15 minutes';
  return query
  update public.post_schedules s
     set status = 'publicando', attempts = s.attempts + 1
   where s.id in (
     select x.id from public.post_schedules x
      where (x.status = 'agendado' and x.scheduled_at <= now())
         or (x.status = 'publicando' and x.container_id is not null and x.updated_at < now() - interval '4 minutes')
      order by x.scheduled_at
      limit p_limit
      for update skip locked)
  returning s.id, s.organization_id, s.client_id, s.profile_id, s.container_id, s.attempts;
end;
$$;
revoke all on function public.claim_due_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_posts(integer) to service_role;

-- Fila a cada 5 minutos.
select cron.schedule('extend-publicacoes', '*/5 * * * *', $$select private.call_job('publish-posts')$$);
