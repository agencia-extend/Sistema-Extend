"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/app/states";
import { dueState, TASK_TYPE_LABEL } from "@/domain/tasks";
import { TASK_STATUS_LABEL } from "@/domain/tasks/status";
import type { TaskRow } from "@/features/tasks/queries";
import { TaskCardView } from "@/features/tasks/components/task-bits";
import { cn } from "@/lib/utils";

const ALL = "__todos";
type F = { cliente: string; pessoa: string; etapa: string; tipo: string; periodo: string; situacao: string; visao: string };

export function SectorView({ tasks, stats, filters: f }: { tasks: TaskRow[]; stats: { month: number; done: number; late: number; waiting: number }; filters: F }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v && v !== ALL) n.set(k, v);
    else n.delete(k);
    router.replace(`${pathname}${n.size ? `?${n}` : ""}`, { scroll: false });
  };

  const opts = useMemo(() => {
    const u = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];
    return {
      clients: u(tasks.filter((t) => t.clientId), (t) => t.clientId!).map((t) => ({ id: t.clientId!, name: t.clientName ?? "" })).sort((a, b) => a.name.localeCompare(b.name)),
      people: u(tasks.filter((t) => t.assigneeId), (t) => t.assigneeId!).map((t) => ({ id: t.assigneeId!, name: t.assigneeName ?? "" })).sort((a, b) => a.name.localeCompare(b.name)),
      steps: u(tasks.filter((t) => t.stepName), (t) => t.stepName!).map((t) => t.stepName!),
      types: [...new Set(tasks.map((t) => t.type))],
    };
  }, [tasks]);

  const list = tasks.filter(
    (t) =>
      (!f.cliente || t.clientId === f.cliente) &&
      (!f.pessoa || t.assigneeId === f.pessoa) &&
      (!f.etapa || t.stepName === f.etapa) &&
      (!f.tipo || t.type === f.tipo) &&
      (!f.situacao || (f.situacao === "atrasadas" ? dueState(t.dueAt, t.status) === "late" : f.situacao === "abertas" ? !["concluido", "cancelado"].includes(t.status) : t.status === "concluido")),
  );
  const byPerson = new Map<string, { name: string; open: number; late: number }>();
  for (const t of list) {
    const k = t.assigneeId ?? "-";
    const a = byPerson.get(k) ?? { name: t.assigneeName ?? "Sem responsável", open: 0, late: 0 };
    if (!["concluido", "cancelado"].includes(t.status)) a.open++;
    if (dueState(t.dueAt, t.status) === "late") a.late++;
    byPerson.set(k, a);
  }

  const sel = (k: keyof F, label: string, items: { id: string; name: string }[]) => (
    <Select value={f[k] || ALL} onValueChange={(v) => set(k, v)}>
      <SelectTrigger className="w-full sm:w-48" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {[
          ["No mês", stats.month, ""],
          ["Concluídas no mês", stats.done, ""],
          ["Atrasadas", stats.late, stats.late ? "text-danger" : ""],
          ["Aguardando cliente", stats.waiting, stats.waiting ? "text-warning" : ""],
        ].map(([l, v, c]) => (
          <div key={l as string} className="grid gap-1 bg-card p-4">
            <dt className="text-sm text-muted-foreground">{l}</dt>
            <dd className={cn("font-heading text-3xl font-semibold tabular", c as string)}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {sel("cliente", "Cliente", opts.clients)}
        {sel("pessoa", "Responsável", opts.people)}
        {sel("etapa", "Etapa", opts.steps.map((s) => ({ id: s, name: s })))}
        {sel("tipo", "Tipo", opts.types.map((t) => ({ id: t, name: TASK_TYPE_LABEL[t] ?? t })))}
        {sel("situacao", "Situação", [{ id: "abertas", name: "Abertas" }, { id: "atrasadas", name: "Atrasadas" }, { id: "concluidas", name: "Concluídas" }])}
        {sel("periodo", "Período", [{ id: "hoje", name: "Hoje" }, { id: "7", name: "Últimos 7 dias" }, { id: "30", name: "Últimos 30 dias" }])}
        {(f.cliente || f.pessoa || f.etapa || f.tipo || f.situacao || f.periodo) && <Button variant="ghost" onClick={() => router.replace(sp.get("visao") ? `${pathname}?visao=${sp.get("visao")}` : pathname)}>Limpar filtros</Button>}
      </div>

      {byPerson.size > 0 && (
        <section aria-labelledby="pessoas" className="grid gap-2">
          <h2 id="pessoas" className="text-base font-semibold">Por pessoa</h2>
          <ul className="flex flex-wrap gap-2">
            {[...byPerson].map(([id, p]) => (
              <li key={id}>
                <button type="button" onClick={() => set("pessoa", id === "-" ? "" : id)} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-brand/60">
                  {p.name} · <span className="tabular">{p.open}</span> abertas{p.late > 0 && <span className="text-danger"> · {p.late} atrasada{p.late > 1 ? "s" : ""}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma demanda com esses filtros" description="Mude o período ou limpe os filtros." />
      ) : (
        <section aria-label="Demandas" className="grid gap-3">
          {(["pendente", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido"] as const).map((st) => {
            const items = list.filter((t) => t.status === st);
            if (!items.length) return null;
            return (
              <div key={st} className="grid gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{TASK_STATUS_LABEL[st]} ({items.length})</h3>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map((t) => <li key={t.id}><TaskCardView t={t} showStep /></li>)}</ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
