-- A organização da meta vem do cliente (gatilho); o padrão deixa o insert pela tela sem informar a coluna.
alter table public.ad_goals alter column organization_id set default private.org_id();
