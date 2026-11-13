-- =============================================================================
-- Treinamentos (prompt ERP 3.8, adaptado à Extend)
--  · Trilhas com aulas em ordem: texto, vídeo (YouTube, Loom, Drive, Vimeo) e
--    arquivo (PDF, slides) no bucket privado "treinamentos".
--  · Cada pessoa marca as aulas que concluiu; o progresso é calculado.
--  · A gestão atribui treinamentos a pessoas (com prazo opcional): quem recebe é
--    avisado; quem atribuiu é avisado quando a pessoa conclui; prazo vencido avisa.
--  · Permissões: trainings.read (ver) e trainings.manage (criar, editar, atribuir).
--    Sem pontuação nem ranking (decisão da Extend em 13/11/2026).
-- =============================================================================

insert into public.permissions (key, module, label, scoped, position) values
  ('trainings.read',   'Equipe', 'Ver treinamentos', false, 84),
  ('trainings.manage', 'Equipe', 'Criar treinamentos e atribuir à equipe', false, 85)
on conflict (key) do nothing;

-- Todo papel vê os treinamentos; admin, coordenação de conteúdo e gerente de tráfego gerenciam.
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'trainings.read', 'all' from public.roles r
on conflict do nothing;
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'trainings.manage', 'all' from public.roles r where r.key in ('admin', 'coord_conteudo', 'gerente_trafego')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.trainings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 120),
  summary          text check (char_length(summary) <= 600),
  category         text not null default 'geral'
                   check (category in ('sistema', 'processos', 'trafego', 'conteudo', 'design', 'video', 'comercial', 'atendimento', 'geral')),
  is_published     boolean not null default false,
  position         int not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.training_lessons (
  id               uuid primary key default gen_random_uuid(),
  training_id      uuid not null references public.trainings (id) on delete cascade,
  position         int not null default 0,
  title            text not null check (char_length(title) between 2 and 160),
  body             text check (char_length(body) <= 20000),
  video_url        text check (video_url ~ '^https://' and char_length(video_url) <= 600),
  file_path        text check (file_path ~ '^[0-9a-f-]{36}/'),
  file_name        text check (char_length(file_name) <= 200),
  duration_min     int check (duration_min between 1 and 600),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((file_path is null) = (file_name is null))
);

create index training_lessons_training_idx on public.training_lessons (training_id, position);

create table public.training_progress (
  lesson_id     uuid not null references public.training_lessons (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (lesson_id, profile_id)
);

create index training_progress_profile_idx on public.training_progress (profile_id);

create table public.training_assignments (
  id            uuid primary key default gen_random_uuid(),
  training_id   uuid not null references public.trainings (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  due_on        date,
  assigned_by   uuid references public.profiles (id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (training_id, profile_id)
);

create index training_assignments_profile_idx on public.training_assignments (profile_id);

create trigger trainings_updated_at before update on public.trainings
  for each row execute function private.set_updated_at();
create trigger training_lessons_updated_at before update on public.training_lessons
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- O treinamento pode ser visto pela pessoa atual? (publicado, ou ela gerencia)
create or replace function private.can_see_training(p_training uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trainings t
     where t.id = p_training and t.organization_id = private.org_id()
       and (private.has_perm('trainings.manage') or (t.is_published and private.has_perm('trainings.read'))));
$$;

grant execute on function private.can_see_training(uuid) to authenticated;

alter table public.trainings enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_progress enable row level security;
alter table public.training_assignments enable row level security;

create policy trainings_select on public.trainings for select to authenticated
  using (organization_id = (select private.org_id())
         and ((select private.has_perm('trainings.manage')) or (is_published and (select private.has_perm('trainings.read')))));
create policy trainings_write on public.trainings for all to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('trainings.manage')))
  with check (organization_id = (select private.org_id()) and (select private.has_perm('trainings.manage')));

create policy training_lessons_select on public.training_lessons for select to authenticated
  using ((select private.can_see_training(training_id)));
create policy training_lessons_write on public.training_lessons for all to authenticated
  using ((select private.has_perm('trainings.manage')) and (select private.can_see_training(training_id)))
  with check ((select private.has_perm('trainings.manage')) and (select private.can_see_training(training_id)));

-- Progresso: cada um marca o seu; a gestão lê o de todos.
create policy training_progress_select on public.training_progress for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.has_perm('trainings.manage')));
create policy training_progress_insert on public.training_progress for insert to authenticated
  with check (profile_id = (select auth.uid())
              and exists (select 1 from public.training_lessons l where l.id = lesson_id and private.can_see_training(l.training_id)));
create policy training_progress_delete on public.training_progress for delete to authenticated
  using (profile_id = (select auth.uid()));

create policy training_assignments_select on public.training_assignments for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.has_perm('trainings.manage')));
create policy training_assignments_write on public.training_assignments for all to authenticated
  using ((select private.has_perm('trainings.manage')) and (select private.can_see_training(training_id)))
  with check ((select private.has_perm('trainings.manage')) and (select private.can_see_training(training_id))
              and exists (select 1 from public.profiles p where p.id = profile_id and p.organization_id = (select private.org_id())));

revoke update (completed_at) on public.training_assignments from authenticated;

-- -----------------------------------------------------------------------------
-- Avisos
-- -----------------------------------------------------------------------------
-- Atribuiu → a pessoa é avisada (só se o treinamento estiver publicado).
create or replace function private.training_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.trainings;
begin
  select * into v_t from public.trainings where id = new.training_id;
  if v_t.is_published then
    perform private.notify(array[new.profile_id], 'training', 'Novo treinamento para você: ' || v_t.title,
      case when new.due_on is not null then 'Concluir até ' || to_char(new.due_on, 'DD/MM/YYYY') || '.' else null end,
      '/treinamentos/' || v_t.id, 'training_assigned:' || new.id);
  end if;
  return new;
end;
$$;

create trigger training_assignments_notify after insert on public.training_assignments
  for each row execute function private.training_assigned();

-- Publicou depois de atribuir → avisa quem já estava na lista.
create or replace function private.training_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a record;
begin
  if new.is_published and not old.is_published then
    for v_a in select * from public.training_assignments where training_id = new.id and completed_at is null loop
      perform private.notify(array[v_a.profile_id], 'training', 'Novo treinamento para você: ' || new.title,
        case when v_a.due_on is not null then 'Concluir até ' || to_char(v_a.due_on, 'DD/MM/YYYY') || '.' else null end,
        '/treinamentos/' || new.id, 'training_assigned:' || v_a.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger trainings_published after update of is_published on public.trainings
  for each row execute function private.training_published();

-- Concluiu a última aula → marca a atribuição e avisa quem atribuiu.
create or replace function private.training_progress_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training uuid;
  v_title text;
  v_name text;
  v_a public.training_assignments;
begin
  select l.training_id, t.title into v_training, v_title
    from public.training_lessons l join public.trainings t on t.id = l.training_id where l.id = new.lesson_id;
  if exists (
    select 1 from public.training_lessons l
     where l.training_id = v_training
       and not exists (select 1 from public.training_progress p where p.lesson_id = l.id and p.profile_id = new.profile_id)) then
    return new;
  end if;

  update public.training_assignments set completed_at = now()
   where training_id = v_training and profile_id = new.profile_id and completed_at is null
  returning * into v_a;
  if v_a.id is not null and v_a.assigned_by is not null then
    select full_name into v_name from public.profiles where id = new.profile_id;
    perform private.notify(array[v_a.assigned_by], 'training', v_name || ' concluiu o treinamento ' || v_title,
      null, '/treinamentos/' || v_training || '?aba=equipe', 'training_done:' || v_a.id);
  end if;
  return new;
end;
$$;

create trigger training_progress_done after insert on public.training_progress
  for each row execute function private.training_progress_done();

-- Prazo vencido (todo dia às 06:10 em São Paulo).
create or replace function private.trainings_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a record;
  v_count int := 0;
begin
  for v_a in
    select a.*, t.title from public.training_assignments a join public.trainings t on t.id = a.training_id
     where a.completed_at is null and t.is_published and a.due_on is not null and a.due_on < private.today_sp()
  loop
    v_count := v_count + private.notify(array[v_a.profile_id], 'training', 'Treinamento atrasado: ' || v_a.title,
      'O prazo era ' || to_char(v_a.due_on, 'DD/MM/YYYY') || '.', '/treinamentos/' || v_a.training_id, 'training_late:' || v_a.id);
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.trainings_tick(), private.training_assigned(), private.training_published(), private.training_progress_done()
  from public, anon, authenticated;
select cron.schedule('extend-treinamentos', '10 9 * * *', $$select private.trainings_tick()$$);

-- -----------------------------------------------------------------------------
-- Storage: bucket privado "treinamentos" — caminho <training_id>/<arquivo>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('treinamentos', 'treinamentos', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create or replace function private.storage_training(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end;
$$;

grant execute on function private.storage_training(text) to authenticated;

create policy treinamentos_select on storage.objects for select to authenticated
  using (bucket_id = 'treinamentos' and (select private.can_see_training(private.storage_training(name))));
create policy treinamentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'treinamentos' and (select private.has_perm('trainings.manage'))
              and (select private.can_see_training(private.storage_training(name))));
create policy treinamentos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'treinamentos' and (select private.has_perm('trainings.manage')));

-- -----------------------------------------------------------------------------
-- Primeiro treinamento: o próprio sistema (conteúdo real, editável)
-- -----------------------------------------------------------------------------
with t as (
  insert into public.trainings (organization_id, title, summary, category, is_published, position)
  select o.id, 'Primeiros passos no Sistema Extend',
         'Como encontrar suas demandas, mover etapas, falar com a equipe e receber os avisos no celular.',
         'sistema', true, 0
    from public.organizations o
  returning id
)
insert into public.training_lessons (training_id, position, title, body, duration_min)
select t.id, x.pos, x.title, x.body, x.min from t cross join (values
  (1, 'Instale o app e ligue os avisos',
   E'O sistema funciona como aplicativo no celular.\n\nNo Android (Chrome): abra o sistema, toque nos três pontinhos e em "Instalar app".\nNo iPhone (Safari): toque em Compartilhar e em "Adicionar à Tela de Início". Depois abra pelo ícone novo.\n\nEm Configurações → Notificações, ligue os avisos neste aparelho e escolha o que quer receber. Use "Enviar teste" para conferir.', 3),
  (2, 'Suas demandas',
   E'Em "Minhas tarefas" ficam as demandas em que você é responsável, nas abas Hoje, Atrasadas, Próximos 7 dias, Aguardando outra pessoa, Todas abertas e Concluídas.\n\nToque numa demanda para ver a descrição, o checklist, os anexos e os comentários. O botão da etapa (por exemplo "Em edição" → "Revisão") leva a demanda para a próxima pessoa do fluxo, e ela é avisada na hora.', 4),
  (3, 'Comentários e menções',
   E'Use os comentários da demanda para tudo o que for sobre ela, em vez do WhatsApp: fica registrado para quem pegar depois.\n\nDigite @ e o nome para chamar alguém. A pessoa recebe um aviso com o link direto.', 2),
  (4, 'Central do cliente',
   E'Em Clientes, cada cliente tem a sua central, com as abas Visão geral, Ficha, Reuniões, Controle de Mídias, Quadros, Ideias e referências, Arquivos e Histórico (cada pessoa vê as abas do seu trabalho).\n\nO "Controle de Mídias" mostra o que foi contratado no mês e o que já foi entregue. Antes de produzir, confira a Ficha (briefing) e as observações do cliente.', 4),
  (5, 'Quando algo não funcionar',
   E'Se uma tela der erro, tente de novo uma vez. Se continuar, avise a coordenação com o print e o que você estava fazendo.\n\nSe você precisa ver algo que não aparece no seu menu, peça para quem administra o sistema liberar a permissão: o menu mostra só o que você pode usar.', 2)
) as x(pos, title, body, min);
