import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/domain/shared/dates";
import { listLeadImports, listPipelines } from "@/features/crm/queries";
import { pickPipeline } from "@/features/crm/defaults";
import { LeadImporter } from "@/features/crm/components/lead-importer";
import { PipelineSwitch } from "@/features/crm/components/pipeline-switch";
import { UndoLeadImport } from "@/features/crm/components/undo-lead-import";

export const metadata: Metadata = { title: "Importar leads" };

export default async function ImportarLeadsPage({ searchParams }: { searchParams: Promise<{ funil?: string }> }) {
  const [, sp] = await Promise.all([requirePermission("crm.leads.manage"), searchParams]);
  const [pipelines, imports] = await Promise.all([listPipelines(), listLeadImports()]);
  const pipeline = pickPipeline(pipelines, sp.funil);
  if (!pipeline) return <EmptyState title="Nenhum funil configurado" description="Crie um funil em Configurações › Funis comerciais." />;

  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid gap-4">
        <PipelineSwitch value={pipeline.id} pipelines={pipelines} />
        <LeadImporter key={pipeline.id} pipelineId={pipeline.id} pipelineName={pipeline.name} />
      </div>
      <section aria-labelledby="hist" className="grid gap-2">
        <h2 id="hist" className="text-base font-semibold">Importações recentes</h2>
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">{i.fileName}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {formatDateTime(i.createdAt)} · {i.rowCount} importado(s){i.duplicates ? ` · ${i.duplicates} repetido(s) pulado(s)` : ""}
                  </span>
                </span>
                {i.undoneAt ? <Badge variant="secondary">Desfeita</Badge> : i.rowCount > 0 && <UndoLeadImport id={i.id} count={i.rowCount} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
