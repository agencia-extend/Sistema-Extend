import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHECK_ITEMS, DECISION_LABEL, DECISION_LEVEL_LABEL, checkProblems, type CheckKind } from "@/domain/traffic";
import type { CheckRow } from "@/features/traffic/queries";
import { cn } from "@/lib/utils";
import { CheckDialog } from "./check-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const hour = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Situação do checklist do período: feito (com ou sem problema) ou em aberto. */
export function CheckStatusLine({ row, open }: { row: { problems: number; doneAt: string; by: string | null } | null; open: string }) {
  if (!row)
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-warning">
        <CircleDashed className="size-4 shrink-0" aria-hidden="true" /> {open}
      </span>
    );
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5", row.problems ? "text-danger" : "text-success")}>
      {row.problems ? <CircleAlert className="size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
      <span className="whitespace-nowrap">{row.problems ? `${row.problems} ${row.problems === 1 ? "problema" : "problemas"}` : "Tudo ok"}</span>
      <span className="text-muted-foreground">· {row.by ?? "—"}, {hour(row.doneAt)}</span>
    </span>
  );
}

function PeriodCard({ kind, periodOn, row, clientId, clientName, canManage }: { kind: CheckKind; periodOn: string; row: CheckRow | null; clientId: string; clientName: string; canManage: boolean }) {
  const label = kind === "diario" ? `Hoje, ${br(periodOn)}` : `Semana de ${br(periodOn)}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="grid gap-0.5 text-sm">
        <p className="font-medium">{label}</p>
        <CheckStatusLine row={row && { problems: row.problems, doneAt: row.doneAt, by: row.doneByName }} open="Em aberto" />
      </div>
      {canManage && (
        <CheckDialog
          clientId={clientId}
          clientName={clientName}
          kind={kind}
          periodOn={periodOn}
          existing={row}
          trigger={<Button size="sm" variant={row ? "outline" : "default"}>{row ? "Revisar" : kind === "diario" ? "Fazer o do dia" : "Fazer o da semana"}</Button>}
        />
      )}
    </div>
  );
}

/** Checklists do cliente: hoje e esta semana no topo, depois os anteriores com problemas e decisões. */
export function CheckHistory({ clientId, clientName, today, monday, rows, canManage }: { clientId: string; clientName: string; today: string; monday: string; rows: CheckRow[]; canManage: boolean }) {
  const daily = rows.find((r) => r.kind === "diario" && r.periodOn === today) ?? null;
  const weekly = rows.find((r) => r.kind === "semanal" && r.periodOn === monday) ?? null;
  const past = rows.filter((r) => r !== daily && r !== weekly);
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <PeriodCard kind="diario" periodOn={today} row={daily} clientId={clientId} clientName={clientName} canManage={canManage} />
        <PeriodCard kind="semanal" periodOn={monday} row={weekly} clientId={clientId} clientName={clientName} canManage={canManage} />
      </div>
      {past.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card" aria-label="Checklists anteriores">
          {past.map((r) => {
            const problems = checkProblems(r.kind, r.items);
            return (
              <li key={r.id} className="grid gap-1.5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">{r.kind === "diario" ? `Dia ${br(r.periodOn)}` : `Semana de ${br(r.periodOn)}`}</p>
                  <CheckStatusLine row={{ problems: r.problems, doneAt: r.doneAt, by: r.doneByName }} open="" />
                </div>
                {problems.map((p) => (
                  <p key={p.label} className="break-words text-muted-foreground"><span className="font-medium text-danger">{p.label}:</span> {p.note}</p>
                ))}
                {r.decisions.map((d, i) => (
                  <p key={i} className="break-words text-muted-foreground">
                    <span className="font-medium text-foreground">{DECISION_LABEL[d.decision]}</span> {DECISION_LEVEL_LABEL[d.level].toLowerCase()} {d.target}: {d.why}
                  </p>
                ))}
                {r.notes && <p className="break-words text-muted-foreground">{r.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Diário: {CHECK_ITEMS.diario.map((i) => i.label.toLowerCase()).join(", ")}. Semanal: {CHECK_ITEMS.semanal.map((i) => i.label.toLowerCase()).join(", ")} e decisões.
      </p>
    </div>
  );
}
