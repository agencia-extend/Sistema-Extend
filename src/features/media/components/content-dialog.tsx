"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { CONTENT_FORMATS, DESTINATIONS, DESTINATION_LABEL, FORMAT_LABEL, type Destination } from "@/domain/media";
import { saveContent } from "@/features/media/actions";
import { contentSchema, type ContentInput } from "@/features/media/schemas";
import type { ContentRow } from "@/features/media/queries";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__ninguem";
const dayOf = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");

/**
 * Planejar/editar um conteúdo do mês: tema, formato, quem grava, quem edita, links e postagem.
 * Escolher quem edita manda o card para o quadro do setor dessa pessoa.
 */
export function ContentDialog({
  row,
  team,
  canAssign,
  trigger,
}: {
  row: ContentRow;
  team: { id: string; name: string }[];
  canAssign: boolean;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults: ContentInput = {
    taskId: row.taskId,
    title: row.title,
    format: (row.format ?? "") as ContentInput["format"],
    objective: row.objective,
    script: row.script,
    caption: row.caption,
    recorderId: row.recorderId,
    recordingOn: row.recordingOn ?? "",
    editorId: row.editorId,
    finalUrl: row.finalUrl,
    rawUrl: row.rawUrl,
    postOn: row.postOn ?? "",
    postUrl: row.postUrl,
    destination: row.destination as Destination[],
    dueOn: dayOf(row.dueAt),
  };
  const form = useForm<ContentInput>({ resolver: zodResolver(contentSchema), defaultValues: defaults });
  const { register, handleSubmit, setValue, control, formState } = form;
  const live = useWatch({ control });
  const e = formState.errors;
  const destination = (live.destination ?? []) as Destination[];
  const isVideo = row.type === "video";
  const formats = CONTENT_FORMATS.filter((f) => (row.type === "video" ? ["video_curto", "video_premium", "reels", "anuncio"].includes(f) : row.type === "design" ? ["estatico", "carrossel", "stories", "anuncio"].includes(f) : true));

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      // Só envia quem grava/edita quando a pessoa pode definir responsáveis.
      const { recorderId, editorId, ...rest } = values;
      const res = await saveContent(canAssign ? { ...rest, recorderId, editorId } : rest);
      if (!res.ok) {
        setError(res.message);
        handleResult(res, form);
        return;
      }
      handleResult(res);
      setOpen(false);
      router.refresh();
    }),
  );

  const person = (name: "recorderId" | "editorId", label: string) => (
    <Select value={live[name] ?? NONE} onValueChange={(v) => setValue(name, v === NONE ? null : v, { shouldDirty: true })} disabled={!canAssign}>
      <SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Ninguém ainda</SelectItem>
        {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { form.reset(defaults); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Conteúdo {row.index ?? ""}</DialogTitle>
            <DialogDescription>
              {row.service}. Ao escolher quem {isVideo ? "edita" : "cria"}, o card aparece no quadro do setor dessa pessoa e ela é avisada.
            </DialogDescription>
          </DialogHeader>
          <FormAlert>{error}</FormAlert>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tema" required error={e.title?.message} className="sm:col-span-2">
              <Input autoComplete="off" placeholder="Ex.: Tour pelo decorado…" {...register("title")} />
            </FormField>
            <FormField label="Formato" optional>
              <Select value={live.format || NONE} onValueChange={(v) => setValue("format", (v === NONE ? "" : v) as ContentInput["format"], { shouldDirty: true })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>A definir</SelectItem>
                  {formats.map((f) => <SelectItem key={f} value={f}>{FORMAT_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Objetivo" optional error={e.objective?.message}>
              <Input autoComplete="off" placeholder="Ex.: conexão, autoridade, venda…" {...register("objective")} />
            </FormField>
            <FormField label="Roteiro" optional error={e.script?.message} className="sm:col-span-2">
              <Textarea rows={4} placeholder="Texto do roteiro ou link do documento…" {...register("script")} />
            </FormField>
            <FormField label="Legenda" optional error={e.caption?.message} className="sm:col-span-2">
              <Textarea rows={3} placeholder="Copy do post…" {...register("caption")} />
            </FormField>
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Quem faz</legend>
            {isVideo && (
              <>
                <FormField label="Quem grava" optional>{person("recorderId", "Quem grava")}</FormField>
                <FormField label="Data da gravação" optional error={e.recordingOn?.message}><Input type="date" {...register("recordingOn")} /></FormField>
              </>
            )}
            <FormField label={isVideo ? "Quem edita" : "Quem cria a arte"} optional hint={canAssign ? undefined : "Só a coordenação define quem faz."}>
              {person("editorId", isVideo ? "Quem edita" : "Quem cria a arte")}
            </FormField>
            <FormField label="Prazo de entrega" optional error={e.dueOn?.message}><Input type="date" {...register("dueOn")} /></FormField>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Entrega</legend>
            <FormField label="Link do conteúdo final (Drive)" optional error={e.finalUrl?.message} className="sm:col-span-2">
              <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://drive.google.com/…" {...register("finalUrl")} />
            </FormField>
            {isVideo && (
              <FormField label="Link dos takes brutos" optional error={e.rawUrl?.message} className="sm:col-span-2">
                <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://drive.google.com/…" {...register("rawUrl")} />
              </FormField>
            )}
            <div className="grid gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Depois de aprovado, vai para <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {DESTINATIONS.map((d) => (
                  <div key={d} className="flex min-h-9 items-center gap-2">
                    <Checkbox id={`dest-${row.taskId}-${d}`} checked={destination.includes(d)}
                      onCheckedChange={(c) => setValue("destination", c ? [...destination, d] : destination.filter((x) => x !== d), { shouldDirty: true })} />
                    <Label htmlFor={`dest-${row.taskId}-${d}`} className="font-normal">{DESTINATION_LABEL[d]}</Label>
                  </div>
                ))}
              </div>
            </div>
            <FormField label="Data da postagem" optional error={e.postOn?.message}><Input type="date" {...register("postOn")} /></FormField>
            <FormField label="Link do post" optional error={e.postUrl?.message}>
              <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://instagram.com/p/…" {...register("postUrl")} />
            </FormField>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar conteúdo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
