import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { currentServices, getClient, listTeam } from "@/features/clients/queries";
import { getBoard, listClientBoards, listTasks, listWorkflows, listTemplates } from "@/features/tasks/queries";
import { listSectors } from "@/features/admin/queries";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { Kanban } from "@/features/tasks/components/kanban";
import { NewTaskDialog } from "@/features/tasks/components/new-task-dialog";
import { BoardDialog } from "@/features/tasks/components/board-dialog";
import { ColumnsEditor } from "@/features/tasks/components/columns-editor";
import { StepDefaults } from "./step-defaults";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Quadros do cliente (RF-TAR-01), no estilo Trello: um quadro por tipo de demanda (colunas = etapas do fluxo) e os
 * quadros próprios do cliente, que já nascem com colunas prontas e têm colunas editáveis. Arrastar move o card.
 */
export default async function QuadrosClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string; quadro?: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  if (client.status === "onboarding") redirect(`/clientes/${id}`);
  const [workflows, boards] = await Promise.all([listWorkflows(), listClientBoards(id)]);
  const svcTypes = currentServices(client).flatMap((s) => (Array.isArray(s.service_catalog) ? s.service_catalog : [s.service_catalog])).map((c) => c?.task_type).filter(Boolean) as string[];
  const types = [...new Set([...svcTypes, "geral"])].filter((t) => workflows.some((w) => w.taskType === t));
  const sp = await searchParams;
  const boardId = sp.quadro && UUID.test(sp.quadro) && boards.some((b) => b.id === sp.quadro) ? sp.quadro : null;
  const type = !boardId ? (sp.tipo && types.includes(sp.tipo) ? sp.tipo : types[0]) : null;
  const canManage = Boolean(user.permissions["tasks.manage"]);
  // Quem distribui as demandas do cliente cria e edita os quadros dele (a RLS confere no banco).
  const canBoards = Boolean(user.permissions["tasks.boards.configure"] || user.permissions["tasks.assign"]);
  const [team, templates, sectors, board, tasks] = await Promise.all([
    listTeam(),
    listTemplates(),
    canBoards ? listSectors() : Promise.resolve([]),
    boardId ? getBoard(boardId) : Promise.resolve(null),
    boardId ? listTasks({ boardId }) : listTasks({ clientId: id, type: type ?? undefined, withoutBoard: true }),
  ]);
  const wf = type ? workflows.find((w) => w.taskType === type) : null;
  const teamOpts = team.map((t) => ({ id: t.id, name: t.name }));
  const sectorOpts = sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  const chip = (on: boolean) => cn("chip rounded-full border px-3 text-sm", on ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Quadros do cliente" className="flex flex-wrap items-center gap-1.5">
          {types.map((t) => (
            <Link key={t} href={`?tipo=${t}`} aria-current={t === type ? "page" : undefined} className={chip(t === type)}>{TASK_TYPE_LABEL[t] ?? t}</Link>
          ))}
          {boards.map((b) => (
            <Link key={b.id} href={`?quadro=${b.id}`} aria-current={b.id === boardId ? "page" : undefined} className={cn(chip(b.id === boardId), b.archived_at && "opacity-60")}>
              {b.name}{b.archived_at ? " (arquivado)" : ""}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          {canBoards && !board && <BoardDialog sectors={sectorOpts} clientId={id} />}
          {board && canBoards && <ColumnsEditor boardId={board.id} columns={board.columns} archived={Boolean(board.archived_at)} />}
          {board && canBoards && <BoardDialog sectors={sectorOpts} clientId={id} board={{ id: board.id, name: board.name, sectorId: board.sector_id }} />}
          {wf && (user.permissions["tasks.assign"] || user.permissions["clients.manage"]) && (
            <StepDefaults clientId={id} steps={wf.steps.map((s) => ({ id: s.id, name: s.name }))} team={teamOpts} />
          )}
          {canManage && wf && <NewTaskDialog clients={[]} team={teamOpts} templates={templates.filter((t) => t.type === type)} preset={{ clientId: id, type: type as "geral" }} />}
          {canManage && board && board.columns[0] && !board.archived_at && (
            <NewTaskDialog clients={[]} team={teamOpts} templates={templates} preset={{ clientId: id, boardId: board.id, columnId: board.columns[0].id, type: "geral", assigneeId: user.id }} />
          )}
        </div>
      </div>
      {board ? (
        board.columns.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">Este quadro está sem colunas. {canBoards ? "Crie as colunas em Colunas." : "Peça para quem distribui as demandas do cliente criar."}</p>
        ) : (
          <Kanban
            columns={board.columns.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: "column" }))}
            tasks={tasks}
            channel={`quadro-${board.id}`}
            realtimeFilter={`board_id=eq.${board.id}`}
            canMove={canManage && !board.archived_at}
            showClient={false}
          />
        )
      ) : wf ? (
        <Kanban
          columns={wf.steps.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: "step", waitsClient: s.waitsClient }))}
          tasks={tasks}
          channel={`cliente-${id}-${type}`}
          realtimeFilter={`client_id=eq.${id}`}
          canMove={canManage}
          showClient={false}
        />
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">Nenhum fluxo de demanda para os serviços deste cliente. {canBoards ? "Crie um quadro do cliente em Novo quadro." : ""}</p>
      )}
    </div>
  );
}
