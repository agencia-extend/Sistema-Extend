-- Pendências do briefing de mídias (docs/09): cliente sem retorno em aprovação, tipos de reunião e
-- serviços do catálogo que faltavam.

-- -----------------------------------------------------------------------------
-- Tipos de reunião: aprovação de estratégia e acompanhamento (docs/09, 3.2 Reuniões)
-- -----------------------------------------------------------------------------
alter table public.client_meetings drop constraint client_meetings_kind_check;
alter table public.client_meetings add constraint client_meetings_kind_check
  check (kind in ('briefing', 'planejamento', 'estrategia', 'acompanhamento', 'alinhamento', 'resultados', 'outro'));

-- -----------------------------------------------------------------------------
-- Serviços do catálogo citados no briefing (3.1). Ficam editáveis em Configurações.
-- -----------------------------------------------------------------------------
insert into public.service_catalog (organization_id, key, name, sector_id, unit, task_type, tabs, position)
select o.id, v.key, v.name, s.id, 'nenhuma', null, '{}', v.pos
  from public.organizations o
  cross join (values ('consultoria_perfil', 'Consultoria de perfil', 'gerenciamento', 8),
                     ('google_meu_negocio', 'Google Meu Negócio', 'gerenciamento', 9)) as v(key, name, sector, pos)
  left join public.sectors s on s.organization_id = o.id and s.key = v.sector
 where not exists (select 1 from public.service_catalog c where c.organization_id = o.id and c.key = v.key);

-- -----------------------------------------------------------------------------
-- Cliente sem retorno (docs/09, 3.9): conteúdo parado na aprovação do cliente há 2 e há 5 dias úteis
-- avisa o responsável pela comunicação e quem está com a demanda. Um aviso por marco e por envio.
-- -----------------------------------------------------------------------------
create or replace function private.client_waiting_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_sp();
  r record;
  v_mark text;
begin
  for r in
    select t.id, t.title, t.assignee_id, c.id as client_id, c.name as client_name, c.owner_id,
           coalesce(h.entered_at, t.updated_at) as entered_at,
           (coalesce(h.entered_at, t.updated_at) at time zone 'America/Sao_Paulo')::date as entered_on
      from public.tasks t
      join public.workflow_steps s on s.id = t.workflow_step_id and s.waits_client
      join public.clients c on c.id = t.client_id and c.deleted_at is null and c.status in ('ativo', 'onboarding')
      -- move_task registra a entrada na etapa; sem registro, vale a última alteração da demanda
      left join lateral (
        select x.entered_at from public.task_stage_history x
         where x.task_id = t.id and x.step_id = t.workflow_step_id and x.left_at is null
         order by x.entered_at desc limit 1
      ) h on true
     where t.deleted_at is null and t.status not in ('cancelado', 'concluido', 'aprovado')
       and (private.portal_pending(t.id)
            or exists (select 1 from public.approval_links l
                        where l.task_id = t.id and l.decided_at is null and l.revoked_at is null))
  loop
    v_mark := case
      when v_today >= private.add_business_days(r.entered_on, 5) then '5'
      when v_today >= private.add_business_days(r.entered_on, 2) then '2'
    end;
    continue when v_mark is null;
    perform public.notify_users(
      array_remove(array[r.owner_id, r.assignee_id], null),
      'client_waiting',
      r.client_name || ' sem retorno: ' || r.title,
      'Aguardando o cliente desde ' || to_char(r.entered_at at time zone 'America/Sao_Paulo', 'DD/MM') ||
        ', há pelo menos ' || v_mark || ' dias úteis. Cobre o retorno ou reenvie o link de aprovação.',
      '/tarefas/' || r.id,
      'client_waiting:' || r.id || ':' || extract(epoch from r.entered_at)::bigint || ':' || v_mark,
      null);
  end loop;
end;
$$;

revoke all on function private.client_waiting_tick() from public, anon, authenticated;

-- Dias úteis às 9h45 (Brasília = UTC-3)
select cron.schedule('extend-cliente-sem-retorno', '45 12 * * 1-5', $$select private.client_waiting_tick()$$);
