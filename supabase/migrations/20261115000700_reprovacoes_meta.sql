-- Briefing do Luiz, 2ª fase: histórico de reprovações da Meta (RF-T2-02).
-- Registro manual agora (o gestor copia o motivo que a Meta deu); com a sincronização entram as
-- reprovações detectadas na API (source = 'sync'). Consolidado por motivo, formato e ângulo e mostrado
-- no pedido de criativo como "o que evitar".

create table public.ad_rejections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  library_id      uuid references public.creative_library (id) on delete set null,
  platform        text not null default 'meta' check (platform in ('meta', 'google')),
  rejected_on     date not null default private.today_sp(),
  format          text not null check (format in ('imagem', 'video', 'story', 'carrossel', 'reels')),
  angle           text not null check (char_length(angle) between 2 and 300),
  reason          text not null check (reason in ('atributos_pessoais', 'antes_depois', 'promessa', 'saude', 'financeiro', 'sensacionalista', 'adulto', 'marca', 'destino', 'funcionalidade', 'tema_social', 'outro')),
  policy_text     text not null check (char_length(policy_text) between 3 and 1000),
  ad_name         text check (char_length(ad_name) <= 200),
  outcome         text check (outcome in ('corrigido', 'contestado_aprovado', 'contestado_negado', 'descartado')),
  lesson          text check (char_length(lesson) <= 500),
  source          text not null default 'manual' check (source in ('manual', 'sync')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index ad_rejections_client on public.ad_rejections (client_id, rejected_on desc, created_at desc);
create index ad_rejections_library on public.ad_rejections (library_id) where library_id is not null;
create trigger ad_rejections_updated_at before update on public.ad_rejections for each row execute function private.set_updated_at();

-- Organização, autor e origem vêm do servidor; o criativo da biblioteca precisa ser do cliente.
create or replace function private.ad_rejection_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if auth.uid() is not null then new.source := 'manual'; end if;
  else
    new.created_by := old.created_by;
    new.client_id := old.client_id;
    new.organization_id := old.organization_id;
    new.source := old.source;
  end if;
  if new.rejected_on > private.today_sp() then
    raise exception 'A data da reprovação não pode ser no futuro.' using errcode = 'P0001';
  end if;
  if new.library_id is not null
     and not exists (select 1 from public.creative_library l where l.id = new.library_id and l.client_id = new.client_id) then
    raise exception 'Este criativo não é deste cliente.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger ad_rejections_defaults before insert or update on public.ad_rejections for each row execute function private.ad_rejection_defaults();

create or replace function private.ad_rejection_reason_label(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'atributos_pessoais' then 'atributos pessoais'
    when 'antes_depois' then 'antes e depois / imagem corporal'
    when 'promessa' then 'promessa de resultado'
    when 'saude' then 'saúde e procedimentos'
    when 'financeiro' then 'serviços financeiros'
    when 'sensacionalista' then 'conteúdo sensacionalista'
    when 'adulto' then 'conteúdo adulto ou sugestivo'
    when 'marca' then 'marca ou direitos autorais'
    when 'destino' then 'página de destino'
    when 'funcionalidade' then 'funcionalidade falsa'
    when 'tema_social' then 'tema social ou político'
    else 'outro motivo' end;
$$;

-- Ao registrar: criativo da biblioteca vira "Reprovado pela Meta", entra no histórico do cliente e avisa
-- a equipe de tráfego do cliente e quem pediu e produziu o criativo (menos quem registrou).
create or replace function private.ad_rejection_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client text;
  v_team uuid[];
  v_users uuid[];
  v_task uuid;
begin
  select name into v_client from public.clients where id = new.client_id;
  if new.library_id is not null then
    update public.creative_library set status = 'reprovado_meta' where id = new.library_id returning task_id into v_task;
  end if;
  perform private.timeline(new.client_id, 'trafego',
    'Anúncio reprovado pela ' || case new.platform when 'google' then 'Google' else 'Meta' end || ': '
    || private.ad_rejection_reason_label(new.reason) || ' (' || new.angle || ')');
  -- Equipe de tráfego do cliente: abre a aba Tráfego.
  select array_agg(distinct m.profile_id) into v_team
    from public.client_members m join public.sectors s on s.id = m.sector_id and s.key = 'trafego'
   where m.client_id = new.client_id;
  if v_team is not null then
    perform public.notify_users(v_team, 'ad_alert', 'Anúncio reprovado: ' || v_client,
      'Motivo: ' || private.ad_rejection_reason_label(new.reason) || '. ' || left(new.policy_text, 160),
      '/clientes/' || new.client_id || '/trafego#reprovacoes', 'reprovacao:' || new.id, auth.uid());
  end if;
  -- Quem pediu e quem produziu a peça (fora da equipe de tráfego): abre o criativo.
  if v_task is not null then
    select array_agg(distinct u) into v_users from (
      select t.assignee_id as u from public.tasks t where t.id = v_task
      union select r.requested_by from public.creative_requests r where r.task_id = v_task
    ) x where u is not null and not (u = any (coalesce(v_team, '{}')));
    if v_users is not null then
      perform public.notify_users(v_users, 'ad_alert', 'Anúncio reprovado: ' || v_client,
        'Motivo: ' || private.ad_rejection_reason_label(new.reason) || '. ' || left(new.policy_text, 160),
        '/criativos/' || v_task, 'reprovacao:' || new.id, auth.uid());
    end if;
  end if;
  return null;
end;
$$;
create trigger ad_rejections_events after insert on public.ad_rejections for each row execute function private.ad_rejection_events();

-- RLS: lê quem vê o tráfego do cliente e quem pede ou produz criativos para ele (para saber o que evitar);
-- registra, corrige e apaga quem otimiza as contas do cliente. Registros automáticos não mudam.
alter table public.ad_rejections enable row level security;
create policy ad_rejections_select on public.ad_rejections for select to authenticated
  using (private.can_client('ads.read', client_id) or private.can_client('optimization.manage', client_id)
         or private.can_client('creatives.request.create', client_id) or private.can_client('creatives.produce', client_id));
create policy ad_rejections_insert on public.ad_rejections for insert to authenticated
  with check (private.can_client('optimization.manage', client_id));
create policy ad_rejections_update on public.ad_rejections for update to authenticated
  using (source = 'manual' and private.can_client('optimization.manage', client_id))
  with check (private.can_client('optimization.manage', client_id));
create policy ad_rejections_delete on public.ad_rejections for delete to authenticated
  using (source = 'manual' and private.can_client('optimization.manage', client_id));
revoke all on public.ad_rejections from anon, authenticated;
grant select, delete on public.ad_rejections to authenticated;
grant insert (client_id, library_id, platform, rejected_on, format, angle, reason, policy_text, ad_name, outcome, lesson) on public.ad_rejections to authenticated;
grant update (library_id, platform, rejected_on, format, angle, reason, policy_text, ad_name, outcome, lesson) on public.ad_rejections to authenticated;
