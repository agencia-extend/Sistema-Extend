import Link from "next/link";
import { ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL, type ContentFormat } from "@/domain/media";
import { formatDate } from "@/domain/shared/dates";
import type { ContentRow } from "@/features/media/queries";
import { cn } from "@/lib/utils";
import { ContentDialog } from "./content-dialog";

const day = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : null);

function StepChip({ row }: { row: ContentRow }) {
  return (
    <Link href={`/tarefas/${row.taskId}`} className="chip gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium hover:border-brand/60">
      <span className="size-2 rounded-full" style={{ background: row.step?.color ?? "#64748B" }} aria-hidden="true" />
      {row.step?.name ?? "Sem etapa"}
    </Link>
  );
}

function Links({ row }: { row: ContentRow }) {
  const items = [
    ["Final", row.finalUrl],
    ["Brutos", row.rawUrl],
    ["Post", row.postUrl],
  ].filter(([, u]) => u);
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([l, u]) => (
        <a key={l} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-1 font-medium text-primary hover:underline">
          {l} <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ))}
    </span>
  );
}

function Rework({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning" title="Vezes que voltou para alteração">
      <RotateCcw className="size-3" aria-hidden="true" /> {n} alteraç{n > 1 ? "ões" : "ão"}
    </span>
  );
}

/**
 * Controle de Mídias de um mês do cliente: uma linha por conteúdo contratado.
 * Tabela no desktop (como a planilha), cartões no celular.
 */
export function ContentTable({
  rows,
  team,
  canEdit,
  canAssign,
  nowIso,
}: {
  rows: ContentRow[];
  team: { id: string; name: string }[];
  canEdit: boolean;
  canAssign: boolean;
  nowIso: string;
}) {
  const late = (r: ContentRow) => Boolean(r.dueAt && r.dueAt < nowIso && !["aprovado", "concluido", "cancelado"].includes(r.status));
  const edit = (r: ContentRow, n: number, variant: "icon" | "full") =>
    canEdit ? (
      <ContentDialog
        row={r}
        team={team}
        canAssign={canAssign}
        trigger={
          variant === "icon" ? (
            <Button variant="ghost" size="icon" aria-label={`Editar conteúdo ${n}: ${r.title}`}><Pencil /></Button>
          ) : (
            <Button variant="outline" size="sm"><Pencil aria-hidden="true" /> Editar</Button>
          )
        }
      />
    ) : null;

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card lg:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 font-medium">Nº</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Tema</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Formato</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Gravação</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Edição / arte</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Prazo</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Links</th>
              <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={r.taskId} className={cn(r.status === "cancelado" && "opacity-50")}>
                <td className="px-3 py-2.5 text-muted-foreground tabular">{i + 1}</td>
                <td className="max-w-72 px-3 py-2.5">
                  <Link href={`/tarefas/${r.taskId}`} className="line-clamp-2 font-medium hover:underline">{r.title}</Link>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {r.objective && <span>{r.objective}</span>}
                    <Rework n={r.reworkCount} />
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{r.format ? FORMAT_LABEL[r.format as ContentFormat] : <span className="text-muted-foreground">A definir</span>}</td>
                <td className="px-3 py-2.5">
                  {r.type !== "video" ? <span className="text-muted-foreground">—</span> : r.recorderName || r.recordingOn ? (
                    <span className="grid"><span>{r.recorderName ?? "A definir"}</span>{r.recordingOn && <span className="text-xs text-muted-foreground tabular">{day(r.recordingOn)}</span>}</span>
                  ) : <span className="text-muted-foreground">A definir</span>}
                </td>
                <td className="px-3 py-2.5">{r.editorName ?? <span className="text-muted-foreground">A definir</span>}</td>
                <td className="px-3 py-2.5">
                  <StepChip row={r} />
                  {r.assigneeName && r.status !== "concluido" && <span className="mt-0.5 block text-xs text-muted-foreground">com {r.assigneeName}</span>}
                </td>
                <td className={cn("px-3 py-2.5 whitespace-nowrap tabular", late(r) && "font-medium text-danger")}>
                  {r.dueAt ? formatDate(r.dueAt) : "—"}
                  {late(r) && <span className="block text-xs">atrasado</span>}
                </td>
                <td className="px-3 py-2.5 text-xs"><Links row={r} /></td>
                <td className="px-1 py-1.5 text-right">{edit(r, i + 1, "icon")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular e tablet: cartões */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((r, i) => (
          <li key={r.taskId} className={cn("grid gap-2 rounded-xl border bg-card p-3.5", late(r) && "border-danger/50", r.status === "cancelado" && "opacity-50")}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular">
                Conteúdo {i + 1}{r.format ? ` · ${FORMAT_LABEL[r.format as ContentFormat]}` : ""}
              </span>
              <StepChip row={r} />
            </div>
            <Link href={`/tarefas/${r.taskId}`} className="text-sm leading-snug font-medium hover:underline">{r.title}</Link>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {r.type === "video" && (
                <div><dt className="text-muted-foreground">Gravação</dt><dd>{r.recorderName ?? "A definir"}{r.recordingOn ? ` · ${day(r.recordingOn)}` : ""}</dd></div>
              )}
              <div><dt className="text-muted-foreground">{r.type === "video" ? "Edição" : "Arte"}</dt><dd>{r.editorName ?? "A definir"}</dd></div>
              {r.assigneeName && r.status !== "concluido" && <div><dt className="text-muted-foreground">Agora com</dt><dd>{r.assigneeName}</dd></div>}
              <div><dt className="text-muted-foreground">Prazo</dt><dd className={cn("tabular", late(r) && "font-medium text-danger")}>{r.dueAt ? formatDate(r.dueAt) : "—"}{late(r) ? " · atrasado" : ""}</dd></div>
              <div><dt className="text-muted-foreground">Links</dt><dd><Links row={r} /></dd></div>
            </dl>
            <div className="flex items-center justify-between gap-2">
              <Rework n={r.reworkCount} />
              <span className="ml-auto">{edit(r, i + 1, "full")}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
