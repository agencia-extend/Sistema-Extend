import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, Library } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { listLibrary } from "@/features/creatives/queries";
import { LibraryEdit } from "@/features/creatives/components/library-edit";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUSES, LIBRARY_STATUS_LABEL, LIBRARY_STATUS_TONE } from "@/domain/creatives";
import { formatDate } from "@/domain/shared/dates";
import { todayKey } from "@/domain/media";
import { cn } from "@/lib/utils";
import { LibraryFilters } from "./library-filters";

export const metadata: Metadata = { title: "Biblioteca de criativos" };

type Search = { q?: string; cliente?: string; situacao?: string; formato?: string; mes?: string };

/** Biblioteca: todo criativo aprovado, com a copy, a peça e a situação (em teste, vencedor…). */
export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const all = await listLibrary();
  const canEdit = Boolean(user?.permissions["creatives.library.manage"] || user?.permissions["creatives.review"]);
  const term = (sp.q ?? "").trim().toLowerCase();
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayKey(new Date()).slice(0, 7);
  const items = all.filter(
    (i) =>
      (!term || [i.angle, i.campaign, i.primaryText, i.headline, i.clientName].some((x) => x?.toLowerCase().includes(term))) &&
      (!sp.cliente || i.clientId === sp.cliente) &&
      (!sp.situacao || i.status === sp.situacao) &&
      (!sp.formato || i.format === sp.formato),
  );
  const clients = [...new Map(all.map((i) => [i.clientId, i.clientName])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LibraryFilters clients={clients} statuses={LIBRARY_STATUSES.map((s) => [s, LIBRARY_STATUS_LABEL[s]])} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Exportar {month.slice(5)}/{month.slice(0, 4)}:</span>
          <a href={`/criativos/biblioteca/exportar?formato=csv&mes=${month}`} download className={buttonVariants({ variant: "outline", size: "sm" })}><Download aria-hidden="true" /> CSV</a>
          <a href={`/criativos/biblioteca/exportar?formato=pdf&mes=${month}`} download className={buttonVariants({ variant: "outline", size: "sm" })}><Download aria-hidden="true" /> PDF</a>
        </div>
      </div>
      {all.length === 0 ? (
        <EmptyState icon={Library} title="A biblioteca está vazia" description="Todo criativo aprovado (internamente ou pelo cliente) entra aqui com a copy e a peça." />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum criativo com estes filtros.</p>
      ) : (
        <ul aria-label="Biblioteca de criativos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <li key={i.id} className="grid content-start gap-2 overflow-hidden rounded-xl border bg-card">
              <div className="grid aspect-[4/5] place-items-center overflow-hidden bg-muted">
                {i.previewKind === "imagem" && i.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do armazenamento privado
                  <img src={i.previewUrl} alt={i.angle} className="size-full object-cover" loading="lazy" />
                ) : i.previewKind === "video" && i.previewUrl ? (
                  <video src={i.previewUrl} controls preload="metadata" className="size-full bg-black object-contain" aria-label={i.angle} />
                ) : i.previewUrl ? (
                  <a href={i.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ExternalLink className="size-4" aria-hidden="true" /> Abrir a peça</a>
                ) : (
                  <span className="text-sm text-muted-foreground">Sem prévia</span>
                )}
              </div>
              <div className="grid gap-1 px-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/criativos/${i.taskId}`} className="text-sm font-medium break-words hover:underline">{i.angle}</Link>
                  {canEdit && <LibraryEdit item={i} />}
                </div>
                <span className="text-xs text-muted-foreground">{i.clientName} · {CREATIVE_FORMAT_LABEL[i.format]} · {i.campaign}</span>
                <span className={cn("w-fit rounded-full px-2 py-0.5 text-xs font-medium", LIBRARY_STATUS_TONE[i.status])}>{LIBRARY_STATUS_LABEL[i.status]}</span>
                {i.primaryText && <p className="line-clamp-3 text-sm break-words text-muted-foreground">{i.primaryText}</p>}
                <span className="text-xs text-muted-foreground tabular">Aprovado em {formatDate(i.approvedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
