-- Cadências de follow-up (RF-CRM-06), como no HubSystem e adaptadas ao Comercial da Extend: modelos com passos
-- (dia, horário, ligação/mensagem/tarefa, instrução e mensagem); iniciar no lead cria as próximas ações (com o
-- lembrete que o Comercial já tem); a mensagem marcada sai sozinha pelo WhatsApp (job cadence-send); o lead que
-- responde no WhatsApp pausa a cadência e avisa o responsável; "não quer mais contato" encerra e bloqueia.

alter table public.leads
  add column opt_out_at timestamptz,
  add column opt_out_note text check (char_length(opt_out_note) <= 300);

create table public.cadence_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.org_id() references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 80),
  description     text not null default '' check (char_length(description) <= 300),
  is_active       boolean not null default true,
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now()
);
create unique index cadence_templates_name on public.cadence_templates (organization_id, lower(name));

create table public.cadence_steps (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.cadence_templates (id) on delete cascade,
  position     int not null,
  day_offset   int not null check (day_offset between 0 and 90),
  time_of_day  time not null default '09:00',
  kind         text not null check (kind in ('ligacao', 'mensagem', 'tarefa')),
  title        text not null check (char_length(title) between 2 and 120),
  message      text not null default '' check (char_length(message) <= 1000),
  auto_send    boolean not null default false,
  check (not auto_send or (kind = 'mensagem' and char_length(btrim(message)) > 0))
);
create index cadence_steps_template on public.cadence_steps (template_id, position);

create table public.cadence_enrollments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id         uuid not null references public.leads (id) on delete cascade,
  template_id     uuid references public.cadence_templates (id) on delete set null,
  template_name   text not null,
  status          text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida', 'cancelada')),
  reason          text check (char_length(reason) <= 200),
  paused_at       timestamptz,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  created_by      uuid references public.profiles (id) on delete set null
);
-- Uma cadência em andamento por lead.
create unique index cadence_enrollments_running on public.cadence_enrollments (lead_id) where status in ('ativa', 'pausada');

alter table public.lead_activities
  add column enrollment_id uuid references public.cadence_enrollments (id) on delete set null,
  add column auto_message  text check (char_length(auto_message) <= 1000),
  add column held_due_at   timestamptz, -- prazo guardado enquanto a cadência está pausada
  add column sent_at       timestamptz,
  add column send_error    text check (char_length(send_error) <= 300);
create index lead_activities_auto on public.lead_activities (due_at) where auto_message is not null and done_at is null;
alter table public.lead_activities drop constraint lead_activities_kind_check;
alter table public.lead_activities add constraint lead_activities_kind_check check (kind in ('ligacao', 'mensagem', 'reuniao', 'nota', 'etapa', 'sistema', 'tarefa'));

alter table public.cadence_templates enable row level security;
alter table public.cadence_steps enable row level security;
alter table public.cadence_enrollments enable row level security;
revoke all on public.cadence_templates, public.cadence_steps, public.cadence_enrollments from anon, authenticated;
grant select on public.cadence_templates, public.cadence_steps, public.cadence_enrollments to authenticated;
create policy cadence_templates_select on public.cadence_templates for select to authenticated
  using (organization_id = (select private.org_id()) and (select private.has_perm('crm.leads.read')));
create policy cadence_steps_select on public.cadence_steps for select to authenticated
  using (exists (select 1 from public.cadence_templates t where t.id = template_id));
create policy cadence_enrollments_select on public.cadence_enrollments for select to authenticated
  using ((select private.can_lead(lead_id)));
create trigger audit_cadence_templates after insert or update or delete on public.cadence_templates for each row execute function private.audit_row();

-- Salvar o modelo com os passos (substitui os passos). Só quem configura o funil.
create or replace function public.save_cadence(p_id uuid, p_name text, p_description text, p_steps jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  s jsonb;
  i int := 0;
begin
  if not private.has_perm('crm.pipeline.configure') then raise exception 'Só quem configura o funil cria cadências.' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'Dê um nome à cadência (2 a 80 caracteres).' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 15 then raise exception 'A cadência tem de 1 a 15 passos.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cadence_templates where organization_id = private.org_id() and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Já existe uma cadência com este nome.' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.cadence_templates (organization_id, name, description, updated_by) values (private.org_id(), v_name, left(btrim(coalesce(p_description, '')), 300), auth.uid()) returning id into v_id;
  else
    update public.cadence_templates set name = v_name, description = left(btrim(coalesce(p_description, '')), 300), updated_by = auth.uid(), updated_at = now()
     where id = p_id and organization_id = private.org_id() returning id into v_id;
    if v_id is null then raise exception 'Cadência não encontrada.' using errcode = 'P0002'; end if;
    delete from public.cadence_steps where template_id = v_id;
  end if;
  for s in select * from jsonb_array_elements(p_steps) loop
    i := i + 1;
    insert into public.cadence_steps (template_id, position, day_offset, time_of_day, kind, title, message, auto_send)
    values (v_id, i, (s->>'day')::int, (s->>'time')::time, s->>'kind', btrim(s->>'title'), btrim(coalesce(s->>'message', '')), coalesce((s->>'auto')::boolean, false));
  end loop;
  return v_id;
end;
$$;

create or replace function public.set_cadence_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_perm('crm.pipeline.configure') then raise exception 'Só quem configura o funil muda as cadências.' using errcode = '42501'; end if;
  update public.cadence_templates set is_active = p_active, updated_by = auth.uid(), updated_at = now() where id = p_id and organization_id = private.org_id();
  if not found then raise exception 'Cadência não encontrada.' using errcode = 'P0002'; end if;
end;
$$;

-- Primeiro nome e empresa nas mensagens.
create or replace function private.cadence_text(p_text text, p_lead public.leads)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(p_text, '{nome}', split_part(btrim(p_lead.name), ' ', 1)), '{empresa}', coalesce(p_lead.company, ''));
$$;

-- Iniciar: cada passo vira uma próxima ação do lead, na data e hora (São Paulo).
create or replace function public.enroll_lead(p_lead uuid, p_template uuid, p_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_t public.cadence_templates;
  v_id uuid;
  s public.cadence_steps;
  v_when timestamptz;
begin
  if not (private.has_perm('crm.leads.manage') and private.can_lead(p_lead)) then raise exception 'Você não cuida deste lead.' using errcode = '42501'; end if;
  select * into v_lead from public.leads where id = p_lead;
  if v_lead.opt_out_at is not null then raise exception 'Este lead pediu para não receber mais contato.' using errcode = 'P0001'; end if;
  select * into v_t from public.cadence_templates where id = p_template and organization_id = v_lead.organization_id and is_active;
  if v_t.id is null then raise exception 'Cadência não encontrada.' using errcode = 'P0002'; end if;
  if p_start is null or p_start < private.today_sp() then raise exception 'Comece hoje ou numa data futura.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.cadence_enrollments where lead_id = p_lead and status in ('ativa', 'pausada')) then
    raise exception 'Este lead já tem uma cadência em andamento. Cancele antes de começar outra.' using errcode = 'P0001';
  end if;
  insert into public.cadence_enrollments (organization_id, lead_id, template_id, template_name, created_by)
  values (v_lead.organization_id, p_lead, v_t.id, v_t.name, auth.uid()) returning id into v_id;
  for s in select * from public.cadence_steps where template_id = v_t.id order by position loop
    v_when := ((p_start + s.day_offset) + s.time_of_day) at time zone 'America/Sao_Paulo';
    -- Passo de hoje cujo horário já passou fica para daqui a pouco (não nasce atrasado).
    if v_when < now() then v_when := now() + interval '5 minutes'; end if;
    insert into public.lead_activities (lead_id, kind, body, due_at, created_by, enrollment_id, auto_message)
    values (p_lead, s.kind, left(v_t.name || ' · ' || s.title || case when s.message <> '' and not s.auto_send then E'\n' || private.cadence_text(s.message, v_lead) else '' end, 2000),
            v_when, auth.uid(), v_id, case when s.auto_send then left(private.cadence_text(s.message, v_lead), 1000) end);
  end loop;
  insert into public.lead_activities (lead_id, kind, body, created_by) values (p_lead, 'sistema', 'Cadência iniciada: ' || v_t.name, auth.uid());
  return v_id;
end;
$$;

-- Pausar guarda os prazos; retomar empurra os prazos pelo tempo parado; cancelar apaga o que faltava.
create or replace function private.cadence_change(p_id uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.cadence_enrollments;
  v_gap interval;
begin
  select * into e from public.cadence_enrollments where id = p_id for update;
  if e.id is null then raise exception 'Cadência não encontrada.' using errcode = 'P0002'; end if;
  if p_action = 'pausar' and e.status = 'ativa' then
    update public.lead_activities set held_due_at = due_at, due_at = null where enrollment_id = p_id and done_at is null and due_at is not null;
    update public.cadence_enrollments set status = 'pausada', paused_at = now(), reason = left(p_reason, 200) where id = p_id;
  elsif p_action = 'retomar' and e.status = 'pausada' then
    v_gap := now() - coalesce(e.paused_at, now());
    update public.lead_activities set due_at = greatest(held_due_at + v_gap, now() + interval '5 minutes'), held_due_at = null where enrollment_id = p_id and done_at is null and held_due_at is not null;
    update public.cadence_enrollments set status = 'ativa', paused_at = null, reason = null where id = p_id;
  elsif p_action = 'cancelar' and e.status in ('ativa', 'pausada') then
    delete from public.lead_activities where enrollment_id = p_id and done_at is null;
    update public.cadence_enrollments set status = 'cancelada', ended_at = now(), reason = left(p_reason, 200) where id = p_id;
  end if;
end;
$$;
revoke all on function private.cadence_change(uuid, text, text) from public, anon, authenticated;

create or replace function public.change_cadence(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead uuid;
begin
  select lead_id into v_lead from public.cadence_enrollments where id = p_id;
  if v_lead is null or not (private.has_perm('crm.leads.manage') and private.can_lead(v_lead)) then raise exception 'Você não cuida deste lead.' using errcode = '42501'; end if;
  if p_action not in ('pausar', 'retomar', 'cancelar') then raise exception 'Ação inválida.' using errcode = 'P0001'; end if;
  perform private.cadence_change(p_id, p_action, case p_action when 'pausar' then 'Pausada à mão' when 'cancelar' then 'Cancelada à mão' end);
  insert into public.lead_activities (lead_id, kind, body, created_by)
  values (v_lead, 'sistema', 'Cadência ' || case p_action when 'pausar' then 'pausada' when 'retomar' then 'retomada' else 'cancelada' end, auth.uid());
end;
$$;

-- "Não quer mais contato": encerra a cadência e bloqueia novas (e o envio automático).
create or replace function public.set_lead_opt_out(p_lead uuid, p_out boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
begin
  if not (private.has_perm('crm.leads.manage') and private.can_lead(p_lead)) then raise exception 'Você não cuida deste lead.' using errcode = '42501'; end if;
  update public.leads set opt_out_at = case when p_out then now() end, opt_out_note = case when p_out then left(nullif(btrim(p_note), ''), 300) end where id = p_lead;
  if p_out then
    for e in select id from public.cadence_enrollments where lead_id = p_lead and status in ('ativa', 'pausada') loop
      perform private.cadence_change(e.id, 'cancelar', 'Pediu para não receber mais contato');
    end loop;
  end if;
  insert into public.lead_activities (lead_id, kind, body, created_by)
  values (p_lead, 'sistema', case when p_out then 'Não quer mais contato' || coalesce(': ' || nullif(btrim(p_note), ''), '') else 'Voltou a aceitar contato' end, auth.uid());
end;
$$;

-- Concluída quando o último passo é feito.
create or replace function private.cadence_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.enrollment_id is not null and new.done_at is not null and old.done_at is null
     and not exists (select 1 from public.lead_activities where enrollment_id = new.enrollment_id and done_at is null) then
    update public.cadence_enrollments set status = 'concluida', ended_at = now() where id = new.enrollment_id and status = 'ativa';
  end if;
  return null;
end;
$$;
create trigger lead_activities_cadence after update of done_at on public.lead_activities for each row execute function private.cadence_progress();

-- Respondeu no WhatsApp: pausa a cadência e avisa o responsável.
create or replace function private.cadence_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
begin
  if new.lead_id is null or new.last_inbound_at is null or new.last_inbound_at is not distinct from old.last_inbound_at then return null; end if;
  for e in select c.id, l.owner_id, l.name from public.cadence_enrollments c join public.leads l on l.id = c.lead_id
            where c.lead_id = new.lead_id and c.status = 'ativa' and c.started_at < new.last_inbound_at loop
    perform private.cadence_change(e.id, 'pausar', 'Respondeu no WhatsApp');
    insert into public.lead_activities (lead_id, kind, body) values (new.lead_id, 'sistema', 'Respondeu no WhatsApp: cadência pausada');
    if e.owner_id is not null then
      perform private.notify(array[e.owner_id], 'crm', 'Respondeu: ' || e.name, 'A cadência foi pausada. Responda pelo Atendimento e retome se precisar.',
        '/comercial/leads/' || new.lead_id, 'cadence_reply:' || e.id);
    end if;
  end loop;
  return null;
end;
$$;
create trigger wa_conversations_cadence after update of last_inbound_at on public.wa_conversations for each row execute function private.cadence_on_reply();

-- Envio automático: o servidor pega as mensagens que venceram (com cadência ativa e lead que aceita contato).
create or replace function public.cadence_due_messages(p_limit int)
returns table (activity_id uuid, organization_id uuid, lead_id uuid, phone text, message text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, l.organization_id, l.id, l.phone, a.auto_message
    from public.lead_activities a
    join public.cadence_enrollments e on e.id = a.enrollment_id and e.status = 'ativa'
    join public.leads l on l.id = a.lead_id
   where a.auto_message is not null and a.done_at is null and a.due_at <= now() and a.send_error is null
     and l.opt_out_at is null and l.phone is not null
   order by a.due_at limit p_limit;
$$;
revoke all on function public.cadence_due_messages(int) from public, anon, authenticated;
grant execute on function public.cadence_due_messages(int) to service_role;

revoke all on function public.save_cadence(uuid, text, text, jsonb), public.set_cadence_active(uuid, boolean), public.enroll_lead(uuid, uuid, date),
  public.change_cadence(uuid, text), public.set_lead_opt_out(uuid, boolean, text) from public, anon;
grant execute on function public.save_cadence(uuid, text, text, jsonb), public.set_cadence_active(uuid, boolean), public.enroll_lead(uuid, uuid, date),
  public.change_cadence(uuid, text), public.set_lead_opt_out(uuid, boolean, text) to authenticated;

-- Modelos iniciais (editáveis em Configurações › Cadências).
do $$
declare
  o record;
  v uuid;
begin
  for o in select id from public.organizations loop
    insert into public.cadence_templates (organization_id, name, description) values (o.id, 'Lead novo de anúncio', 'Primeiro contato rápido com quem chegou pelo anúncio.') returning id into v;
    insert into public.cadence_steps (template_id, position, day_offset, time_of_day, kind, title, message, auto_send) values
      (v, 1, 0, '09:00', 'mensagem', 'Mensagem de boas-vindas', 'Oi, {nome}! Aqui é da Agência Extend. Vi seu interesse e quero entender o que você precisa. Qual o melhor horário para conversarmos?', false),
      (v, 2, 1, '10:00', 'ligacao', 'Ligar para qualificar', '', false),
      (v, 3, 3, '10:00', 'mensagem', 'Retomar o contato', 'Oi, {nome}! Passando para saber se ainda faz sentido conversarmos sobre o marketing da {empresa}.', false),
      (v, 4, 7, '10:00', 'ligacao', 'Última tentativa por ligação', '', false);
    insert into public.cadence_templates (organization_id, name, description) values (o.id, 'Follow-up de proposta', 'Depois de enviar a proposta, até a resposta.') returning id into v;
    insert into public.cadence_steps (template_id, position, day_offset, time_of_day, kind, title, message, auto_send) values
      (v, 1, 1, '10:00', 'mensagem', 'Conferir se recebeu a proposta', 'Oi, {nome}! Conseguiu ver a proposta que enviei? Fico à disposição para tirar dúvidas.', false),
      (v, 2, 3, '15:00', 'ligacao', 'Ligar para tirar dúvidas', '', false),
      (v, 3, 7, '10:00', 'mensagem', 'Lembrete da proposta', 'Oi, {nome}! Ainda dá tempo de começarmos este mês. Quer que eu ajuste algo na proposta?', false),
      (v, 4, 14, '10:00', 'tarefa', 'Decidir: seguir ou marcar como perdido', '', false);
  end loop;
end $$;

-- Envio automático das mensagens de cadência: de 15 em 15 minutos, das 8h às 20h.
select cron.schedule('extend-cadencias', '*/15 11-23 * * *', $$select private.call_job('cadence-send')$$);

-- Lembrete das próximas ações: a mensagem que sai sozinha só lembra o responsável se o envio falhar.
create or replace function private.crm_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(array[l.owner_id], 'crm', 'Próxima ação: ' || l.name, left(a.body, 300), '/comercial/leads/' || l.id, 'lead_action:' || a.id)
  from public.lead_activities a join public.leads l on l.id = a.lead_id
  where a.done_at is null and a.due_at is not null and a.due_at <= now() + interval '30 minutes' and l.owner_id is not null
    and (a.auto_message is null or a.send_error is not null);

  perform private.notify(array[l.owner_id], 'crm', 'Lead parado: ' || l.name,
    'Está em “' || s.name || '” há mais de ' || s.sla_days || ' dia(s).', '/comercial/leads/' || l.id,
    'lead_sla:' || l.id || ':' || l.stage_id || ':' || extract(epoch from l.stage_changed_at)::bigint)
  from public.leads l join public.pipeline_stages s on s.id = l.stage_id
  where s.kind = 'aberta' and s.sla_days is not null and l.owner_id is not null
    and l.stage_changed_at < now() - make_interval(days => s.sla_days);
end;
$$;
