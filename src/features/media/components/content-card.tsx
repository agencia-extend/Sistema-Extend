import { ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESTINATION_LABEL, FORMAT_LABEL, type ContentFormat, type Destination } from "@/domain/media";
import type { ContentRow } from "@/features/media/queries";
import { Section } from "@/features/clients/components/section";
import { ContentDialog } from "./content-dialog";

const day = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : null);

function Out({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-1 font-medium text-primary hover:underline">
      {children} <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

/** Bloco "Conteúdo" na página do card: o que a editora ou a designer precisa para produzir e onde entregar. */
export function ContentCard({ row, team, canEdit, canAssign }: { row: ContentRow; team: { id: string; name: string }[]; canEdit: boolean; canAssign: boolean }) {
  const isVideo = row.type === "video";
  const facts: [string, string | null][] = [
    ["Formato", row.format ? FORMAT_LABEL[row.format as ContentFormat] : null],
    ["Objetivo", row.objective || null],
    ...(isVideo ? ([["Gravação", [row.recorderName, day(row.recordingOn)].filter(Boolean).join(" · ") || null]] as [string, string | null][]) : []),
    [isVideo ? "Edição" : "Arte", row.editorName],
    ["Depois de aprovado", row.destination.map((d) => DESTINATION_LABEL[d as Destination]).join(", ") || null],
    ["Postagem", day(row.postOn)],
  ];
  return (
    <Section
      title="Conteúdo"
      action={
        canEdit ? (
          <ContentDialog row={row} team={team} canAssign={canAssign} trigger={<Button variant="outline" size="sm"><Pencil aria-hidden="true" /> Editar conteúdo</Button>} />
        ) : undefined
      }
    >
      <div className="grid gap-4 rounded-xl border bg-card p-4 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {facts.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 sm:block">
              <dt className="text-muted-foreground">{l}</dt>
              <dd className={v ? "text-right sm:text-left" : "text-right text-muted-foreground sm:text-left"}>{v ?? "A definir"}</dd>
            </div>
          ))}
        </dl>
        {row.reworkCount > 0 && (
          <p className="inline-flex items-center gap-1.5 text-warning">
            <RotateCcw className="size-4" aria-hidden="true" /> Voltou para alteração {row.reworkCount} {row.reworkCount > 1 ? "vezes" : "vez"}.
          </p>
        )}
        {row.script && (
          <div className="grid gap-1 border-t pt-3">
            <h3 className="font-sans text-xs font-medium text-muted-foreground">Roteiro</h3>
            <p className="wrap-break-word whitespace-pre-line">{row.script}</p>
          </div>
        )}
        {row.caption && (
          <div className="grid gap-1 border-t pt-3">
            <h3 className="font-sans text-xs font-medium text-muted-foreground">Legenda</h3>
            <p className="wrap-break-word whitespace-pre-line">{row.caption}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-3">
          {row.rawUrl && <Out href={row.rawUrl}>Takes brutos</Out>}
          {row.finalUrl && <Out href={row.finalUrl}>Conteúdo final</Out>}
          {row.postUrl && <Out href={row.postUrl}>Post publicado</Out>}
          {!row.rawUrl && !row.finalUrl && !row.postUrl && (
            <p className="text-muted-foreground">
              Nenhum link ainda. {canEdit ? "Quando o conteúdo estiver pronto, cole o link do Drive em Editar conteúdo." : ""}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
