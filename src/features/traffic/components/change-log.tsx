"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { byMonth, CHANGE_CATEGORY_LABEL, PLATFORM_LABEL, type ChangeCategory } from "@/domain/traffic";
import { monthTitle } from "@/domain/marketing";
import { deleteChange } from "@/features/traffic/actions";
import type { ChangeRow } from "@/features/traffic/queries";
import { handleResult } from "@/lib/action-feedback";
import { ChangeDialog } from "./change-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Registro de alterações, do mais recente para o mais antigo, agrupado por mês. */
export function ChangeLog({ clientId, today, rows, userId, canManage }: { clientId: string; today: string; rows: ChangeRow[]; userId: string; canManage: boolean }) {
  return (
    <div className="grid gap-6">
      {byMonth(rows).map((g) => (
        <section key={g.month} aria-label={monthTitle(`${g.month}-01`)} className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{monthTitle(`${g.month}-01`)}</h3>
          <ol className="divide-y rounded-xl border bg-card">
            {g.items.map((r) => {
              const mine = canManage && r.source === "manual" && r.createdBy === userId;
              return (
                <li key={r.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
                  <span className="text-sm font-medium tabular">{br(r.happenedOn)}</span>
                  <div className="grid min-w-0 gap-1">
                    <p className="text-xs text-muted-foreground">
                      {CHANGE_CATEGORY_LABEL[r.category as ChangeCategory] ?? r.category}
                      {r.platform ? ` · ${PLATFORM_LABEL[r.platform]}` : ""}
                      {r.source === "sync" ? " · detectada na sincronização" : r.source === "sistema" ? ` · feita pelo sistema${r.authorName ? ` por ${r.authorName}` : ""}` : r.authorName ? ` · ${r.authorName}` : ""}
                    </p>
                    <p className="text-sm font-medium break-words">{r.what}</p>
                    <p className="text-sm text-muted-foreground break-words"><span className="sr-only">Por quê: </span>{r.why}</p>
                  </div>
                  {mine && (
                    <div className="flex gap-1 sm:self-start">
                      <ChangeDialog
                        clientId={clientId}
                        today={today}
                        id={r.id}
                        initial={{ platform: r.platform ?? "__nenhuma", category: r.category, happenedOn: r.happenedOn, what: r.what, why: r.why }}
                        trigger={<Button variant="ghost" size="icon" aria-label={`Corrigir: ${r.what}`}><Pencil /></Button>}
                      />
                      <ConfirmDialog
                        trigger={<Button variant="ghost" size="icon" className="text-danger" aria-label={`Apagar: ${r.what}`}><Trash2 /></Button>}
                        title="Apagar esta alteração?"
                        description="Ela sai do registro do tráfego. A linha no histórico do cliente continua."
                        confirmLabel="Apagar"
                        onConfirm={async () => handleResult(await deleteChange({ id: r.id, clientId }))}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
