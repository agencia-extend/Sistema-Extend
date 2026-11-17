"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, CheckCheck, LoaderCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { alertKindLabel, resolvedBy } from "@/domain/ads/alerts";
import { formatDateTime, formatRelative } from "@/domain/shared/dates";
import { ackAlert } from "@/features/alerts/actions";
import type { AlertRow } from "@/features/alerts/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { ResolveDialog } from "./resolve-dialog";

function AckButton({ id, title }: { id: string; title: string }) {
  const [pending, run] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} aria-label={`Reconhecer: ${title}`} onClick={() => run(async () => void handleResult(await ackAlert({ id })))}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />} Reconhecer
    </Button>
  );
}

/** Lista de alertas: o que é, de quem, desde quando, quem reconheceu ou resolveu e como. */
export function AlertList({ rows, showClient = true }: { rows: AlertRow[]; showClient?: boolean }) {
  return (
    <ol className="divide-y rounded-xl border bg-card" aria-label="Alertas">
      {rows.map((a) => (
        <li key={a.id} className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid min-w-0 gap-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className={cn("rounded-full px-2 py-0.5 font-medium", a.status === "aberto" ? "bg-danger-soft text-danger" : a.status === "reconhecido" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                {alertKindLabel(a.kind)}
              </span>
              {showClient && <span>{a.clientName ?? "Agência"}</span>}
              <time dateTime={a.openedAt}>desde {formatDateTime(a.openedAt)}</time>
            </p>
            <p className="text-sm font-medium break-words">{a.title}</p>
            {a.body && <p className="text-sm text-muted-foreground break-words">{a.body}</p>}
            {a.status === "aberto" && a.timesSeen > 1 && (
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>Visto {a.timesSeen} vezes, a última {formatRelative(a.lastSeenAt)}.</p>
            )}
            {a.status === "reconhecido" && (
              <p className="text-xs" suppressHydrationWarning>Reconhecido por {a.ackName || "alguém da equipe"} {a.ackAt ? formatRelative(a.ackAt) : ""}. Os avisos diários pararam.</p>
            )}
            {a.status === "resolvido" && (
              <p className="text-sm break-words">
                <span className="font-medium">{resolvedBy(a)}</span>
                {a.resolvedAt && <span className="text-muted-foreground"> em {formatDateTime(a.resolvedAt)}</span>}
                {a.resolution && <>: {a.resolution}</>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            {a.href && <Link href={a.href} className={buttonVariants({ size: "sm", variant: "ghost" })}>Abrir</Link>}
            {a.canAct && a.status === "aberto" && <AckButton id={a.id} title={a.title} />}
            {a.canAct && (
              <ResolveDialog id={a.id} title={a.title}
                trigger={<Button size="sm" aria-label={`Resolver: ${a.title}`}><CheckCheck aria-hidden="true" /> Resolver</Button>} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
