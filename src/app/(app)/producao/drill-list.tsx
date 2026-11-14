import Link from "next/link";
import { X } from "lucide-react";
import type { ReportTask } from "@/domain/media/report";
import { formatDate } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";

/** Lista das demandas por trás de um número do Controle geral. */
export function DrillList({ title, tasks, closeHref }: { title: string; tasks: ReportTask[]; closeHref: string }) {
  const nowIso = new Date().toISOString();
  return (
    <section id="lista" aria-labelledby="lista-t" className="grid scroll-mt-20 gap-3 rounded-xl border border-brand/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id="lista-t" className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground tabular">{tasks.length} demanda{tasks.length === 1 ? "" : "s"}</p>
        </div>
        <Link href={closeHref} scroll={false} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden="true" /> Fechar
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma demanda neste número.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Demanda</th>
                <th scope="col" className="py-2 pr-3 font-medium">Cliente</th>
                <th scope="col" className="py-2 pr-3 font-medium">Etapa</th>
                <th scope="col" className="py-2 pr-3 font-medium">Quem edita</th>
                <th scope="col" className="py-2 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((t) => {
                const late = Boolean(t.dueAt && t.dueAt < nowIso && t.status !== "concluido");
                return (
                  <tr key={t.id}>
                    <td className="py-2 pr-3"><Link href={`/tarefas/${t.id}`} className="font-medium hover:underline">{t.title}</Link></td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.clientName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {t.stepName ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: t.stepColor }} aria-hidden="true" />{t.stepName}</span> : "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.editorName ?? "—"}</td>
                    <td className={cn("py-2 tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>{t.dueAt ? formatDate(t.dueAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
