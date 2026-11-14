import type { Metadata } from "next";
import { FileBarChart } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalFiles } from "@/features/portal/queries";
import { PortalFileList } from "@/features/portal/components/file-list";
import { EmptyState } from "@/components/app/states";

export const metadata: Metadata = { title: "Relatórios" };

/** Relatórios enviados pela agência (Documentos › Relatórios do cliente). */
export default async function PortalReportsPage() {
  const { clientId } = await requirePortal();
  const { files } = await portalFiles(clientId);
  const reports = files.filter((f) => f.folder === "relatorios");
  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Os relatórios de resultado que a Agência Extend envia. Você é avisado quando chega um novo.</p>
      </header>
      {reports.length === 0 ? (
        <EmptyState icon={FileBarChart} title="Nenhum relatório ainda" description="Quando a equipe enviar o relatório do mês, ele aparece aqui para abrir ou baixar." />
      ) : (
        <PortalFileList files={reports} />
      )}
    </>
  );
}
