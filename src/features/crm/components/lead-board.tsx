"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
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
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { usePostgresChanges } from "@/lib/supabase/use-postgres-changes";
import { formatBRL } from "@/domain/shared/money";
import { moveLead } from "@/features/crm/actions";
import type { LeadRow, Stage } from "@/features/crm/queries";
import { LeadCard } from "./lead-card";
import { LoseDialog } from "./lose-dialog";
import { cn } from "@/lib/utils";

/**
 * Funil em quadro (RF-CRM-02): arrastar com mouse, toque ou teclado muda a etapa.
 * Perdido pede o motivo; Ganho leva ao fechamento comercial com os dados do lead.
 */
export function LeadBoard({ pipelineId, stages, leads: initial, canMove, canHandoff, now }: { pipelineId: string; stages: Stage[]; leads: LeadRow[]; canMove: boolean; canHandoff: boolean; now: number }) {
  const router = useRouter();
  const dndId = useId();
  const [leads, setLeads] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setLeads(initial);
  }
  const [active, setActive] = useState<LeadRow | null>(null);
  const [losing, setLosing] = useState<{ lead: LeadRow; stageId: string } | null>(null);
  const [, start] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  usePostgresChanges(`funil:${pipelineId}`, { event: "*", table: "leads", filter: `pipeline_id=eq.${pipelineId}` }, () => router.refresh());

  const byStage = useMemo(() => {
    const m = new Map<string, LeadRow[]>(stages.map((s) => [s.id, []]));
    for (const l of leads) m.get(l.stageId)?.push(l);
    return m;
  }, [leads, stages]);

  const apply = (lead: LeadRow, stageId: string, reason = "") => {
    const before = leads;
    const stage = stages.find((s) => s.id === stageId)!;
    setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, stageId, stageChangedAt: new Date().toISOString() } : l)));
    return new Promise<string | null>((resolve) =>
      start(async () => {
        const res = await moveLead({ id: lead.id, stageId, reason });
        if (!res.ok) {
          setLeads(before);
          toast.error(res.message);
          return resolve(res.message);
        }
        resolve(null);
        if (stage.kind === "ganho" && canHandoff && !lead.wonClientId) {
          toast.success("Ganho! Registre o fechamento para o cliente entrar em onboarding.");
          router.push(`/clientes/novo?lead=${lead.id}`);
        } else {
          toast.success(`Movido para ${stage.name}.`);
          router.refresh();
        }
      }),
    );
  };

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const lead = leads.find((l) => l.id === String(e.active.id));
    const over = e.over ? String(e.over.id) : null;
    if (!lead || !over) return;
    const stageId = byStage.has(over) ? over : leads.find((l) => l.id === over)?.stageId;
    if (!stageId || stageId === lead.stageId) return;
    if (stages.find((s) => s.id === stageId)?.kind === "perdido") return void setLosing({ lead, stageId });
    void apply(lead, stageId);
  };

  const slaOf = new Map(stages.map((s) => [s.id, s.slaDays]));
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActive(leads.find((l) => l.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {stages.map((s) => (
          <Column key={s.id} stage={s} leads={byStage.get(s.id) ?? []} canMove={canMove} now={now} />
        ))}
      </div>
      <DragOverlay>{active ? <div className="w-72 rotate-1"><LeadCard lead={active} slaDays={slaOf.get(active.stageId) ?? null} open now={now} /></div> : null}</DragOverlay>
      <LoseDialog
        open={Boolean(losing)}
        leadName={losing?.lead.name ?? ""}
        onCancel={() => setLosing(null)}
        onConfirm={async (reason) => {
          const err = await apply(losing!.lead, losing!.stageId, reason);
          if (!err) setLosing(null);
          return err;
        }}
      />
    </DndContext>
  );
}

function Column({ stage, leads, canMove, now }: { stage: Stage; leads: LeadRow[]; canMove: boolean; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: !canMove });
  const total = leads.reduce((a, l) => a + (l.valueCents ?? 0), 0);
  const closed = stage.kind !== "aberta";
  // Ganho e Perdido acumulam: mostram só os mais recentes para o quadro não ficar pesado.
  const shown = closed ? [...leads].sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt)).slice(0, 30) : leads;
  return (
    <section aria-label={stage.name} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/40">
      <header className="grid gap-0.5 border-b px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: stage.color }} aria-hidden="true" />
          <h3 className="flex-1 truncate text-sm font-semibold">{stage.name}</h3>
          <span className="text-xs text-muted-foreground tabular">{leads.length}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular">
          {total ? formatBRL(total) : "Sem valor estimado"}
          {stage.slaDays && !closed ? ` · prazo ${stage.slaDays} dia${stage.slaDays === 1 ? "" : "s"}` : ""}
        </span>
      </header>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 p-2", isOver && "bg-accent/60")}>
        <SortableContext items={shown.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {shown.map((l) => (
            <Card key={l.id} lead={l} slaDays={stage.slaDays} open={!closed} canMove={canMove} now={now} />
          ))}
        </SortableContext>
        {leads.length > shown.length && <p className="px-1 text-center text-xs text-muted-foreground">E mais {leads.length - shown.length} na lista de leads.</p>}
        {leads.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">{canMove ? "Arraste um lead para cá" : "Nenhum lead"}</p>}
      </div>
    </section>
  );
}

function Card({ lead, slaDays, open, canMove, now }: { lead: LeadRow; slaDays: number | null; open: boolean; canMove: boolean; now: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, disabled: !canMove });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("touch-manipulation", isDragging && "opacity-40")} {...attributes} {...listeners} aria-roledescription="card arrastável">
      <LeadCard lead={lead} slaDays={slaDays} open={open} now={now} />
    </div>
  );
}
