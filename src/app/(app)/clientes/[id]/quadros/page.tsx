import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { currentServices, getClient, listTeam } from "@/features/clients/queries";
import { listTasks, listWorkflows } from "@/features/tasks/queries";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { Kanban } from "@/features/tasks/components/kanban";
import { NewTaskDialog } from "@/features/tasks/components/new-task-dialog";
import { StepDefaults } from "./step-defaults";
import { cn } from "@/lib/utils";

/** Quadros do cliente (RF-TAR-01): um Kanban por tipo de demanda, colunas = etapas do fluxo. */
export default async function QuadrosClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  if (client.status === "onboarding") redirect(`/clientes/${id}`);
  const workflows = await listWorkflows();
  const svcTypes = currentServices(client).flatMap((s) => (Array.isArray(s.service_catalog) ? s.service_catalog : [s.service_catalog])).map((c) => c?.task_type).filter(Boolean) as string[];
  const types = [...new Set([...svcTypes, "geral"])].filter((t) => workflows.some((w) => w.taskType === t));
  const { tipo } = await searchParams;
  const type = tipo && types.includes(tipo) ? tipo : types[0];
  const wf = workflows.find((w) => w.taskType === type)!;
  const [tasks, team] = await Promise.all([listTasks({ clientId: id, type }), listTeam()]);
  const canManage = Boolean(user.permissions["tasks.manage"]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Tipo de demanda" className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <Link key={t} href={`?tipo=${t}`} aria-current={t === type ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm", t === type ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
              {TASK_TYPE_LABEL[t] ?? t}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          {(user.permissions["tasks.assign"] || user.permissions["clients.manage"]) && (
            <StepDefaults clientId={id} steps={wf.steps.map((s) => ({ id: s.id, name: s.name }))} team={team.map((t) => ({ id: t.id, name: t.name }))} />
          )}
          {canManage && <NewTaskDialog clients={[]} team={team.map((t) => ({ id: t.id, name: t.name }))} preset={{ clientId: id, type: type as "geral" }} />}
        </div>
      </div>
      <Kanban
        columns={wf.steps.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: "step", waitsClient: s.waitsClient }))}
        tasks={tasks}
        channel={`cliente-${id}-${type}`}
        realtimeFilter={`client_id=eq.${id}`}
        canMove={canManage}
        showClient={false}
      />
    </div>
  );
}
