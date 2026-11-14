import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, ImageIcon } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalSchedule, type PortalPost } from "@/features/portal/queries";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL, todayKey } from "@/domain/media";
import { monthLabel, monthParam, monthRange, postState, shiftMonth, weekOf } from "@/domain/schedule";
import { shortDay } from "@/domain/portal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cronograma" };

/** Situação do post para o cliente: postado, programado, sem data ou ainda em produção. */
function state(p: PortalPost): { label: string; tone: string } {
  const s = postState(p.postOn, p.postUrl);
  if (s === "postado") return { label: "Postado", tone: "bg-success-soft text-success" };
  if (!p.done) return { label: "Em produção", tone: "bg-muted text-muted-foreground" };
  return s === "programado" ? { label: "Programado", tone: "bg-info-soft text-info" } : { label: "Sem data", tone: "bg-warning-soft text-warning" };
}

/** Cronograma de conteúdo do mês (RF-ACL-02), agrupado por semana. */
export default async function PortalSchedulePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const [{ clientId }, sp] = await Promise.all([requirePortal(), searchParams]);
  const month = monthParam(sp.mes, todayKey(new Date()));
  const { start, end } = monthRange(month);
  const posts = await portalSchedule(clientId, start, end);

  const groups = new Map<string, { label: string; items: PortalPost[] }>();
  for (const p of posts) {
    const w = p.postOn ? weekOf(p.postOn) : { key: "zzz", label: "Ainda sem data" };
    if (!groups.has(w.key)) groups.set(w.key, { label: w.label, items: [] });
    groups.get(w.key)!.items.push(p);
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Cronograma</h1>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon"><Link href={`/portal/cronograma?mes=${shiftMonth(month, -1)}`} aria-label="Mês anterior"><ChevronLeft /></Link></Button>
          <h2 className="min-w-40 text-center text-base font-semibold capitalize" aria-live="polite">{monthLabel(month)}</h2>
          <Button asChild variant="ghost" size="icon"><Link href={`/portal/cronograma?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês"><ChevronRight /></Link></Button>
        </div>
      </header>

      {posts.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum post neste mês" description="Os posts entram aqui quando a equipe programa a data de publicação." />
      ) : (
        <div className="grid gap-5">
          {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => (
            <section key={k} aria-label={g.label} className="grid gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{g.label}</h3>
              <ul className="divide-y rounded-xl border bg-card">
                {g.items.map((p) => {
                  const st = state(p);
                  return (
                    <li key={p.taskId} className="flex gap-3 px-4 py-3">
                      <div className="grid h-[70px] w-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                        {p.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do armazenamento privado
                          <img src={p.coverUrl} alt="" width={56} height={70} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <div className="grid min-w-0 flex-1 content-start gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium break-words">{p.title}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.tone)}>{st.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[p.postOn ? shortDay(p.postOn) : null, p.format ? FORMAT_LABEL[p.format] : null].filter(Boolean).join(" · ")}
                        </p>
                        {p.caption && <p className="line-clamp-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">{p.caption}</p>}
                        {p.postUrl && (
                          <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                            <ExternalLink className="size-3.5" aria-hidden="true" /> Ver o post publicado
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
