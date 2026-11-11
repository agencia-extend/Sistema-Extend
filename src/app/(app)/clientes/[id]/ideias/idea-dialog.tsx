"use client";

import { useState, useTransition } from "react";
import { ArrowRightCircle, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteIdea, ideaToTask, saveIdea } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

type Idea = { id?: string; title: string; body: string; link: string; tags: string[] };

export function IdeaDialog({ clientId, idea }: { clientId: string; idea?: Idea }) {
  const blank: Idea = { title: "", body: "", link: "", tags: [] };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Idea>(idea ?? blank);
  const [tags, setTags] = useState((idea?.tags ?? []).join(", "));
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        {idea ? <Button variant="ghost" size="sm"><Pencil aria-hidden="true" /> Editar</Button> : <Button><Plus aria-hidden="true" /> Nova ideia</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{idea ? "Editar ideia" : "Nova ideia"}</DialogTitle>
          <DialogDescription>Texto, link de referência e etiquetas para achar depois.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Título" required><Input autoComplete="off" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></FormField>
          <FormField label="Descrição" optional><Textarea rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></FormField>
          <FormField label="Link de referência" optional><Input type="url" autoComplete="off" placeholder="https://…" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} /></FormField>
          <FormField label="Etiquetas" optional hint="Separe por vírgula. Ex.: reels, depoimento">
            <Input autoComplete="off" value={tags} onChange={(e) => setTags(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || v.title.trim().length < 2}
            onClick={() =>
              startTransition(async () => {
                const res = await saveIdea({ ...v, clientId, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) });
                if (handleResult(res)) {
                  setOpen(false);
                  if (!idea) {
                    setV(blank);
                    setTags("");
                  }
                }
              })
            }
          >
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar ideia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IdeaActions({ clientId, idea, canEdit, canConvert }: { clientId: string; idea: Idea & { id: string }; canEdit: boolean; canConvert: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-1">
      {canConvert && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => void handleResult(await ideaToTask({ id: idea.id })))}>
          <ArrowRightCircle aria-hidden="true" /> Virar demanda
        </Button>
      )}
      {canEdit && <IdeaDialog clientId={clientId} idea={idea} />}
      {canEdit && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="icon" className="size-9" aria-label={`Excluir ${idea.title}`}><Trash2 /></Button>}
          title="Excluir ideia?"
          description={`“${idea.title}” será apagada.`}
          confirmLabel="Excluir ideia"
          onConfirm={async () => handleResult(await deleteIdea({ id: idea.id, clientId }))}
        />
      )}
    </div>
  );
}
