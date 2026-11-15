-- Briefing de mídias 3.9: relatório semanal enviado ao cliente (tráfego e conteúdo) e o retorno dele.
-- Negativo → a equipe da área é avisada (estudo e ajuste); Positivo → fica no histórico; Sem retorno →
-- vira demanda "Ligar para o cliente" para o responsável pela comunicação. Alertas: relatório da semana
-- atrasado e retorno não registrado 2 dias úteis depois do envio.
-- Enquanto a sincronização e o WhatsApp não existem, o envio é registrado aqui (com o link do Reportei,
-- do PDF ou do print); com a etapa 06, o envio automático grava a mesma linha.

create table public.client_reports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  area            text not null check (area in ('trafego', 'conteudo')),
  -- segunda-feira da semana do envio (um relatório por cliente, área e semana)
  week_on         date not null default date_trunc('week', private.today_sp())::date,
  sent_on         date not null default private.today_sp(),
  link            text check (link ~ '^https?://' and char_length(link) <= 500),
  notes           text check (char_length(notes) <= 1000),
  sent_by         uuid references public.profiles (id) on delete set null,
  feedback        text check (feedback in ('positivo', 'negativo', 'sem_retorno')),
  feedback_note   text check (char_length(feedback_note) <= 1000),
  feedback_by     uuid references public.profiles (id) on delete set null,
  feedback_at     timestamptz,
  call_task_id    uuid references public.tasks (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (client_id, area, week_on)
);
create index client_reports_waiting on public.client_reports (sent_on) where feedback is null;

-- Quem envia o relatório da área: tráfego = reports.manage; conteúdo = content.publish (social media).
create or replace function private.can_report(p_area text, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_area when 'trafego' then private.can_client('reports.manage', p_client)
                     when 'conteudo' then private.can_client('content.publish', p_client)
                     else false end;
$$;
revoke all on function private.can_report(text, uuid) from public, anon;
grant execute on function private.can_report(text, uuid) to authenticated;

-- A área vale para o cliente com o serviço: tráfego = anúncios; conteúdo = gerenciamento.
create or replace function private.report_area_applies(p_area text, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_area when 'trafego' then 'anuncios' = any (private.client_service_tabs(p_client))
                     else 'gerenciamento' = any (private.client_service_tabs(p_client)) end;
$$;
revoke all on function private.report_area_applies(text, uuid) from public, anon, authenticated;

-- Responsável pela comunicação do cliente (sem depender da RLS de clients).
create or replace function private.owns_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clients c where c.id = p_client and c.owner_id = auth.uid() and c.deleted_at is null);
$$;
revoke all on function private.owns_client(uuid) from public, anon;
grant execute on function private.owns_client(uuid) to authenticated;

-- Setor da equipe que responde pela área no cliente.
create or replace function private.report_team(p_area text, p_client uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.profile_id), '{}')
    from public.client_members m
    join public.sectors s on s.id = m.sector_id and s.key = case p_area when 'trafego' then 'trafego' else 'gerenciamento' end
    join public.profiles p on p.id = m.profile_id and p.is_active
   where m.client_id = p_client;
$$;
revoke all on function private.report_team(text, uuid) from public, anon, authenticated;

create or replace function private.client_report_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_who uuid;
  v_area text := case new.area when 'trafego' then 'tráfego' else 'conteúdo' end;
begin
  if tg_op = 'UPDATE' then
    new.client_id := old.client_id;
    new.area := old.area;
    new.sent_by := old.sent_by;
    new.created_at := old.created_at;
    new.call_task_id := old.call_task_id;
  else
    new.sent_by := coalesce(auth.uid(), new.sent_by);
    new.call_task_id := null;
    if not private.report_area_applies(new.area, new.client_id) then
      raise exception 'Este cliente não tem o serviço desta área (anúncios para tráfego, gerenciamento para conteúdo).' using errcode = 'P0001';
    end if;
  end if;
  select * into v_client from public.clients where id = new.client_id;
  new.organization_id := v_client.organization_id;
  if new.sent_on > private.today_sp() then
    raise exception 'A data de envio não pode ser no futuro.' using errcode = 'P0001';
  end if;
  new.week_on := date_trunc('week', new.sent_on)::date;
  new.link := nullif(btrim(new.link), '');
  new.notes := nullif(btrim(new.notes), '');
  new.feedback_note := nullif(btrim(new.feedback_note), '');

  if new.feedback is null then
    new.feedback_note := null;
    new.feedback_by := null;
    new.feedback_at := null;
  else
    if new.feedback = 'negativo' and char_length(coalesce(new.feedback_note, '')) < 3 then
      raise exception 'Conte o que o cliente achou ruim.' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' or new.feedback is distinct from old.feedback or new.feedback_note is distinct from old.feedback_note then
      new.feedback_by := coalesce(auth.uid(), new.feedback_by);
      new.feedback_at := now();
    else
      new.feedback_by := old.feedback_by;
      new.feedback_at := old.feedback_at;
    end if;
  end if;

  -- Sem retorno: demanda para ligar (uma por relatório), para o responsável pela comunicação.
  if new.feedback = 'sem_retorno' and new.call_task_id is null then
    select p.id into v_who from public.profiles p where p.id = v_client.owner_id and p.is_active;
    v_who := coalesce(v_who, new.sent_by, auth.uid());
    insert into public.tasks (organization_id, client_id, type, title, description, priority, assignee_id, due_at, created_by)
    values (v_client.organization_id, new.client_id, 'geral',
            'Ligar para ' || v_client.name || ': sem retorno do relatório de ' || v_area,
            'O cliente não respondeu ao relatório de ' || v_area || ' da semana de ' || to_char(new.week_on, 'DD/MM')
              || '. Ligue para saber como estão os leads e as vendas, e registre o retorno na aba Relatórios do cliente.',
            'alta', v_who,
            (private.add_business_days(private.today_sp(), 1) + time '12:00') at time zone 'America/Sao_Paulo',
            auth.uid())
    returning id into new.call_task_id;
  end if;
  return new;
end;
$$;
create trigger client_reports_defaults before insert or update on public.client_reports
  for each row execute function private.client_report_defaults();

-- Retorno registrado: histórico do cliente; negativo avisa a equipe da área e o responsável pela comunicação.
create or replace function private.client_report_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients;
  v_area text := case new.area when 'trafego' then 'tráfego' else 'conteúdo' end;
  v_label text;
  v_to uuid[];
begin
  if new.feedback is null or (tg_op = 'UPDATE' and new.feedback is not distinct from old.feedback and new.feedback_note is not distinct from old.feedback_note) then
    return null;
  end if;
  select * into v_client from public.clients where id = new.client_id;
  v_label := case new.feedback when 'positivo' then 'positivo' when 'negativo' then 'negativo' else 'sem retorno' end;
  perform private.timeline(new.client_id, 'relatorio',
    'Retorno ao relatório de ' || v_area || ' da semana de ' || to_char(new.week_on, 'DD/MM') || ': ' || v_label
    || coalesce(' (' || left(new.feedback_note, 200) || ')', ''));

  if new.feedback = 'negativo' and (tg_op = 'INSERT' or old.feedback is distinct from 'negativo') then
    v_to := array(select distinct u from unnest(private.report_team(new.area, new.client_id) || v_client.owner_id) u
                   where u is not null and u is distinct from auth.uid());
    perform public.notify_users(v_to, 'client_report', 'Retorno negativo: ' || v_client.name,
      'Relatório de ' || v_area || ': ' || left(new.feedback_note, 300)
      || case new.area when 'trafego' then '. Próximo passo: estudar e ajustar as campanhas.' else '. Próximo passo: rever o conteúdo com a equipe.' end,
      '/clientes/' || new.client_id || '/relatorios', 'report_negative:' || new.id, auth.uid());
  end if;
  return null;
end;
$$;
create trigger client_reports_events after insert or update on public.client_reports
  for each row execute function private.client_report_events();

alter table public.client_reports enable row level security;
create policy client_reports_select on public.client_reports for select to authenticated
  using (private.can_client('clients.read', client_id)
         or private.owns_client(client_id));
create policy client_reports_insert on public.client_reports for insert to authenticated
  with check (private.can_report(area, client_id));
-- Quem envia corrige e registra o retorno; o responsável pela comunicação também registra o retorno.
create policy client_reports_update on public.client_reports for update to authenticated
  using (private.can_report(area, client_id)
         or private.owns_client(client_id));
create policy client_reports_delete on public.client_reports for delete to authenticated
  using (private.can_report(area, client_id) and feedback is null);
revoke all on public.client_reports from anon, authenticated;
grant select, delete on public.client_reports to authenticated;
grant insert (client_id, area, sent_on, link, notes, feedback, feedback_note) on public.client_reports to authenticated;
grant update (sent_on, link, notes, feedback, feedback_note) on public.client_reports to authenticated;

-- Painel "Relatórios da semana": por cliente e área em que a pessoa envia ou responde pela comunicação.
create or replace function public.report_routine()
returns table (
  client_id uuid, client_name text, client_code int, area text, can_send boolean,
  report_id uuid, sent_on date, link text, sent_by text, feedback text, feedback_note text,
  last_sent_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select date_trunc('week', private.today_sp())::date as monday)
  select c.id, c.name, c.code, a.area, private.can_report(a.area, c.id),
         r.id, r.sent_on, r.link, p.full_name, r.feedback, r.feedback_note,
         (select max(x.sent_on) from public.client_reports x where x.client_id = c.id and x.area = a.area)
    from public.clients c
    cross join (values ('trafego'), ('conteudo')) a(area)
    cross join d
    left join public.client_reports r on r.client_id = c.id and r.area = a.area and r.week_on = d.monday
    left join public.profiles p on p.id = r.sent_by
   where c.deleted_at is null and c.status = 'ativo'
     and private.report_area_applies(a.area, c.id)
     and (private.can_report(a.area, c.id) or c.owner_id = auth.uid())
   order by c.name, a.area desc;
$$;
revoke all on function public.report_routine() from public, anon;
grant execute on function public.report_routine() to authenticated;

-- Dias úteis às 10h: a partir de quarta, relatório da semana em aberto (equipe da área, uma vez por semana);
-- retorno não registrado 2 dias úteis depois do envio (quem enviou, uma vez por relatório).
create or replace function private.client_reports_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
  v_monday date := date_trunc('week', private.today_sp())::date;
  r record;
begin
  if not private.is_business_day(v_today) then return; end if;

  if extract(isodow from v_today) >= 3 then
    for r in
      select u.profile_id, a.area, array_agg(distinct c.name order by c.name) as names
        from public.clients c
        cross join (values ('trafego'), ('conteudo')) a(area)
        cross join lateral unnest(private.report_team(a.area, c.id)) u(profile_id)
       where c.deleted_at is null and c.status = 'ativo'
         and private.report_area_applies(a.area, c.id)
         and not exists (select 1 from public.client_reports x where x.client_id = c.id and x.area = a.area and x.week_on = v_monday)
       group by u.profile_id, a.area
    loop
      perform public.notify_users(array[r.profile_id], 'client_report',
        'Relatório de ' || case r.area when 'trafego' then 'tráfego' else 'conteúdo' end || ' da semana: '
        || cardinality(r.names) || case when cardinality(r.names) = 1 then ' cliente' else ' clientes' end || ' sem envio',
        array_to_string(r.names[1:8], ', ') || case when cardinality(r.names) > 8 then ' e mais ' || (cardinality(r.names) - 8) else '' end || '.',
        '/relatorios', 'report_late:' || r.area || ':' || v_monday, null);
    end loop;
  end if;

  for r in
    select x.id, x.client_id, x.area, x.sent_by, c.name
      from public.client_reports x
      join public.clients c on c.id = x.client_id and c.deleted_at is null
      join public.profiles p on p.id = x.sent_by and p.is_active
     where x.feedback is null
       and x.sent_on >= v_today - 21
       and private.add_business_days(x.sent_on, 2) <= v_today
  loop
    perform public.notify_users(array[r.sent_by], 'client_report', 'Sem retorno registrado: ' || r.name,
      'Já são 2 dias úteis desde o relatório de ' || case r.area when 'trafego' then 'tráfego' else 'conteúdo' end
      || '. Registre o retorno; se o cliente não respondeu, marque "Sem retorno" para gerar a ligação.',
      '/clientes/' || r.client_id || '/relatorios', 'report_feedback:' || r.id, null);
  end loop;
end;
$$;
revoke all on function private.client_reports_tick() from public, anon, authenticated;

-- Dias úteis às 10h (Brasília = UTC-3)
select cron.schedule('extend-relatorios-retorno', '0 13 * * 1-5', $$select private.client_reports_tick()$$);
