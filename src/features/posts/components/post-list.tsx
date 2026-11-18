"use client";

import { useState, useTransition } from "react";
import { CalendarClock, ExternalLink, ImageIcon, LoaderCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormAlert, FormField } from "@/components/app/form-field";
import { POST_FORMAT_SHORT, POST_STATUS_LABEL, isoToSp, type PostStatus } from "@/domain/posts";
import { formatDateTime } from "@/domain/shared/dates";
import { cancelPost, reschedulePost } from "@/features/posts/actions";
import type { PostRow } from "@/features/posts/queries";
import { reschedulePostSchema } from "@/features/posts/schemas";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const TONE: Record<PostStatus, string> = {
  agendado: "bg-primary/10 text-primary",
  publicando: "bg-warning-soft text-warning",
  publicado: "bg-success-soft text-success",
  erro: "bg-danger-soft text-danger",
  cancelado: "bg-muted text-muted-foreground",
};

/** Publicações programadas (do cliente ou de todos): situação, motivo do erro e ações. */
export function PostList({ rows, showClient = false, canManage }: { rows: PostRow[]; showClient?: boolean; canManage: boolean }) {
  return (
    <ul aria-label="Publicações programadas" className="grid gap-2">
      {rows.map((p) => (
        <li key={p.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
          {p.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do armazenamento
            <img src={p.thumbUrl} alt="" width={56} height={56} className="size-14 rounded-lg border object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-lg border bg-muted text-muted-foreground">
              {p.hasVideo ? <Video className="size-5" aria-hidden="true" /> : <ImageIcon className="size-5" aria-hidden="true" />}
            </span>
          )}
          <div className="grid min-w-0 content-start gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE[p.status])}>{POST_STATUS_LABEL[p.status]}</span>
              <span className="text-sm font-medium tabular" suppressHydrationWarning>{formatDateTime(p.scheduledAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {showClient && p.clientName ? `${p.clientName} · ` : ""}{p.platform === "instagram" ? "Instagram" : "Facebook"} {p.profileName} · {POST_FORMAT_SHORT[p.format]}
              {p.imageCount > 1 ? ` (${p.imageCount} imagens)` : ""}{p.authorName ? ` · por ${p.authorName}` : ""}
            </p>
            {p.caption && <p className="line-clamp-2 text-sm break-words">{p.caption}</p>}
            {p.error && p.status === "erro" && <p className="text-xs break-words text-danger">{p.error}</p>}
          </div>
          <div className="col-span-full flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
            {p.permalink && (
              <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Ver publicação <ExternalLink className="size-3.5" aria-hidden="true" /><span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
            {canManage && ["agendado", "erro", "cancelado"].includes(p.status) && <Reschedule row={p} />}
            {canManage && ["agendado", "erro"].includes(p.status) && (
              <ConfirmDialog
                trigger={<Button size="sm" variant="ghost" className="text-danger">Cancelar</Button>}
                title="Cancelar esta publicação?"
                description={`${p.profileName}, ${formatDateTime(p.scheduledAt)}. Ela não sai; dá para reagendar depois.`}
                confirmLabel="Cancelar publicação"
                onConfirm={async () => handleResult(await cancelPost({ id: p.id }))}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Reschedule({ row }: { row: PostRow }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => isoToSp(row.scheduledAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const save = () => {
    const parsed = reschedulePostSchema.safeParse({ id: row.id, ...v });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira a data e a hora.");
    setError(null);
    run(async () => {
      const res = await reschedulePost({ id: row.id, ...v });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(isoToSp(new Date(Math.max(new Date(row.scheduledAt).getTime(), Date.now() + 3_600_000)).toISOString())); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Reagendar a publicação de ${formatDateTime(row.scheduledAt)} em ${row.profileName}`}><CalendarClock aria-hidden="true" /> Reagendar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar</DialogTitle>
          <DialogDescription>{row.profileName} · {POST_FORMAT_SHORT[row.format]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Data" required><Input type="date" value={v.date} onChange={(e) => setV((s) => ({ ...s, date: e.target.value }))} /></FormField>
          <FormField label="Hora (Brasília)" required><Input type="time" value={v.time} onChange={(e) => setV((s) => ({ ...s, time: e.target.value }))} /></FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Reagendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
