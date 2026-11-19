import type { Metadata } from "next";
import { Pencil, Plus, Repeat } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { STEP_KIND_LABEL, dayLabel } from "@/domain/crm/cadence";
import { CadenceEditor } from "@/features/crm/components/cadence-editor";
import { CadenceToggle } from "@/features/crm/components/cadence-toggle";
import { listCadences } from "@/features/crm/cadence-queries";
import { requirePermission } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cadências" };

/** RF-CRM-06: modelos de cadência de follow-up do Comercial. */
export default async function CadenciasPage() {
  await requirePermission("crm.pipeline.configure");
  const cadences = await listCadences();
  return (
    <>
      <PageHeader
        title="Cadências"
        description="Sequências de contato com o lead. Iniciar no lead cria as próximas ações no dia e horário de cada passo; a mensagem marcada sai sozinha pelo WhatsApp. Se o lead responde no WhatsApp, a cadência pausa e o responsável é avisado."
        actions={<CadenceEditor cadence={null} trigger={<Button><Plus aria-hidden="true" /> Nova cadência</Button>} />}
      />
      <PageBody className="grid max-w-4xl gap-4">
        {cadences.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhuma cadência" description="Crie a primeira: por exemplo, o follow-up depois de enviar a proposta." />
        ) : (
          <ul aria-label="Cadências" className="grid gap-3">
            {cadences.map((c) => (
              <li key={c.id} className={cn("grid gap-3 rounded-xl border bg-card p-4", !c.isActive && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="font-medium">{c.name}{!c.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(desativada)</span>}</span>
                    {c.description && <span className="text-sm text-muted-foreground">{c.description}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <CadenceToggle id={c.id} name={c.name} active={c.isActive} />
                    <CadenceEditor cadence={c} trigger={<Button variant="outline" size="sm" aria-label={`Editar ${c.name}`}><Pencil aria-hidden="true" /> Editar</Button>} />
                  </div>
                </div>
                <ol className="grid gap-1 text-sm" aria-label={`Passos de ${c.name}`}>
                  {c.steps.map((s, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="w-12 shrink-0 font-mono text-xs leading-5 text-muted-foreground">{dayLabel(s.day)}</span>
                      <span className="text-muted-foreground tabular-nums">{s.time}</span>
                      <span>{STEP_KIND_LABEL[s.kind]}: {s.title}</span>
                      {s.auto && <span className="rounded-full bg-info-soft px-2 text-xs leading-5 text-info">sai sozinha</span>}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
