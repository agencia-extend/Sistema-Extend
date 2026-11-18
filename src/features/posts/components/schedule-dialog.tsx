"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { IMAGE_TYPES, MAX_FILE_BYTES, MAX_IMAGES, POST_FORMATS, POST_FORMAT_LABEL, VIDEO_TYPES, instagramCaptionProblem, type PostFormat } from "@/domain/posts";
import { schedulePost } from "@/features/posts/actions";
import type { PublishTarget } from "@/features/posts/queries";
import { schedulePostSchema } from "@/features/posts/schemas";
import { createClient } from "@/lib/supabase/client";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

export type Prefill = { taskId: string; title: string; format: PostFormat; caption: string; date: string | null };

const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
const tomorrow = () => new Date(Date.now() + 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);

/** Programar a publicação no Facebook e/ou Instagram do cliente (RF-CON-03). */
export function ScheduleDialog({ clientId, targets, prefill, trigger, defaultOpen = false }: { clientId: string; targets: PublishTarget[]; prefill?: Prefill | null; trigger: ReactNode; defaultOpen?: boolean }) {
  const ready = targets.filter((t) => t.missing.length === 0);
  const init = () => ({
    profiles: ready.map((t) => t.profileId),
    format: prefill?.format ?? ("feed" as PostFormat),
    caption: prefill?.caption ?? "",
    date: prefill?.date ?? tomorrow(),
    time: "09:00",
    driveUrl: "",
  });
  const [open, setOpen] = useState(defaultOpen);
  const [v, setV] = useState(init);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const isVideoFormat = v.format === "reels" || v.format === "video";
  const accept = v.format === "feed" ? IMAGE_TYPES.join(",") : isVideoFormat ? VIDEO_TYPES.join(",") : [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
  const toInstagram = targets.some((t) => t.platform === "instagram" && v.profiles.includes(t.profileId));

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (bad) return setErrors((e) => ({ ...e, media: `${bad.name}: o limite é 50 MB. Para vídeo maior, use o link do Drive.` }));
    const wrong = picked.find((f) => ![...IMAGE_TYPES, ...VIDEO_TYPES].includes(f.type));
    if (wrong) return setErrors((e) => ({ ...e, media: `${wrong.name}: use JPG, PNG, MP4 ou MOV.` }));
    setErrors((e) => ({ ...e, media: "" }));
    setFiles((cur) => (v.format === "feed" ? [...cur, ...picked].slice(0, MAX_IMAGES) : picked.slice(0, 1)));
  };

  const submit = () => {
    setAlert(null);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const video = files.find((f) => f.type.startsWith("video/"));
    const draft = {
      clientId, profileIds: v.profiles, format: v.format, caption: v.format === "stories" ? "" : v.caption,
      images: images.map((f) => f.name), videoPath: video ? video.name : null, videoDriveUrl: video ? "" : v.driveUrl, taskId: prefill?.taskId ?? null, date: v.date, time: v.time,
    };
    const parsed = schedulePostSchema.safeParse(draft);
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[String(i.path[0] ?? "form")] ??= i.message;
    const igProblem = toInstagram ? instagramCaptionProblem(draft.caption) : null;
    if (igProblem) e.caption = igProblem;
    if (Object.keys(e).length) {
      setErrors(e);
      return setAlert("Revise os campos destacados.");
    }
    setErrors({});
    run(async () => {
      // Os arquivos vão do navegador direto para o armazenamento; se o agendamento falhar, saem de lá.
      const supabase = createClient();
      const uploaded: string[] = [];
      const pathOf = new Map<File, string>();
      for (const f of files) {
        const path = `clientes/${clientId}/publicacoes/${crypto.randomUUID()}-${safe(f.name)}`;
        const up = await supabase.storage.from("publicacoes").upload(path, f, { contentType: f.type });
        if (up.error) {
          if (uploaded.length) await supabase.storage.from("publicacoes").remove(uploaded);
          return void setAlert(`Não foi possível enviar ${f.name}. Confira a conexão e tente de novo.`);
        }
        uploaded.push(path);
        pathOf.set(f, path);
      }
      const res = await schedulePost({ ...draft, images: images.map((f) => pathOf.get(f)!), videoPath: video ? pathOf.get(video)! : null });
      if (!res.ok) {
        if (uploaded.length) await supabase.storage.from("publicacoes").remove(uploaded);
        return void setAlert(res.message);
      }
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(init()); setFiles([]); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Programar publicação</DialogTitle>
          <DialogDescription>{prefill ? `Do cronograma: ${prefill.title}.` : "Sai sozinha no horário marcado. Você recebe um aviso quando publicar ou se der erro."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <FormAlert>{alert}</FormAlert>

          <fieldset className="grid gap-2" aria-describedby={errors.profileIds ? "pp-err" : undefined}>
            <legend className="mb-1 text-sm font-medium">Onde publicar</legend>
            {targets.map((t) => {
              const blocked = t.missing.length > 0;
              const id = `pp-${t.profileId}`;
              return (
                <div key={t.profileId} className={cn("flex items-start gap-2 rounded-lg border p-2.5", blocked && "bg-muted/40")}>
                  <Checkbox id={id} disabled={blocked} checked={v.profiles.includes(t.profileId)}
                    onCheckedChange={(c) => setV((s) => ({ ...s, profiles: c ? [...s.profiles, t.profileId] : s.profiles.filter((x) => x !== t.profileId) }))} />
                  <label htmlFor={id} className="grid gap-0.5 text-sm">
                    <span className="font-medium">{t.platform === "instagram" ? "Instagram" : "Facebook"} · {t.label}</span>
                    {blocked && <span className="text-xs text-warning">Ainda não dá para publicar aqui: falta {t.missing.join(", ")} na conexão da Meta.</span>}
                  </label>
                </div>
              );
            })}
            {errors.profileIds && <p id="pp-err" className="text-xs text-danger">{errors.profileIds}</p>}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Formato</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POST_FORMATS.map((f) => (
                <label key={f} className="relative">
                  <input type="radio" name="formato" value={f} checked={v.format === f} className="peer sr-only"
                    onChange={() => { setV((s) => ({ ...s, format: f })); setFiles([]); }} />
                  <span className="flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {POST_FORMAT_LABEL[f].replace(" (foto ou carrossel)", "")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormField label={v.format === "feed" ? "Imagens (1 a 10; mais de uma vira carrossel)" : isVideoFormat ? "Vídeo (MP4 ou MOV, até 50 MB)" : "Imagem ou vídeo"} error={errors.media}>
            <Input type="file" accept={accept} multiple={v.format === "feed"} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </FormField>
          {files.length > 0 && (
            <ul className="grid gap-1.5" aria-label="Arquivos escolhidos">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                  <span className="truncate">{i + 1}. {f.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X /></Button>
                </li>
              ))}
            </ul>
          )}
          {v.format !== "feed" && !files.some((f) => f.type.startsWith("video/")) && (
            <FormField label="Ou link do vídeo no Google Drive" optional error={errors.videoDriveUrl} hint="O arquivo precisa estar com acesso para qualquer pessoa com o link.">
              <Input inputMode="url" autoComplete="off" placeholder="https://drive.google.com/file/d/…" value={v.driveUrl} onChange={(e) => setV((s) => ({ ...s, driveUrl: e.target.value }))} />
            </FormField>
          )}

          {v.format === "stories" ? (
            <p className="text-sm text-muted-foreground">Stories não levam legenda.</p>
          ) : (
            <FormField label="Legenda" optional error={errors.caption} hint={`${v.caption.length} de ${toInstagram ? "2.200" : "5.000"} caracteres${toInstagram ? "; até 30 hashtags no Instagram" : ""}.`}>
              <Textarea rows={5} maxLength={5000} value={v.caption} onChange={(e) => setV((s) => ({ ...s, caption: e.target.value }))} />
            </FormField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data" required error={errors.date}>
              <Input type="date" value={v.date} onChange={(e) => setV((s) => ({ ...s, date: e.target.value }))} />
            </FormField>
            <FormField label="Hora (Brasília)" required>
              <Input type="time" value={v.time} onChange={(e) => setV((s) => ({ ...s, time: e.target.value }))} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || ready.length === 0}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : "Programar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
