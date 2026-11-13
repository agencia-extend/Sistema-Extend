"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { videoEmbed } from "@/domain/trainings";
import { saveLesson } from "@/features/trainings/actions";
import type { LessonInput } from "@/features/trainings/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Criar ou editar uma aula: texto, link do vídeo e duração. O arquivo é anexado na própria aula. */
export function LessonDialog({ trainingId, lesson, trigger }: { trainingId: string; lesson?: LessonInput; trigger: ReactNode }) {
  const router = useRouter();
  const blank: LessonInput = { trainingId, title: "", body: "", videoUrl: "", durationMin: null };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<LessonInput>(lesson ?? blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const video = v.videoUrl?.trim() ? videoEmbed(v.videoUrl.trim()) : null;

  const save = () =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const res = await saveLesson(v);
      if (!res.ok) {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      handleResult(res);
      setOpen(false);
      if (!lesson?.id && res.data) router.push(`/treinamentos/${trainingId}?aula=${res.data.id}`, { scroll: false });
      else router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(lesson ?? blank); setError(null); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lesson?.id ? "Editar aula" : "Nova aula"}</DialogTitle>
          <DialogDescription>Escreva o passo a passo e, se tiver, cole o link do vídeo. PDF ou slides você anexa depois, na própria aula.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome da aula" required error={errors.title?.[0]}>
            <Input autoComplete="off" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <FormField
              label="Link do vídeo"
              optional
              error={errors.videoUrl?.[0]}
              hint={v.videoUrl?.trim() ? (video ? `Vídeo do ${video.provider}: aparece dentro da aula.` : "Não é YouTube, Loom, Drive ou Vimeo: vira um link para abrir.") : "YouTube, Loom, Google Drive ou Vimeo."}
            >
              <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://…" value={v.videoUrl ?? ""} onChange={(e) => setV({ ...v, videoUrl: e.target.value })} />
            </FormField>
            <FormField label="Duração (min)" optional error={errors.durationMin?.[0]}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={v.durationMin ?? ""}
                onChange={(e) => setV({ ...v, durationMin: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </FormField>
          </div>
          <FormField label="Conteúdo" optional error={errors.body?.[0]} hint="Linhas em branco separam os parágrafos. Links começando com https:// ficam clicáveis.">
            <Textarea rows={10} value={v.body ?? ""} onChange={(e) => setV({ ...v, body: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {lesson?.id ? "Salvar aula" : "Adicionar aula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
