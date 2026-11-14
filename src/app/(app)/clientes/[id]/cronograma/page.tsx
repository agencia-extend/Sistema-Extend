import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, ImageIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listSchedule, type PostRow } from "@/features/schedule/queries";
import { PostDialog } from "@/features/schedule/components/post-dialog";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL, todayKey } from "@/domain/media";
import { POST_STATE_LABEL, gridOrder, monthLabel, monthParam, monthRange, postState, shiftMonth, weekOf } from "@/domain/schedule";
import { dayLabel } from "@/domain/trainings";
import { cn } from "@/lib/utils";

const STATE_TONE = { postado: "bg-success-soft text-success", programado: "bg-info-soft text-info", sem_data: "bg-warning-soft text-warning" } as const;

/** Cronograma de posts do cliente: lista por semana e prévia do feed (grid do Instagram). */
export default async function CronogramaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string; visao?: string }> }) {
  const user = await requirePermission("tasks.read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const month = monthParam(sp.mes, todayKey(new Date()));
  const view = sp.visao === "grid" ? "grid" : "lista";
  const { start, end } = monthRange(month);
  const posts = await listSchedule(id, start, end);
  const canEdit = Boolean(user.permissions["tasks.manage"]);
  const base = `/clientes/${id}/cronograma`;
  const q = (m: string, v: string) => `${base}?mes=${m}${v === "grid" ? "&visao=grid" : ""}`;

  return (
    <div className="grid max-w-5xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon"><Link href={q(shiftMonth(month, -1), view)} aria-label="Mês anterior"><ChevronLeft /></Link></Button>
          <h2 className="min-w-44 text-center text-base font-semibold capitalize">{monthLabel(month)}</h2>
          <Button asChild variant="ghost" size="icon"><Link href={q(shiftMonth(month, 1), view)} aria-label="Próximo mês"><ChevronRight /></Link></Button>
        </div>
        <nav aria-label="Visualização" className="inline-flex rounded-lg border p-0.5 text-sm">
          {(["lista", "grid"] as const).map((v) => (
            <Link key={v} href={q(month, v)} aria-current={view === v ? "page" : undefined} className={cn("rounded-md px-3 py-1.5", view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
              {v === "lista" ? "Lista" : "Grid do Instagram"}
            </Link>
          ))}
        </nav>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum post neste mês"
          description="Os conteúdos aprovados entram aqui quando têm data de post ou o destino “Cronograma” no Controle de Mídias."
        />
      ) : view === "grid" ? (
        <Grid posts={posts} clientId={id} canEdit={canEdit} />
      ) : (
        <List posts={posts} clientId={id} canEdit={canEdit} />
      )}
    </div>
  );
}

function List({ posts, clientId, canEdit }: { posts: PostRow[]; clientId: string; canEdit: boolean }) {
  const groups = new Map<string, { label: string; items: PostRow[] }>();
  for (const p of posts) {
    const w = p.postOn ? weekOf(p.postOn) : { key: "zzz", label: "Sem data" };
    if (!groups.has(w.key)) groups.set(w.key, { label: w.label, items: [] });
    groups.get(w.key)!.items.push(p);
  }
  return (
    <div className="grid gap-5">
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => (
        <section key={k} aria-label={g.label} className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{g.label}</h3>
          <ul className="divide-y rounded-xl border bg-card">
            {g.items.map((p) => {
              const state = postState(p.postOn, p.postUrl);
              return (
                <li key={p.taskId} className="flex gap-3 px-4 py-3">
                  <Cover post={p} className="h-[70px] w-14 shrink-0" />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/tarefas/${p.taskId}`} className="text-sm font-medium break-words hover:underline">{p.title}</Link>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATE_TONE[state])}>{POST_STATE_LABEL[state]}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular">{[p.postOn ? dayLabel(p.postOn) : null, p.format ? FORMAT_LABEL[p.format] : null].filter(Boolean).join(" · ")}</span>
                    {p.caption && <p className="line-clamp-2 text-sm break-words text-muted-foreground">{p.caption}</p>}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {p.postUrl && <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><ExternalLink className="size-3.5" aria-hidden="true" /> Ver post</a>}
                      {p.finalUrl && <a href={p.finalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline"><ExternalLink className="size-3.5" aria-hidden="true" /> Arquivo final</a>}
                    </div>
                  </div>
                  {canEdit && (
                    <PostDialog clientId={clientId} post={p} trigger={<Button variant="outline" size="sm" className="self-start" aria-label={`Programar ${p.title}`}>Programar</Button>} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Grid({ posts, clientId, canEdit }: { posts: PostRow[]; clientId: string; canEdit: boolean }) {
  const ordered = gridOrder(posts);
  const undated = posts.length - ordered.length;
  return (
    <div className="grid justify-items-center gap-3">
      <p className="text-sm text-muted-foreground">Prévia do feed: o post mais novo fica no canto de cima, à esquerda.{undated > 0 && ` ${undated} post(s) sem data não aparecem aqui.`}</p>
      <ul aria-label="Grid do Instagram" className="grid w-full max-w-md grid-cols-3 gap-0.5 overflow-hidden rounded-lg border bg-border">
        {ordered.map((p) => {
          const tile = (
            <span className="relative block aspect-[4/5] bg-card">
              <Cover post={p} className="size-full rounded-none border-0" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] leading-tight text-white tabular">{p.postOn ? dayLabel(p.postOn).slice(0, 5) : ""}</span>
            </span>
          );
          return (
            <li key={p.taskId}>
              {canEdit ? <PostDialog clientId={clientId} post={p} trigger={<button type="button" className="block w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Programar ${p.title}`}>{tile}</button>} /> : tile}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Cover({ post, className }: { post: PostRow; className?: string }) {
  if (post.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do Storage
    return <img src={post.coverUrl} alt={`Capa de ${post.title}`} className={cn("rounded-md border object-cover", className)} loading="lazy" />;
  }
  return (
    <span className={cn("grid place-items-center gap-1 rounded-md border bg-muted p-1 text-center text-[10px] leading-tight text-muted-foreground", className)}>
      <ImageIcon className="size-4" aria-hidden="true" />
      <span className="line-clamp-3 break-words">{post.title}</span>
    </span>
  );
}
