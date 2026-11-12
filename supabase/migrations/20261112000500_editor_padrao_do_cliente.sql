-- Etapa 03B · o conteúdo do mês já nasce com quem edita/cria quando o cliente tem
-- alguém marcado no setor que produz (Edição para vídeo, Design para arte).
-- Assim o card entra sozinho no quadro do setor; a coordenação só troca se precisar.
create or replace function private.task_content_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor uuid;
begin
  if new.slot_month is not null and new.type in ('video', 'design', 'conteudo') then
    if new.client_id is not null then
      select m.profile_id into v_editor
        from public.workflows w
        join public.client_members m on m.sector_id = w.board_sector_id and m.client_id = new.client_id
        join public.profiles p on p.id = m.profile_id and p.is_active
       where w.organization_id = new.organization_id and w.task_type = new.type
       order by m.is_default desc, m.created_at
       limit 1;
    end if;
    insert into public.task_content (task_id, format, editor_id)
    values (new.id, case new.type when 'video' then 'video_curto' when 'design' then 'estatico' else null end, v_editor)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
