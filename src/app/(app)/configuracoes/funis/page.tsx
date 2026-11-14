import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { listPipelines } from "@/features/crm/queries";
import { PipelineDialog, PipelineEditor } from "@/features/crm/components/pipeline-editor";

export const metadata: Metadata = { title: "Funis comerciais" };

export default async function FunisPage() {
  await requirePermission("crm.pipeline.configure");
  const pipelines = await listPipelines();
  return (
    <>
      <PageHeader
        title="Funis comerciais"
        description="Etapas do funil, cor e prazo de parada de cada uma. Lead parado além do prazo avisa o responsável."
        actions={<PipelineDialog trigger={<Button><Plus aria-hidden="true" /> Novo funil</Button>} />}
      />
      <PageBody className="grid max-w-3xl gap-8">
        {pipelines.map((p) => <PipelineEditor key={p.id} pipeline={p} />)}
      </PageBody>
    </>
  );
}
