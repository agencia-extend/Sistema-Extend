"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormAlert, FormField } from "@/components/app/form-field";
import { TAG_COLORS, TAG_COLOR_LABEL, type TagColor } from "@/domain/inbox";
import { deleteQuickReply, deleteTag, saveInboxSettings, saveQuickReply, saveTag } from "@/features/inbox/actions";
import { quickReplySchema, radarSchema, tagSchema } from "@/features/inbox/schemas";
import type { QuickReply, Tag } from "@/features/inbox/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { TagChip } from "./tag-chip";

const firstErrors = (issues: { path: PropertyKey[]; message: string }[]) => {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
};

/** Minutos até a conversa sem resposta entrar no radar. */
export function RadarForm({ minutes }: { minutes: number }) {
  const [value, setValue] = useState(String(minutes));
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = radarSchema.safeParse({ minutes: Number(value) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira o tempo.");
    setError(null);
    run(async () => void handleResult(await saveInboxSettings(parsed.data)));
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-3">
      <FormField label="Entra no radar depois de (minutos)" error={error ?? undefined}>
        <Input type="number" inputMode="numeric" min={5} max={1440} name="radar" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} className="w-32" />
      </FormField>
      <Button type="submit" variant="outline" disabled={pending || value === String(minutes)}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

function TagDialog({ tag, trigger }: { tag: Tag | null; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState<TagColor>(tag?.color ?? "azul");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { id: tag?.id ?? null, name, color };
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) return setErrors(firstErrors(parsed.error.issues));
    setErrors({});
    run(async () => {
      const res = await saveTag(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setName(tag?.name ?? ""); setColor(tag?.color ?? "azul"); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tag ? `Editar ${tag.name}` : "Nova etiqueta"}</DialogTitle>
          <DialogDescription>Etiquetas organizam as conversas (ex.: Orçamento, Cliente, Suporte) e servem de filtro na lista.</DialogDescription>
        </DialogHeader>
        <form id="tag-form" onSubmit={save} noValidate className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <FormField label="Nome" required error={errors.name}>
            <Input maxLength={40} autoComplete="off" placeholder="Ex.: Orçamento…" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)}
                  className={cn("rounded-full p-0.5 ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", color === c && "ring-2 ring-primary")}>
                  <TagChip name={TAG_COLOR_LABEL[c]} color={c} className="px-3 py-1 text-xs" />
                </button>
              ))}
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="submit" form="tag-form" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {tag ? "Salvar etiqueta" : "Criar etiqueta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TagsManager({ tags }: { tags: Tag[] }) {
  return (
    <div className="grid gap-3">
      {tags.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">Nenhuma etiqueta. Crie as que a equipe usa para separar as conversas.</p>
      ) : (
        <ul aria-label="Etiquetas" className="divide-y rounded-md border">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <TagChip name={t.name} color={t.color} className="text-xs" />
              <span className="flex-1" />
              <TagDialog tag={t} trigger={<Button variant="ghost" size="icon" aria-label={`Editar a etiqueta ${t.name}`}><Pencil aria-hidden="true" /></Button>} />
              <ConfirmDialog
                trigger={<Button variant="ghost" size="icon" className="text-danger hover:text-danger" aria-label={`Excluir a etiqueta ${t.name}`}><Trash2 aria-hidden="true" /></Button>}
                title={`Excluir ${t.name}?`} description="Ela sai de todas as conversas que a usam." confirmLabel="Excluir"
                onConfirm={async () => { handleResult(await deleteTag({ id: t.id })); }}
              />
            </li>
          ))}
        </ul>
      )}
      <TagDialog tag={null} trigger={<Button variant="outline" className="w-fit"><Plus aria-hidden="true" /> Nova etiqueta</Button>} />
    </div>
  );
}

function ReplyDialog({ reply, trigger }: { reply: QuickReply | null; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? "");
  const [body, setBody] = useState(reply?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = quickReplySchema.safeParse({ id: reply?.id ?? null, shortcut, body });
    if (!parsed.success) return setErrors(firstErrors(parsed.error.issues));
    setErrors({});
    run(async () => {
      const res = await saveQuickReply(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setShortcut(reply?.shortcut ?? ""); setBody(reply?.body ?? ""); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reply ? `Editar /${reply.shortcut}` : "Nova resposta rápida"}</DialogTitle>
          <DialogDescription>Na conversa, digite / e o atalho para usar o texto. {"{nome}"} vira o primeiro nome do contato.</DialogDescription>
        </DialogHeader>
        <form id="reply-form" onSubmit={save} noValidate className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <FormField label="Atalho" required error={errors.shortcut}>
            <Input maxLength={31} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="Ex.: preco…" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
          </FormField>
          <FormField label="Texto" required error={errors.body}>
            <Textarea rows={6} maxLength={4096} placeholder="Ex.: Oi {nome}! Segue a nossa tabela de planos…" value={body} onChange={(e) => setBody(e.target.value)} />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="reply-form" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {reply ? "Salvar resposta" : "Criar resposta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickRepliesManager({ replies }: { replies: QuickReply[] }) {
  return (
    <div className="grid gap-3">
      {replies.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">Nenhuma resposta rápida. Crie os textos que a equipe manda sempre (preços, endereço, horários).</p>
      ) : (
        <ul aria-label="Respostas rápidas" className="divide-y rounded-md border">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-2 px-3 py-2">
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">/{r.shortcut}</span>
                <span className="line-clamp-2 text-sm break-words text-muted-foreground">{r.body}</span>
              </span>
              <ReplyDialog reply={r} trigger={<Button variant="ghost" size="icon" aria-label={`Editar a resposta /${r.shortcut}`}><Pencil aria-hidden="true" /></Button>} />
              <ConfirmDialog
                trigger={<Button variant="ghost" size="icon" className="text-danger hover:text-danger" aria-label={`Excluir a resposta /${r.shortcut}`}><Trash2 aria-hidden="true" /></Button>}
                title={`Excluir /${r.shortcut}?`} description="O atalho deixa de funcionar para toda a equipe." confirmLabel="Excluir"
                onConfirm={async () => { handleResult(await deleteQuickReply({ id: r.id })); }}
              />
            </li>
          ))}
        </ul>
      )}
      <ReplyDialog reply={null} trigger={<Button variant="outline" className="w-fit"><Plus aria-hidden="true" /> Nova resposta rápida</Button>} />
    </div>
  );
}
