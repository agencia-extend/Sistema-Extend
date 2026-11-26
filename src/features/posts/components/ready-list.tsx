import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FORMAT_LABEL, type ContentFormat } from "@/domain/media";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import type { ReadyContent } from "@/features/posts/queries";

const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * Prontos para programar (RF-CON-04): o que o cliente aprovou e ainda não foi programado. "Programar" abre a
 * programação do cliente já com a legenda, o formato e a data do conteúdo.
 */
export function ReadyList({ rows, showClient, canPublish }: { rows: ReadyContent[]; showClient: boolean; canPublish: boolean }) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label="Conteúdos prontos para programar">
      {rows.map((r) => (
        <li key={r.taskId} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid min-w-0 gap-0.5">
            <Link href={`/tarefas/${r.taskId}`} className="text-sm font-medium break-words hover:underline">{r.title}</Link>
            <p className="text-xs text-muted-foreground tabular-nums">
              {[showClient ? r.clientName : null, r.format ? FORMAT_LABEL[r.format as ContentFormat] ?? r.format : TASK_TYPE_LABEL[r.type] ?? r.type, r.postOn ? `para ${day(r.postOn)}` : "sem data"].filter(Boolean).join(" · ")}
            </p>
            {r.caption ? <p className="line-clamp-2 text-sm break-words text-muted-foreground">{r.caption}</p> : <p className="text-xs text-warning">Sem legenda no conteúdo.</p>}
            {r.finalUrl && (
              <a href={r.finalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:underline">
                <ExternalLink className="size-3.5" aria-hidden="true" /> Arquivo final
              </a>
            )}
          </div>
          {canPublish && (
            <Link href={`/clientes/${r.clientId}/redes?programar=${r.taskId}#programacao`} className={buttonVariants({ size: "sm", variant: "outline" })} aria-label={`Programar ${r.title}`}>
              Programar
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
