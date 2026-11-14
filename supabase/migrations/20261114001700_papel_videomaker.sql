-- Briefing de mídias (docs/09, item 2): o papel de quem grava se chama "Videomaker" na Extend.
-- Só o nome exibido muda; a chave (gravacao), o setor "Gravação" e a etapa "Gravação" continuam.
-- Se a Extend já tiver renomeado o papel em Configurações, nada muda.
update public.roles set name = 'Videomaker' where key = 'gravacao' and name = 'Gravação';
