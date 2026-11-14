"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { schedulePost, uploadCover } from "@/features/schedule/actions";
import { handleResult } from "@/lib/action-feedback";

type Post = { taskId: string; title: string; postOn: string | null; caption: string | null; postUrl: string | null; coverUrl: string | null };

/** Programar o post: data, legenda, capa para o grid e o link depois de publicado. */
export function PostDialog({ clientId, post, trigger }: { clientId: string; post: Post; trigger: ReactNode }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [postOn, setPostOn] = useState(post.postOn ?? "");
  const [caption, setCaption] = useState(post.caption ?? "");
  const [postUrl, setPostUrl] = useState(post.postUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();

  const save = () => {
    setError(null);
    if (postUrl.trim() && !/^https?:\/\//.test(postUrl.trim())) return void setUrlError("O link precisa começar com https://");
    setUrlError(null);
    start(async () => {
      const res = await schedulePost({ clientId, taskId: post.taskId, postOn, caption, postUrl: postUrl.trim() });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  const sendCover = (file: File) =>
    startUpload(async () => {
      const fd = new FormData();
      fd.set("clientId", clientId);
      fd.set("taskId", post.taskId);
      fd.set("file", file);
      if (handleResult(await uploadCover(fd))) router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setPostOn(post.postOn ?? ""); setCaption(post.caption ?? ""); setPostUrl(post.postUrl ?? ""); setError(null); setUrlError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programar post</DialogTitle>
          <DialogDescription className="break-words">{post.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Data do post" optional hint="Em branco: fica no cronograma como “Sem data”.">
            <Input type="date" value={postOn} onChange={(e) => setPostOn(e.target.value)} />
          </FormField>
          <FormField label="Legenda" optional>
            <Textarea rows={5} maxLength={5000} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </FormField>
          <FormField label="Capa para o grid" optional hint="JPG, PNG ou WebP até 5 MB. Aparece na prévia do feed.">
            <div className="flex flex-wrap items-center gap-3">
              {post.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do Storage
                <img src={post.coverUrl} alt={`Capa atual de ${post.title}`} width={56} height={70} className="h-[70px] w-14 rounded-md border object-cover" />
              )}
              <input ref={fileRef} type="file" hidden aria-label="Imagem da capa" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) sendCover(f); }} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
                {uploading ? "Enviando…" : post.coverUrl ? "Trocar capa" : "Enviar capa"}
              </Button>
            </div>
          </FormField>
          <FormField label="Link do post publicado" optional error={urlError ?? undefined} hint="Preencha depois de publicar: o post passa para “Postado”.">
            <Input type="url" inputMode="url" spellCheck={false} autoComplete="off" placeholder="https://www.instagram.com/p/…" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
