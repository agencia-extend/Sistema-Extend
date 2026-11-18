-- Gestão das campanhas da Meta pelo sistema (ajustes do dia a dia): pausar/ativar campanha, conjunto e anúncio,
-- orçamento diário, renomear e duplicar. Quem pode: o tráfego do cliente (ads.manage no cliente), e só em contas
-- cuja conexão tem a permissão ads_management. Todo ajuste entra no registro de alterações do cliente (source 'sistema').

alter table public.change_logs drop constraint change_logs_source_check;
alter table public.change_logs add constraint change_logs_source_check check (source in ('manual', 'sync', 'sistema'));

-- Contas (entre as pedidas) em que a pessoa pode ajustar campanhas agora.
create or replace function public.ad_accounts_manageable(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
    from public.ad_accounts a
    join public.integration_connections c on c.id = a.connection_id and c.status = 'active'
   where a.id = any(p_ids)
     and a.organization_id = private.org_id()
     and a.provider = 'meta'
     and a.is_enabled
     and a.client_id is not null
     and 'ads_management' = any(c.scopes)
     and private.can_client('ads.manage', a.client_id);
$$;
revoke all on function public.ad_accounts_manageable(uuid[]) from public, anon;
grant execute on function public.ad_accounts_manageable(uuid[]) to authenticated;

-- Registra o ajuste feito pelo sistema (depois que a Meta aceitou). Confere de novo quem pode.
create or replace function public.record_ad_change(p_account uuid, p_category text, p_what text, p_why text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.ad_accounts;
  v_id uuid;
begin
  select * into v_acc from public.ad_accounts where id = p_account and organization_id = private.org_id();
  if v_acc.id is null or v_acc.client_id is null then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
  if not private.can_client('ads.manage', v_acc.client_id) then
    raise exception 'Só o tráfego do cliente ajusta as campanhas.' using errcode = '42501';
  end if;
  if p_category not in ('orcamento', 'campanha', 'pausa', 'ativacao') then
    raise exception 'Tipo de ajuste inválido.' using errcode = '22023';
  end if;
  perform set_config('extend.ad_change', 'on', true);
  insert into public.change_logs (organization_id, client_id, ad_account_id, platform, category, what, why, source, created_by)
  values (v_acc.organization_id, v_acc.client_id, v_acc.id, v_acc.provider, p_category, left(p_what, 500),
          coalesce(nullif(btrim(left(p_why, 1000)), ''), 'Ajuste feito pelo sistema.'), 'sistema', auth.uid())
  returning id into v_id;
  perform set_config('extend.ad_change', 'off', true);
  return v_id;
end;
$$;
revoke all on function public.record_ad_change(uuid, text, text, text) from public, anon;
grant execute on function public.record_ad_change(uuid, text, text, text) to authenticated;

-- A origem continua vindo do servidor: quem insere pelo formulário fica 'manual'; só record_ad_change (que marca a
-- transação com extend.ad_change) grava 'sistema'.
create or replace function private.traffic_row_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if tg_table_name = 'change_logs' and auth.uid() is not null then
      new.source := case when current_setting('extend.ad_change', true) = 'on' then 'sistema' else 'manual' end;
    end if;
  else
    new.created_by := old.created_by;
    new.client_id := old.client_id;
    new.organization_id := old.organization_id;
    if tg_table_name = 'change_logs' then new.source := old.source; end if;
  end if;
  if tg_table_name = 'change_logs' then
    if new.ad_account_id is not null
       and not exists (select 1 from public.ad_accounts a where a.id = new.ad_account_id and a.client_id = new.client_id) then
      raise exception 'Esta conta de anúncio não é deste cliente.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
