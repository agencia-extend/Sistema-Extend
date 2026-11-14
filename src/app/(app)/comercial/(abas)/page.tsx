import type { Metadata } from "next";
import { Plus, Target } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { listCrmPeople, listLeads, listPipelines } from "@/features/crm/queries";
import { blankLead, pickPipeline } from "@/features/crm/defaults";
import { LeadBoard } from "@/features/crm/components/lead-board";
import { LeadDialog } from "@/features/crm/components/lead-dialog";
import { PipelineSwitch } from "@/features/crm/components/pipeline-switch";

export const metadata: Metadata = { title: "Funil comercial" };

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ funil?: string }> }) {
  const [user, sp] = await Promise.all([requirePermission("crm.leads.read"), searchParams]);
  const pipelines = await listPipelines();
  const pipeline = pickPipeline(pipelines, sp.funil);
  if (!pipeline) {
    return <EmptyState icon={Target} title="Nenhum funil configurado" description="Peça a quem configura o comercial para criar um funil em Configurações › Funis comerciais." />;
  }
  const canManage = Boolean(user.permissions["crm.leads.manage"]);
  const [leads, people] = await Promise.all([listLeads(pipeline.id), canManage ? listCrmPeople() : Promise.resolve([])]);
  const now = new Date().getTime();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PipelineSwitch value={pipeline.id} pipelines={pipelines} />
        {canManage && <LeadDialog initial={blankLead(pipeline)} people={people} trigger={<Button><Plus aria-hidden="true" /> Novo lead</Button>} />}
      </div>
      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhum lead neste funil"
          description={canManage ? "Cadastre o primeiro lead ou importe sua planilha de contatos na aba Importar." : "Quando o comercial cadastrar leads, eles aparecem aqui."}
        />
      ) : (
        <LeadBoard pipelineId={pipeline.id} stages={pipeline.stages} leads={leads} canMove={canManage} canHandoff={Boolean(user.permissions["commercial.handoff.create"])} now={now} />
      )}
    </div>
  );
}
