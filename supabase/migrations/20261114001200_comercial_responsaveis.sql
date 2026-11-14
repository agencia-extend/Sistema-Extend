-- Comercial: quem pode ser responsável por lead (só quem tem acesso ao comercial) e aviso ao novo responsável.

create or replace function public.crm_people()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(p.full_name, ''), p.email)
    from public.profiles p
   where p.organization_id = private.org_id() and p.is_active
     and private.has_perm('crm.leads.read')
     and private.user_perm_scope(p.id, 'crm.leads.manage') is not null
   order by 2;
$$;
grant execute on function public.crm_people() to authenticated;

create or replace function private.lead_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id
     and private.user_perm_scope(new.owner_id, 'crm.leads.manage') is null then
    raise exception 'Esta pessoa não tem acesso ao comercial.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger leads_owner_guard before update of owner_id on public.leads for each row execute function private.lead_owner_guard();

create or replace function private.lead_owner_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    perform private.notify(array[new.owner_id], 'crm', 'Lead atribuído a você: ' || new.name,
      coalesce(new.company, 'Abra para ver o histórico e a próxima ação.'), '/comercial/leads/' || new.id,
      'lead_owner:' || new.id || ':' || new.owner_id);
  end if;
  return null;
end;
$$;
create trigger leads_owner_notify after insert or update of owner_id on public.leads for each row
  when (new.import_id is null) execute function private.lead_owner_notify();
