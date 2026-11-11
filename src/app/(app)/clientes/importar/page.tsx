import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listCatalog } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { formatDateTime } from "@/domain/shared/dates";
import { Importer } from "./importer";
import { UndoImportButton } from "./undo-button";

export const metadata: Metadata = { title: "Importar clientes" };

export default async function ImportarPage() {
  await requirePermission("clients.import");
  const supabase = await createClient();
  const [catalog, imports] = await Promise.all([
    listCatalog(),
    supabase.from("client_imports").select("id, file_name, row_count, created_at, undone_at").order("created_at", { ascending: false }).limit(20),
  ]);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clientes", href: "/clientes" }, { label: "Importar planilha" }]}
        title="Importar planilha de clientes"
        description="Traga a planilha “Controle de clientes” (CSV ou Excel). Você confere o mapeamento e a prévia antes de importar, e pode desfazer depois."
      />
      <PageBody className="grid max-w-5xl gap-10">
        <Importer services={catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, key: s.key }))} />
        {(imports.data ?? []).length > 0 && (
          <section aria-labelledby="historico-imp" className="grid gap-3">
            <h2 id="historico-imp" className="text-base font-semibold">Importações anteriores</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {(imports.data ?? []).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">{i.file_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.row_count} cliente(s) · {formatDateTime(i.created_at)}
                      {i.undone_at && ` · desfeita em ${formatDateTime(i.undone_at)}`}
                    </span>
                  </div>
                  {!i.undone_at && <UndoImportButton id={i.id} count={i.row_count} />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
