-- Briefing de mídias (docs/08, 3.8 e item 7): criativo novo sobe em até 2 dias.
-- Criativo aprovado ou entregue (etapas que contam como "aprovado" no fluxo do criativo) há 2 dias úteis
-- sem ir para "No ar" avisa quem pediu (sem essa pessoa ativa, a equipe de tráfego do cliente).
-- Um aviso por entrada na etapa; se o criativo sai e volta, a contagem recomeça.

create or replace function private.creative_live_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
  r record;
  v_to uuid[];
begin
  for r in
    select t.id, t.title, c.id as client_id, c.name as client_name, s.name as step_name, cr.requested_by,
           coalesce(h.entered_at, t.updated_at) as entered_at,
           (coalesce(h.entered_at, t.updated_at) at time zone 'America/Sao_Paulo')::date as entered_on
      from public.tasks t
      join public.workflow_steps s on s.id = t.workflow_step_id and s.status = 'aprovado'
      join public.workflows w on w.id = s.workflow_id and w.task_type = 'criativo'
      join public.clients c on c.id = t.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
      left join public.creative_requests cr on cr.task_id = t.id
      left join lateral (
        select x.entered_at from public.task_stage_history x
         where x.task_id = t.id and x.step_id = t.workflow_step_id and x.left_at is null
         order by x.entered_at desc limit 1
      ) h on true
     where t.deleted_at is null and t.completed_at is null
  loop
    continue when v_today < private.add_business_days(r.entered_on, 2);
    select array[p.id] into v_to from public.profiles p where p.id = r.requested_by and p.is_active;
    if v_to is null then
      select array_agg(distinct m.profile_id) into v_to
        from public.client_members m
        join public.sectors se on se.id = m.sector_id and se.key = 'trafego'
        join public.profiles p on p.id = m.profile_id and p.is_active
       where m.client_id = r.client_id;
    end if;
    continue when v_to is null;
    perform public.notify_users(
      v_to,
      'creative_live',
      'Criativo ainda não está no ar: ' || r.title,
      r.client_name || ' · em "' || r.step_name || '" desde ' || to_char(r.entered_at at time zone 'America/Sao_Paulo', 'DD/MM') ||
        '. O combinado é subir em até 2 dias úteis; ao subir, marque "No ar".',
      '/criativos/' || r.id,
      'creative_live:' || r.id || ':' || extract(epoch from r.entered_at)::bigint,
      null);
  end loop;
end;
$$;

revoke all on function private.creative_live_tick() from public, anon, authenticated;

-- Dias úteis às 9h50 (Brasília = UTC-3)
select cron.schedule('extend-criativo-no-ar', '50 12 * * 1-5', $$select private.creative_live_tick()$$);
