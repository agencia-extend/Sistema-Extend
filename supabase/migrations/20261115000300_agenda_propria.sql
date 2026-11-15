-- Google Agenda com o escopo mais restrito (calendar.app.created): o sistema cria na conta da pessoa uma
-- agenda separada "Sistema Extend" e só mexe nos eventos dela. resource_id guarda o id dessa agenda.
alter table public.integration_connections add column resource_id text;
