-- RF-REL-02: modelos de relatório de anúncios com variáveis ({cliente}, {investimento}, {cpl}…), editáveis.
-- Os modelos são da agência (edita quem tem "Configurar relatórios" para todos os clientes); cada cliente usa o
-- modelo escolhido por quem cuida dos relatórios dele, ou o padrão da agência.

create table public.report_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 2 and 80),
  body             text not null check (char_length(body) between 10 and 4000),
  is_default       boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index report_templates_default on public.report_templates (organization_id) where is_default;
create unique index report_templates_name on public.report_templates (organization_id, lower(btrim(name)));
create trigger report_templates_updated_at before update on public.report_templates for each row execute function private.set_updated_at();
create trigger audit_report_templates after insert or update or delete on public.report_templates
  for each row execute function private.audit_row('', 'name,body,is_default');

alter table public.report_templates enable row level security;
revoke all on public.report_templates from anon, authenticated;
grant select on public.report_templates to authenticated;
-- Lê quem configura relatórios ou vê anúncios (para escolher e pré-visualizar).
create policy report_templates_select on public.report_templates for select to authenticated
  using (organization_id = (select private.org_id()) and ((select private.has_perm('reports.manage')) or (select private.has_perm('ads.read'))));

-- Modelo de cada cliente (sem linha: o padrão da agência).
create table public.client_report_settings (
  client_id    uuid primary key references public.clients (id) on delete cascade,
  template_id  uuid references public.report_templates (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index client_report_settings_template on public.client_report_settings (template_id);
create trigger audit_client_report_settings after insert or update or delete on public.client_report_settings
  for each row execute function private.audit_row('', 'template_id');
alter table public.client_report_settings enable row level security;
revoke all on public.client_report_settings from anon, authenticated;
grant select on public.client_report_settings to authenticated;
create policy client_report_settings_select on public.client_report_settings for select to authenticated
  using ((select private.can_client('ads.read', client_id)) or (select private.can_client('reports.manage', client_id)));

-- Quem edita os modelos da agência: "Configurar relatórios" com escopo de todos os clientes.
create or replace function private.can_edit_report_templates()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.perm_scope('reports.manage') = 'all';
$$;
revoke all on function private.can_edit_report_templates() from public, anon;
grant execute on function private.can_edit_report_templates() to authenticated;

-- Criar ou editar um modelo (p_id null = novo). Marcar como padrão tira a marca do anterior.
create or replace function public.save_report_template(p_id uuid, p_name text, p_body text, p_default boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.org_id();
  v_id uuid := p_id;
  v_was_default boolean;
begin
  if v_org is null or not private.can_edit_report_templates() then
    raise exception 'Só quem configura os relatórios de todos os clientes edita os modelos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.report_templates where organization_id = v_org and lower(btrim(name)) = lower(btrim(p_name)) and id is distinct from p_id) then
    raise exception 'Já existe um modelo com este nome.' using errcode = 'P0001';
  end if;
  if v_id is not null then
    select is_default into v_was_default from public.report_templates where id = v_id and organization_id = v_org for update;
    if not found then raise exception 'Modelo não encontrado.' using errcode = 'P0002'; end if;
    if v_was_default and not p_default then
      raise exception 'Para tirar o padrão, marque outro modelo como padrão.' using errcode = 'P0001';
    end if;
  end if;
  if p_default then
    update public.report_templates set is_default = false where organization_id = v_org and is_default and id is distinct from v_id;
  end if;
  if v_id is null then
    insert into public.report_templates (organization_id, name, body, is_default, created_by, updated_by)
    values (v_org, btrim(p_name), p_body, p_default or not exists (select 1 from public.report_templates where organization_id = v_org and is_default),
            auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.report_templates set name = btrim(p_name), body = p_body, is_default = p_default, updated_by = auth.uid() where id = v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_report_template(uuid, text, text, boolean) from public, anon;
grant execute on function public.save_report_template(uuid, text, text, boolean) to authenticated;

-- Excluir: o padrão não sai; os clientes que usavam voltam para o padrão.
create or replace function public.delete_report_template(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_report_templates() then
    raise exception 'Só quem configura os relatórios de todos os clientes edita os modelos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.report_templates where id = p_id and is_default) then
    raise exception 'O modelo padrão não pode ser excluído. Marque outro como padrão antes.' using errcode = 'P0001';
  end if;
  delete from public.report_templates where id = p_id and organization_id = private.org_id();
  if not found then raise exception 'Modelo não encontrado.' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.delete_report_template(uuid) from public, anon;
grant execute on function public.delete_report_template(uuid) to authenticated;

-- Escolher o modelo do cliente (null = padrão da agência). Quem configura os relatórios do cliente.
create or replace function public.set_client_report_template(p_client uuid, p_template uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_client('reports.manage', p_client) then
    raise exception 'Você não configura os relatórios deste cliente.' using errcode = '42501';
  end if;
  if p_template is not null and not exists (
    select 1 from public.report_templates t join public.clients c on c.organization_id = t.organization_id
     where t.id = p_template and c.id = p_client) then
    raise exception 'Modelo não encontrado.' using errcode = 'P0002';
  end if;
  if p_template is null then
    delete from public.client_report_settings where client_id = p_client;
  else
    insert into public.client_report_settings (client_id, template_id, updated_by, updated_at)
    values (p_client, p_template, auth.uid(), now())
    on conflict (client_id) do update set template_id = excluded.template_id, updated_by = excluded.updated_by, updated_at = now();
  end if;
end;
$$;
revoke all on function public.set_client_report_template(uuid, uuid) from public, anon;
grant execute on function public.set_client_report_template(uuid, uuid) to authenticated;

-- Modelo padrão de cada agência: o mesmo texto que o relatório já tinha.
insert into public.report_templates (organization_id, name, body, is_default)
select o.id, 'Relatório padrão', E'📊 *Relatório de anúncios — {cliente}*\nPeríodo: {periodo}\n\n💰 Investimento: *{investimento}*\n👀 Impressões: {impressoes}\n🖱️ Cliques: {cliques} · CTR {ctr}\n\n{campanhas}\n\n🏆 Destaque: {top_criativo}\n💳 Saldo da conta: {saldo} (dá para ~{dias_saldo})', true
  from public.organizations o
 where not exists (select 1 from public.report_templates t where t.organization_id = o.id);
