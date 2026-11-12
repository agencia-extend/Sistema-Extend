-- Etapa 03B · a demanda do mês passa a guardar o início do mês DO CLIENTE (ex.: dia 14),
-- então a data não precisa mais ser o dia 1º do mês do calendário.
alter table public.tasks drop constraint tasks_slot_month_check;
