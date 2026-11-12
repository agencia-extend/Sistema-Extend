-- Etapa 03B · a coordenação de conteúdo organiza a edição e o design (docs/08, seção 2):
-- precisa abrir o quadro de todos os setores, não só o dela.
update public.role_permissions rp set scope = 'all'
  from public.roles r
 where r.id = rp.role_id and r.key = 'coord_conteudo' and rp.permission_key = 'sector.dashboard.read';
