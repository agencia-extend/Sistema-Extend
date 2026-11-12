"use client";

import { useCallback, useMemo, useState } from "react";
import { Kanban as KanbanIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/states";
import { BOARD_GROUPS, boardGroupOf, targetStep, type BoardGroup, type FlowStep } from "@/domain/media";
import type { BoardCard } from "@/features/media/queries";
import type { TaskRow, Workflow } from "@/features/tasks/queries";
import { Kanban, type KanbanColumn } from "@/features/tasks/components/kanban";

const ALL = "__todos";
const COLUMNS: KanbanColumn[] = BOARD_GROUPS.map((g) => ({ id: g.id, name: g.name, color: g.color, kind: "step" }));

/**
 * Quadro do setor (substitui o Trello de Edição e de Design): todos os clientes juntos,
 * nas colunas que a equipe já usa. Cada coluna agrupa as etapas do fluxo; soltar o card
 * muda a etapa, troca o responsável e avisa a próxima pessoa.
 */
export function SectorBoard({ cards, flows, sectorId, sectorKey, canMove }: { cards: BoardCard[]; flows: Workflow[]; sectorId: string; sectorKey: string; canMove: boolean }) {
  const [client, setClient] = useState(ALL);
  const [person, setPerson] = useState(ALL);

  const stepsOf = useMemo(() => {
    const m = new Map<string, { steps: FlowStep[]; byId: Map<string, Workflow["steps"][number]> }>();
    for (const w of flows) m.set(w.taskType, { steps: w.steps, byId: new Map(w.steps.map((s) => [s.id, s])) });
    return m;
  }, [flows]);

  const columnOf = useCallback((t: TaskRow) => boardGroupOf(stepsOf.get(t.type)?.steps ?? [], t.stepId, sectorId), [stepsOf, sectorId]);
  const stepFor = useCallback(
    (t: TaskRow, columnId: string) => {
      const flow = stepsOf.get(t.type);
      if (!flow) return null;
      const id = targetStep(flow.steps, sectorId, columnId as BoardGroup, t.stepId);
      const s = id ? flow.byId.get(id) : null;
      return s ? { id: s.id, name: s.name, color: s.color, waitsClient: s.waitsClient } : null;
    },
    [stepsOf, sectorId],
  );

  const opts = useMemo(() => {
    const u = (pairs: [string, string][]) => [...new Map(pairs).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return {
      clients: u(cards.filter((c) => c.clientId).map((c) => [c.clientId!, c.clientName ?? ""])),
      people: u(cards.map((c) => [c.editorId, c.editorName ?? "Sem nome"])),
    };
  }, [cards]);

  // No quadro, o nome no card é de quem edita/cria; as etiquetas repetem as do Trello.
  const tasks = useMemo<TaskRow[]>(
    () =>
      cards
        .filter((c) => (client === ALL || c.clientId === client) && (person === ALL || c.editorId === person))
        .map((c) => {
          const step = stepsOf.get(c.type)?.byId.get(c.stepId ?? "");
          const group = boardGroupOf(stepsOf.get(c.type)?.steps ?? [], c.stepId, sectorId);
          const tags = [...c.tags];
          if (step?.isRework) tags.unshift({ id: "em-alteracao", name: "Em alteração", color: "#EC4899" });
          else if (group === "cronograma" || group === "finalizado") tags.unshift({ id: "aprovado", name: "Aprovado", color: "#22C55E" });
          return { ...c, assigneeName: c.editorName, tags };
        }),
    [cards, client, person, stepsOf, sectorId],
  );

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={KanbanIcon}
        title="Nenhum conteúdo no quadro ainda"
        description="Um card entra aqui quando alguém é escolhido para editar ou criar o conteúdo, no Controle de Mídias do cliente."
      />
    );
  }

  const sel = (value: string, set: (v: string) => void, label: string, items: { id: string; name: string }[]) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="w-full sm:w-56" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {sel(client, setClient, "Cliente", opts.clients)}
        {opts.people.length > 1 && sel(person, setPerson, "Pessoa", opts.people)}
      </div>
      <Kanban columns={COLUMNS} tasks={tasks} channel={`setor-${sectorKey}`} canMove={canMove} columnOf={columnOf} stepFor={stepFor} />
    </div>
  );
}
