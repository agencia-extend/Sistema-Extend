import Link from "next/link";
import { Megaphone } from "lucide-react";
import { contactLabel, formatPhone, listTime, waitingFor, type InboxTab } from "@/domain/inbox";
import type { ConversationRow, Tag } from "@/features/inbox/queries";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./contact-avatar";
import { TagChip } from "./tag-chip";

/** Lista de conversas como no WhatsApp: foto, nome, hora, prévia, não lidas, espera e etiquetas. */
export function ConversationList({ rows, tags, tab, selectedId, href, now }: {
  rows: ConversationRow[]; tags: Tag[]; tab: InboxTab; selectedId: string | null; href: (id: string) => string; now: Date;
}) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  return (
    <ul aria-label="Conversas" className="divide-y">
      {rows.map((c) => {
        const name = contactLabel(c);
        const active = c.id === selectedId;
        const rowTags = c.tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t));
        const waiting = c.waitingReply && c.status === "aberta" && !c.deleted && c.lastInboundAt;
        return (
          <li key={c.id}>
            <Link href={href(c.id)} scroll={false} aria-current={active ? "true" : undefined}
              className={cn("flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", active && "bg-accent/70 hover:bg-accent/70")}>
              <ContactAvatar name={name} url={c.avatarUrl} group={c.kind === "grupo"} className="mt-0.5 size-11" />
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{name}</span>
                  <span className={cn("shrink-0 text-xs tabular-nums", c.unread > 0 ? "font-medium text-primary" : "text-muted-foreground")} suppressHydrationWarning>
                    {c.lastMessageAt ? listTime(c.lastMessageAt, now) : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.preview || "—"}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums" aria-label={`${c.unread} não lidas`}>
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {waiting && (
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", tab === "radar" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")} suppressHydrationWarning>
                      Espera há {waitingFor(c.lastInboundAt!, now)}
                    </span>
                  )}
                  {c.fromAd && <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 font-medium text-info"><Megaphone className="size-3" aria-hidden="true" />Anúncio</span>}
                  {rowTags.slice(0, 3).map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}
                  <span className="min-w-0 truncate">
                    {[c.kind === "contato" && c.phone && name !== formatPhone(c.phone) ? formatPhone(c.phone) : null, c.assigneeName ? `Com ${c.assigneeName}` : c.kind === "contato" ? "Sem responsável" : null]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
