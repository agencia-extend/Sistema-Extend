"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";
import { usePostgresChanges } from "@/lib/supabase/use-postgres-changes";
import { positionBetween } from "@/domain/tasks";
import { moveTask } from "@/features/tasks/actions";
import type { TaskRow } from "@/features/tasks/queries";
import { TaskCardView } from "./task-bits";
import { cn } from "@/lib/utils";

export type KanbanColumn = { id: string; name: string; color: string; kind: "step" | "column"; waitsClient?: boolean };

/**
 * Kanban com arrastar e soltar (mouse, toque e teclado) e atualização em tempo
 * real para quem está no mesmo quadro (RF-TAR-04). Mover entre etapas troca o
 * responsável no banco (move_task).
 */
export function Kanban({
  columns,
  tasks: initial,
  channel,
  realtimeFilter,
  canMove,
  showClient = true,
}: {
  columns: KanbanColumn[];
  tasks: TaskRow[];
  channel: string;
  realtimeFilter?: string;
  canMove: boolean;
  showClient?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [active, setActive] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setTasks(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  usePostgresChanges(`quadro:${channel}`, { event: "*", table: "tasks", filter: realtimeFilter }, () => router.refresh());

  const colOf = (t: TaskRow) => (columns[0]?.kind === "column" ? t.columnId : t.stepId) ?? columns[0]?.id;
  const byCol = useMemo(() => {
    const m = new Map<string, TaskRow[]>(columns.map((c) => [c.id, []]));
    for (const t of tasks) m.get(colOf(t) ?? "")?.push(t);
    for (const list of m.values()) list.sort((a, b) => a.position - b.position);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, columns]);

  const onStart = (e: DragStartEvent) => setActive(tasks.find((t) => t.id === e.active.id) ?? null);

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const targetCol = byCol.has(over) ? over : colOf(tasks.find((t) => t.id === over)!) ?? "";
    const list = (byCol.get(targetCol) ?? []).filter((t) => t.id !== id);
    const idx = byCol.has(over) ? list.length : Math.max(0, list.findIndex((t) => t.id === over));
    const position = positionBetween(list[idx - 1]?.position, list[idx]?.position);
    const col = columns.find((c) => c.id === targetCol)!;
    if (colOf(task) === targetCol && Math.abs(task.position - position) < 1e-9) return;

    const prev = tasks;
    setTasks((all) =>
      all.map((t) => (t.id === id ? { ...t, position, ...(col.kind === "column" ? { columnId: col.id } : { stepId: col.id, stepName: col.name, stepColor: col.color, waitsClient: Boolean(col.waitsClient) }) } : t)),
    );
    startTransition(async () => {
      const res = await moveTask({ id, stepId: col.kind === "step" ? col.id : null, columnId: col.kind === "column" ? col.id : null, position });
      if (!res.ok) {
        setTasks(prev);
        toast.error(res.message);
      } else if (colOf(task) !== targetCol) {
        toast.success(`Movido para ${col.name}.`);
        router.refresh();
      }
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {columns.map((c) => (
          <Column key={c.id} col={c} tasks={byCol.get(c.id) ?? []} canMove={canMove} showClient={showClient} />
        ))}
      </div>
      <DragOverlay>{active ? <div className="w-72 rotate-1"><TaskCardView t={active} showClient={showClient} /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ col, tasks, canMove, showClient }: { col: KanbanColumn; tasks: TaskRow[]; canMove: boolean; showClient: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id, disabled: !canMove });
  return (
    <section aria-label={col.name} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/40">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="size-2.5 rounded-full" style={{ background: col.color }} aria-hidden="true" />
        <h3 className="flex-1 truncate text-sm font-semibold">{col.name}</h3>
        {col.waitsClient && <Hourglass className="size-3.5 text-warning" aria-label="Aguarda o cliente" />}
        <span className="text-xs text-muted-foreground tabular">{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 p-2", isOver && "bg-accent/60")}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <Card key={t.id} t={t} canMove={canMove} showClient={showClient} />
          ))}
        </SortableContext>
        {tasks.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">Arraste um card para cá</p>}
      </div>
    </section>
  );
}

function Card({ t, canMove, showClient }: { t: TaskRow; canMove: boolean; showClient: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !canMove });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
    >
      <TaskCardView t={t} showClient={showClient} />
    </div>
  );
}
