"use client";

import type { TaskRow } from "@/features/tasks/queries";
import { setTaskStatus } from "@/features/tasks/actions";
import { Kanban, type KanbanColumn } from "./kanban";

type BoardStatus = "pendente" | "em_andamento" | "aguardando_aprovacao" | "concluido";

export const STATUS_COLUMNS: KanbanColumn[] = [
  { id: "pendente", name: "A fazer", color: "#64748B", kind: "column" },
  { id: "em_andamento", name: "Fazendo", color: "#1D8AE6", kind: "column" },
  { id: "aguardando_aprovacao", name: "Aguardando aprovação", color: "#F59E0B", kind: "column" },
  { id: "concluido", name: "Concluídas", color: "#22C55E", kind: "column" },
];

/** "Aprovado" ainda está em produção (falta entregar ou publicar): fica em Fazendo. */
const columnOf = (t: TaskRow) => (t.status === "aprovado" ? "em_andamento" : t.status);

/**
 * Minhas tarefas em quadro, no estilo Trello: arrastar muda a situação. Demanda de fluxo vai para a etapa com
 * aquela situação e passa para o responsável dela (o banco decide e avisa se o fluxo não tem a etapa).
 */
export function StatusBoard({ tasks, channel, canMove }: { tasks: TaskRow[]; channel: string; canMove: boolean }) {
  return (
    <Kanban
      columns={STATUS_COLUMNS}
      tasks={tasks}
      channel={channel}
      canMove={canMove}
      columnOf={columnOf}
      moveTo={(t, col, position) => ({
        patch: { status: col.id, completedAt: col.id === "concluido" ? new Date().toISOString() : null },
        run: () => setTaskStatus({ id: t.id, status: col.id as BoardStatus, position }),
      })}
    />
  );
}
