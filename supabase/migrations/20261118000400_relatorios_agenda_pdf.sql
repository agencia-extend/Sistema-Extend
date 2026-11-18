-- Relatórios de anúncios (RF-REL-01/06): frequência e horário do envio automático por cliente (diário, semanal na
-- segunda ou mensal no dia escolhido) e o PDF de cada relatório enviado guardado para a aba Relatórios do cliente.

-- Agenda do envio automático (padrão: toda segunda às 9h, como já era).
alter table public.client_report_settings
  add column frequency text not null default 'semanal' check (frequency in ('desligado', 'diario', 'semanal', 'mensal')),
  add column month_day smallint not null default 1 check (month_day between 1 and 28),
  add column send_hour smallint not null default 9 check (send_hour between 6 and 22);

drop trigger audit_client_report_settings on public.client_report_settings;
create trigger audit_client_report_settings after insert or update or delete on public.client_report_settings
  for each row execute function private.audit_row('', 'template_id,frequency,month_day,send_hour');

-- Voltar ao modelo padrão não apaga a agenda do cliente.
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
  insert into public.client_report_settings (client_id, template_id, updated_by, updated_at)
  values (p_client, p_template, auth.uid(), now())
  on conflict (client_id) do update set template_id = excluded.template_id, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function public.set_client_report_schedule(p_client uuid, p_frequency text, p_month_day int, p_hour int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_client('reports.manage', p_client) then
    raise exception 'Você não configura os relatórios deste cliente.' using errcode = '42501';
  end if;
  if p_frequency not in ('desligado', 'diario', 'semanal', 'mensal') then
    raise exception 'Escolha a frequência do envio.' using errcode = 'P0001';
  end if;
  if p_month_day not between 1 and 28 then
    raise exception 'O dia do mês vai de 1 a 28.' using errcode = 'P0001';
  end if;
  if p_hour not between 6 and 22 then
    raise exception 'O horário vai das 6h às 22h.' using errcode = 'P0001';
  end if;
  insert into public.client_report_settings (client_id, frequency, month_day, send_hour, updated_by, updated_at)
  values (p_client, p_frequency, p_month_day, p_hour, auth.uid(), now())
  on conflict (client_id) do update set frequency = excluded.frequency, month_day = excluded.month_day,
    send_hour = excluded.send_hour, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.set_client_report_schedule(uuid, text, int, int) from public, anon;
grant execute on function public.set_client_report_schedule(uuid, text, int, int) to authenticated;

-- PDF de cada relatório enviado (um por cliente e período; reenviar substitui o arquivo).
create table public.ads_report_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  period_start    date not null,
  period_end      date not null check (period_end >= period_start),
  frequency       text not null check (frequency in ('diario', 'semanal', 'mensal', 'avulso')),
  storage_path    text not null check (char_length(storage_path) <= 300),
  size_bytes      int not null check (size_bytes > 0),
  sent_by         uuid references public.profiles (id) on delete set null,
  sent_at         timestamptz not null default now(),
  unique (client_id, period_start, period_end)
);
create index ads_report_files_client on public.ads_report_files (client_id, sent_at desc);
alter table public.ads_report_files enable row level security;
revoke all on public.ads_report_files from anon, authenticated;
grant select on public.ads_report_files to authenticated;
-- Quem vê os anúncios do cliente ou configura os relatórios dele. Só o servidor grava.
create policy ads_report_files_select on public.ads_report_files for select to authenticated
  using ((select private.can_client('ads.read', client_id)) or (select private.can_client('reports.manage', client_id)));

-- Arquivos privados: o download passa pelo servidor, que confere a linha acima com o login da pessoa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorios', 'relatorios', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- O job roda de hora em hora e decide quem recebe agora (frequência e horário de cada cliente).
select cron.unschedule('extend-whatsapp-relatorios');
select cron.schedule('extend-whatsapp-relatorios', '5 * * * *', $$select private.call_job('whatsapp-reports')$$);
