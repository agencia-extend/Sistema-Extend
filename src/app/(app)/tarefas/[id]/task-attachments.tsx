"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, FileText, LoaderCircle, Link2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLink, deleteAttachment, taskFileUrl, uploadTaskFile } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { Section } from "@/features/clients/components/section";

type Att = { id: string; kind: string; name: string; storage_path: string | null; url: string | null; mime_type: string | null; uploaded_by: string | null };

const isDrive = (u: string | null) => Boolean(u && /drive\.google\.com|docs\.google\.com/.test(u));

/** Anexos leves (até 10 MB) e links (Drive, Canva, referências). Vídeos vão por link do Drive. */
export function TaskAttachments({ taskId, items, userId, canManage }: { taskId: string; items: Att[]; userId: string; canManage: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState({ name: "", url: "" });
  const [showLink, setShowLink] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = (a: Att) =>
    startTransition(async () => {
      if (a.kind === "link" && a.url) return void window.open(a.url, "_blank", "noopener");
      const res = await taskFileUrl({ path: a.storage_path! });
      if (!res.ok) return void toast.error(res.message);
      window.open((res.data as { url: string }).url, "_blank", "noopener");
    });

  return (
    <Section
      title="Anexos"
      action={
        <div className="flex gap-1.5">
          <input
            ref={input}
            type="file"
            hidden
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              startTransition(async () => {
                for (const f of files) {
                  const fd = new FormData();
                  fd.set("taskId", taskId);
                  fd.set("file", f);
                  handleResult(await uploadTaskFile(fd));
                }
              });
            }}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />} Arquivo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowLink((v) => !v)}><Link2 aria-hidden="true" /> Anexar link</Button>
        </div>
      }
    >
      {showLink && (
        <form
          className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_1.5fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              if (handleResult(await addLink({ taskId, name: link.name || link.url, url: link.url }))) {
                setLink({ name: "", url: "" });
                setShowLink(false);
              }
            });
          }}
        >
          <Input placeholder="Nome (ex.: Vídeo v1)…" aria-label="Nome do link" value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} autoComplete="off" />
          <Input type="url" placeholder="https://drive.google.com/…" aria-label="Endereço do link" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} autoComplete="off" />
          <Button type="submit" disabled={pending || !link.url}>Anexar</Button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem anexos. Vídeos e arquivos grandes: envie para o Drive e anexe o link.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
                {a.kind === "link" ? (isDrive(a.url) ? <span className="text-[10px] font-bold">Drive</span> : <ExternalLink className="size-4" />) : <FileText className="size-4" />}
              </span>
              <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">{a.name}</button>
              {(canManage || a.uploaded_by === userId) && (
                <Button variant="ghost" size="icon" className="size-9" aria-label={`Remover ${a.name}`} disabled={pending}
                  onClick={() => startTransition(async () => void handleResult(await deleteAttachment({ id: a.id, taskId })))}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
