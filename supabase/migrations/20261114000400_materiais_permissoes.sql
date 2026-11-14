-- O acesso padrão à tabela inteira anularia a liberação por coluna: troca por colunas explícitas.
revoke update on public.client_files from authenticated;
grant update (folder) on public.client_files to authenticated;

revoke all on public.client_materials from authenticated, anon;
grant select, insert, delete on public.client_materials to authenticated;
grant update (category, title, url, notes) on public.client_materials to authenticated;
