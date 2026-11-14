-- Correções da parte A: o código do cliente é obrigatório e o valor do contrato não é lido
-- direto da tabela (o acesso padrão à tabela inteira anulava a liberação por coluna).
alter table public.clients alter column code set not null;

revoke all on public.client_contracts from authenticated, anon;
grant select (id, client_id, starts_on, ends_on, scope_text, notes, created_by, created_at) on public.client_contracts to authenticated;
grant insert (client_id, starts_on, ends_on, scope_text, monthly_fee_cents, notes) on public.client_contracts to authenticated;
grant update (starts_on, ends_on, scope_text, monthly_fee_cents, notes) on public.client_contracts to authenticated;
grant delete on public.client_contracts to authenticated;
