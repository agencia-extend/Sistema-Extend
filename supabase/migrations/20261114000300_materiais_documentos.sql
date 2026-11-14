-- Central do cliente (parte B): Materiais por categoria (arquivo ou link do Drive) e
-- pastas por setor nos documentos (Geral, Mídias, Tráfego).

alter table public.client_files
  add column folder text not null default 'geral' check (folder in ('geral', 'midias', 'trafego'));
create index client_files_folder_idx on public.client_files (client_id, folder);
grant update (folder) on public.client_files to authenticated;
create policy client_files_update on public.client_files for update to authenticated
  using ((select private.can_manage_client(client_id)) or uploaded_by = (select auth.uid()))
  with check ((select private.can_manage_client(client_id)) or uploaded_by = (select auth.uid()));

create table public.client_materials (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  category    text not null check (category in ('identidade', 'catalogo', 'perfil', 'imagens', 'referencias', 'acessos', 'outros')),
  title       text not null check (char_length(title) between 2 and 160),
  url         text check (url ~ '^https://' and char_length(url) <= 600),
  file_id     uuid references public.client_files (id) on delete cascade,
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (url is not null or file_id is not null)
);
create index client_materials_client_idx on public.client_materials (client_id, category, created_at desc);
alter table public.client_materials enable row level security;

create policy client_materials_select on public.client_materials for select to authenticated
  using ((select private.can_client('clients.read', client_id)));
-- Quem trabalha no cliente pode juntar material; o arquivo precisa ser do mesmo cliente.
create policy client_materials_insert on public.client_materials for insert to authenticated
  with check ((select private.can_client('clients.read', client_id)) and created_by = (select auth.uid())
              and (file_id is null or exists (select 1 from public.client_files f where f.id = file_id and f.client_id = client_materials.client_id)));
create policy client_materials_write on public.client_materials for update to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()))
  with check ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));
create policy client_materials_delete on public.client_materials for delete to authenticated
  using ((select private.can_manage_client(client_id)) or created_by = (select auth.uid()));
grant select, insert, delete on public.client_materials to authenticated;
grant update (category, title, url, notes) on public.client_materials to authenticated;

-- Material novo entra na linha do tempo do cliente.
create or replace function private.material_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.timeline(new.client_id, 'material', 'Material adicionado: ' || new.title, jsonb_build_object('material_id', new.id, 'category', new.category));
  return new;
end;
$$;
create trigger client_materials_added after insert on public.client_materials for each row execute function private.material_added();
