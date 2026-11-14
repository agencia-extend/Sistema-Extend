import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flag, Pencil, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listSectors } from "@/features/admin/queries";
import { PLAYBOOK_AREA_LABEL, offsetLabel } from "@/domain/playbooks";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { todayKey } from "@/domain/media";
import { getPlaybook, listApplicableClients } from "@/features/playbooks/queries";
import { PlaybookDialog } from "@/features/playbooks/components/playbook-dialog";
import { StepDialog } from "@/features/playbooks/components/step-dialog";
import { ApplyDialog } from "@/features/playbooks/components/apply-dialog";
import { DeletePlaybookButton, StepControls } from "@/features/playbooks/components/step-controls";

export const metadata: Metadata = { title: "Playbook" };

export default async function PlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requirePermission(["playbooks.apply", "playbooks.manage"]);
  const manages = Boolean(user.permissions["playbooks.manage"]);
  const canApply = Boolean(user.permissions["playbooks.apply"]);
  const [p, sectors, clients] = await Promise.all([getPlaybook(id), manages ? listSectors() : Promise.resolve([]), canApply ? listApplicableClients() : Promise.resolve([])]);
  if (!p) notFound();
  const milestones = [...new Set(p.steps.map((s) => s.milestone).filter((m): m is string => Boolean(m)))];
  const sectorOptions = sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Playbooks", href: "/playbooks" }, { label: PLAYBOOK_AREA_LABEL[p.area] }]}
        title={<span className="inline-flex flex-wrap items-center gap-2">{p.name}{!p.isActive && <Badge variant="secondary">Arquivado</Badge>}</span>}
        description={p.description ?? undefined}
        actions={
          <>
            {canApply && p.isActive && <ApplyDialog playbookId={p.id} name={p.name} steps={p.steps} clients={clients} today={todayKey(new Date())} />}
            {manages && (
              <>
                <PlaybookDialog playbook={{ id: p.id, name: p.name, area: p.area, description: p.description ?? "", isActive: p.isActive }} trigger={<Button variant="outline"><Pencil aria-hidden="true" /> Editar</Button>} />
                <DeletePlaybookButton id={p.id} name={p.name} />
              </>
            )}
          </>
        }
      />
      <PageBody className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Etapas</h2>
          {manages && <StepDialog playbookId={p.id} sectors={sectorOptions} milestones={milestones} trigger={<Button size="sm" variant="outline"><Plus aria-hidden="true" /> Nova etapa</Button>} />}
        </div>
        {p.steps.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">
            {manages ? "Sem etapas ainda. Adicione cada passo do processo com o prazo a partir do início (ex.: D0, D+2 úteis) e o setor que faz." : "Este playbook ainda não tem etapas."}
          </p>
        ) : (
          <ol aria-label="Etapas do playbook" className="divide-y rounded-xl border bg-card">
            {p.steps.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-24 shrink-0 pt-0.5 text-xs font-medium text-brand tabular">{offsetLabel(s.offsetDays, s.dayKind)}</span>
                <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                  <span className="text-sm font-medium break-words">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {[s.sectorName ?? "Sem setor", TASK_TYPE_LABEL[s.taskType] ?? s.taskType].join(" · ")}
                    {s.milestone && (
                      <span className="ml-2 inline-flex items-center gap-1"><Flag className="size-3 text-brand" aria-hidden="true" />{s.milestone}</span>
                    )}
                  </span>
                  {s.guidance && <p className="line-clamp-2 text-xs break-words text-muted-foreground">{s.guidance}</p>}
                </div>
                {manages && (
                  <div className="flex gap-0.5">
                    <StepDialog
                      playbookId={p.id}
                      sectors={sectorOptions}
                      milestones={milestones}
                      step={{ id: s.id, title: s.title, guidance: s.guidance ?? "", offsetDays: String(s.offsetDays), dayKind: s.dayKind, sectorId: s.sectorId, taskType: s.taskType, milestone: s.milestone ?? "" }}
                      trigger={<Button variant="ghost" size="icon" aria-label={`Editar a etapa ${s.title}`}><Pencil /></Button>}
                    />
                    <StepControls id={s.id} playbookId={p.id} title={s.title} first={i === 0} last={i === p.steps.length - 1} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </PageBody>
    </>
  );
}
