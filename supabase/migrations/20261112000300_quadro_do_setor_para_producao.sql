-- Etapa 03B · quem edita, cria ou grava abre o quadro do próprio setor.
-- A leitura das tarefas continua restrita (escopo "próprio"): cada pessoa só vê os seus cards.
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'sector.dashboard.read', 'sector' from public.roles r where r.key in ('editor_video', 'designer', 'gravacao')
on conflict do nothing;
