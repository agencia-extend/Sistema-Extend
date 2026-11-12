import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { listWorkflows } from "@/features/tasks/queries";
import { listSectors } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { WorkflowEditor } from "./workflow-editor";

export const metadata: Metadata = { title: "Fluxos" };

export default async function FluxosPage() {
  await requirePermission("tasks.boards.configure");
  const [workflows, sectors] = await Promise.all([listWorkflows(), listSectors()]);
  return (
    <>
      <PageHeader title="Fluxos de produção" description="Etapas de cada tipo de demanda. Ao mudar de etapa, o card vai para a pessoa do setor da etapa marcada no cliente." />
      <PageBody className="grid max-w-4xl gap-8">
        {workflows.map((w) => (
          <WorkflowEditor key={w.id} workflow={w} sectors={sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))} />
        ))}
      </PageBody>
    </>
  );
}
