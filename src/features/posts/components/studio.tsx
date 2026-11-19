import Link from "next/link";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { POST_FORMAT_SHORT, POST_STATUS_LABEL, type PostStatus } from "@/domain/posts";
import type { SocialProfileView } from "@/features/social/queries";
import type { PostRow } from "@/features/posts/queries";
import { cn } from "@/lib/utils";

// Estúdio de publicações (como no HubSystem, features/content/components/studio.tsx): perfis à esquerda,
// cabeçalho com os números e os botões de criar, e o planejador do mês.

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEK = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const monthTitle = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
/** Dia em São Paulo (UTC-3, sem horário de verão). */
export const spDay = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
export const spTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export function PlatformMark({ platform, className }: { platform: string; className?: string }) {
  const ig = platform === "instagram";
  return (
    <span className={cn("grid size-4 place-items-center rounded-[4px] text-[9px] font-bold text-white", ig ? "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]" : "bg-[#1877f2]", className)} aria-label={ig ? "Instagram" : "Facebook"}>
      {ig ? "IG" : "f"}
    </span>
  );
}

export function ProfileAvatar({ profile, size = "md" }: { profile: Pick<SocialProfileView, "name" | "platform" | "pictureUrl">; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-12" : "size-9";
  return (
    <span className={cn("relative shrink-0", box)}>
      {profile.pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto do perfil na Meta (link que expira)
        <img src={profile.pictureUrl} alt="" width={48} height={48} loading="lazy" referrerPolicy="no-referrer" className={cn("rounded-full bg-muted object-cover", box)} />
      ) : (
        <span className={cn("grid place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground", box)} aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
      )}
      <PlatformMark platform={profile.platform} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface" />
    </span>
  );
}

/** Perfis ligados aos clientes, para escolher de quem é o estúdio. */
export function ProfileRail({ profiles, current, href }: { profiles: SocialProfileView[]; current: string | null; href: (perfil: string | null) => string }) {
  return (
    <nav aria-label="Perfis" className="grid content-start gap-1 rounded-xl border bg-surface p-2 lg:sticky lg:top-20">
      <Link href={href(null)} aria-current={!current ? "page" : undefined}
        className={cn("rounded-lg px-3 py-2 text-sm font-medium", !current ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
        Todos os perfis
      </Link>
      <ul className="grid max-h-[60dvh] gap-0.5 overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-12rem)]">
        {profiles.map((p) => (
          <li key={p.id}>
            <Link href={href(p.id)} aria-current={current === p.id ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", current === p.id ? "bg-accent" : "hover:bg-muted")}>
              <ProfileAvatar profile={p} />
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{p.username ? `@${p.username}` : p.name}</span>
                <span className="truncate text-xs text-muted-foreground">{p.clientName ?? "Sem cliente"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const STATUS_TONE: Record<PostStatus, string> = {
  agendado: "border-info/40 bg-info-soft text-info",
  publicando: "border-info/40 bg-info-soft text-info",
  publicado: "border-success/40 bg-success-soft text-success",
  erro: "border-danger/40 bg-danger-soft text-danger",
  cancelado: "border-border bg-muted text-muted-foreground line-through",
};

/** Planejador do mês: grade no computador, lista de dias no celular. Tocar no dia mostra as publicações dele. */
export function Planner({ month, posts, today, selectedDay, dayHref, monthHref }: {
  month: string; posts: PostRow[]; today: string; selectedDay: string | null; dayHref: (d: string) => string; monthHref: (m: string) => string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const key = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const byDay = new Map<string, PostRow[]>();
  for (const p of posts) {
    const k = spDay(p.scheduledAt);
    if (k.startsWith(month)) byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const chip = (p: PostRow) => (
    <span key={p.id} className={cn("flex min-w-0 items-center gap-1 truncate rounded border px-1 py-0.5 text-[11px] leading-tight", STATUS_TONE[p.status])} title={`${spTime(p.scheduledAt)} · ${POST_FORMAT_SHORT[p.format]} · ${p.profileName} · ${POST_STATUS_LABEL[p.status]}`}>
      <PlatformMark platform={p.platform} className="size-3 shrink-0 text-[7px]" />
      <span className="tabular-nums">{spTime(p.scheduledAt)}</span>
      <span className="truncate">{POST_FORMAT_SHORT[p.format]}</span>
    </span>
  );
  return (
    <section aria-labelledby="planner-title" className="grid gap-3 rounded-xl border bg-surface p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="planner-title" className="text-base font-semibold first-letter:uppercase">{monthTitle(month)}</h2>
        <div className="flex gap-1">
          <Link href={monthHref(prev)} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted" aria-label={`Mês anterior: ${monthTitle(prev)}`}>‹</Link>
          <Link href={monthHref(today.slice(0, 7))} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted">Hoje</Link>
          <Link href={monthHref(next)} className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted" aria-label={`Próximo mês: ${monthTitle(next)}`}>›</Link>
        </div>
      </div>
      {/* Computador: grade do mês. */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
        <ol className="mt-1 grid grid-cols-7 gap-1" aria-label={`Dias de ${monthTitle(month)}`}>
          {Array.from({ length: lead }, (_, i) => <li key={`v${i}`} aria-hidden="true" />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const d = key(i + 1);
            const list = byDay.get(d) ?? [];
            return (
              <li key={d}>
                <Link href={dayHref(d)} aria-current={selectedDay === d ? "date" : undefined} aria-label={`${i + 1} de ${MONTHS[m - 1]}: ${list.length ? `${list.length} ${list.length === 1 ? "publicação" : "publicações"}` : "nada programado"}`}
                  className={cn("grid h-24 content-start gap-0.5 overflow-hidden rounded-md border p-1 text-left hover:border-primary/50", selectedDay === d ? "border-primary ring-1 ring-primary" : "", d === today && "bg-accent/40", d < today && "opacity-80")}>
                  <span className={cn("text-xs tabular-nums", d === today ? "font-semibold text-primary" : "text-muted-foreground")}>{i + 1}</span>
                  {list.slice(0, 3).map(chip)}
                  {list.length > 3 && <span className="text-[11px] text-muted-foreground">+{list.length - 3}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Celular: só os dias com publicação. */}
      <ul className="grid gap-1.5 md:hidden" aria-label={`Dias com publicação em ${monthTitle(month)}`}>
        {[...byDay.keys()].sort().map((d) => (
          <li key={d}>
            <Link href={dayHref(d)} aria-current={selectedDay === d ? "date" : undefined} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2", selectedDay === d && "border-primary")}>
              <span className="grid w-10 shrink-0 text-center">
                <span className="text-lg leading-none font-semibold tabular-nums">{Number(d.slice(8))}</span>
                <span className="text-[11px] text-muted-foreground">{WEEK[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7]}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">{byDay.get(d)!.map(chip)}</span>
            </Link>
          </li>
        ))}
        {byDay.size === 0 && <li className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Nada programado neste mês.</li>}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
        <span className="inline-flex items-center gap-1"><Clock className="size-3 text-info" aria-hidden="true" /> Agendado</span>
        <span className="inline-flex items-center gap-1"><CircleCheck className="size-3 text-success" aria-hidden="true" /> Publicado</span>
        <span className="inline-flex items-center gap-1"><CircleAlert className="size-3 text-danger" aria-hidden="true" /> Não publicou</span>
      </p>
    </section>
  );
}
