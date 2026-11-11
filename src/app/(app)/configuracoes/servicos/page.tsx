import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { listCatalog } from "@/features/clients/queries";
import { listSectors } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { UNIT_LABEL } from "@/domain/clients";
import { ServiceDialog, TAB_LABEL } from "./service-dialog";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicosPage() {
  await requirePermission("settings.manage");
  const [catalog, sectors] = await Promise.all([listCatalog(), listSectors()]);
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const sectorOpts = sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que a Extend vende. A unidade mensal gera as demandas de cada mês; as abas definem o que aparece no ambiente do cliente."
        actions={<ServiceDialog sectors={sectorOpts} />}
      />
      <PageBody>
        <ul className="divide-y rounded-xl border bg-card">
          {catalog.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
                <p className="text-sm font-medium">{s.name} {!s.is_active && <Badge variant="outline">Inativo</Badge>}</p>
                <p className="text-xs text-muted-foreground">
                  {[s.sector_id ? sectorName.get(s.sector_id) : "Sem setor", UNIT_LABEL[s.unit] ? `quantidade em ${UNIT_LABEL[s.unit]}` : "sem quantidade mensal", s.tabs.length ? `abas: ${s.tabs.map((t) => TAB_LABEL[t] ?? t).join(", ")}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ServiceDialog
                sectors={sectorOpts}
                service={{ id: s.id, name: s.name, sector_id: s.sector_id, unit: s.unit as never, task_type: s.task_type as never, tabs: s.tabs as never, is_active: s.is_active }}
              />
            </li>
          ))}
        </ul>
      </PageBody>
    </>
  );
}
