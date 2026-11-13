import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getBoard, listTasks, listTemplates } from "@/features/tasks/queries";
import { listTeam } from "@/features/clients/queries";
import { listSectors } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Kanban } from "@/features/tasks/components/kanban";
import { NewTaskDialog } from "@/features/tasks/components/new-task-dialog";
import { BoardDialog } from "../board-dialog";
import { ColumnsEditor } from "./columns-editor";

export const metadata: Metadata = { title: "Quadro" };

export default async function QuadroPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const board = await getBoard(id);
  if (!board) notFound();
  const supabase = await createClient();
  const [tasks, team, sectors, clients, templates] = await Promise.all([
    listTasks({ boardId: id }),
    listTeam(),
    listSectors(),
    supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name"),
    listTemplates(),
  ]);
  const canConfigure = Boolean(user.permissions["tasks.boards.configure"]);
  const canManage = Boolean(user.permissions["tasks.manage"]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Quadros", href: "/quadros" }, { label: board.name }]}
        title={board.name}
        description={board.archived_at ? "Quadro arquivado." : undefined}
        actions={
          <>
            {canConfigure && <ColumnsEditor boardId={id} columns={board.columns} archived={Boolean(board.archived_at)} />}
            {canConfigure && <BoardDialog sectors={sectors.map((s) => ({ id: s.id, name: s.name }))} board={{ id, name: board.name, sectorId: board.sector_id }} />}
            {canManage && board.columns[0] && (
              <NewTaskDialog clients={clients.data ?? []} team={team.map((t) => ({ id: t.id, name: t.name }))} templates={templates} preset={{ boardId: id, columnId: board.columns[0].id, type: "geral" }} />
            )}
          </>
        }
      />
      <PageBody>
        <Kanban
          columns={board.columns.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: "column" }))}
          tasks={tasks}
          channel={`quadro-${id}`}
          realtimeFilter={`board_id=eq.${id}`}
          canMove={canManage}
        />
      </PageBody>
    </>
  );
}
