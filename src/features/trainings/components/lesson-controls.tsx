"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Download, LoaderCircle, Paperclip, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { handleResult } from "@/lib/action-feedback";
import { toast } from "sonner";
import {
  attachLessonFile,
  deleteLesson,
  deleteTraining,
  lessonFileUrl,
  moveLesson,
  removeLessonFile,
  setLessonDone,
  unassignTraining,
} from "@/features/trainings/actions";

/** Marcar a aula como concluída (ou desfazer). Ao concluir, segue para a próxima. */
export function DoneButton({ lessonId, trainingId, done, nextHref }: { lessonId: string; trainingId: string; done: boolean; nextHref: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const res = await setLessonDone({ lessonId, trainingId, done: !done });
      if (!handleResult(res)) return;
      if (!done && nextHref) router.push(nextHref, { scroll: false });
      else router.refresh();
    });
  return done ? (
    <Button variant="outline" onClick={run} disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />} Marcar como não concluída
    </Button>
  ) : (
    <Button onClick={run} disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />} {nextHref ? "Concluir e ir para a próxima" : "Concluir aula"}
    </Button>
  );
}

/** Baixar o arquivo da aula (link assinado de 10 minutos). */
export function FileButton({ path, name }: { path: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="max-w-full justify-start"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await lessonFileUrl({ path });
          if (!res.ok) return void handleResult(res);
          window.open(res.data.url, "_blank", "noopener");
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      <span className="truncate">{name}</span>
    </Button>
  );
}

const MAX = 25 * 1024 * 1024;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-120);

/** Anexar, trocar ou remover o PDF/slides da aula. O envio vai direto para o Storage (a RLS confere). */
export function LessonFileAdmin({ lessonId, trainingId, hasFile }: { lessonId: string; trainingId: string; hasFile: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > MAX) return void toast.error("Arquivo maior que 25 MB. Coloque no Drive e use o link do vídeo ou do arquivo no texto da aula.");
    if (/^video\//.test(file.type)) return void toast.error("Vídeos ficam no YouTube, Loom ou Drive. Cole o link em “Editar aula”.");
    setBusy(true);
    try {
      const path = `${trainingId}/${crypto.randomUUID()}-${safe(file.name)}`;
      const up = await createClient().storage.from("treinamentos").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) return void toast.error("Não foi possível enviar o arquivo. Confira a conexão e tente de novo.");
      if (handleResult(await attachLessonFile({ lessonId, trainingId, path, name: file.name.slice(0, 200) }))) router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept=".pdf,.ppt,.pptx,.key,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Paperclip aria-hidden="true" />} {hasFile ? "Trocar arquivo" : "Anexar PDF ou slides"}
      </Button>
      {hasFile && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="sm"><X aria-hidden="true" /> Remover arquivo</Button>}
          title="Remover o arquivo da aula?"
          description="O arquivo é apagado. A aula continua."
          confirmLabel="Remover arquivo"
          onConfirm={async () => {
            const ok = handleResult(await removeLessonFile({ id: lessonId, trainingId }));
            if (ok) router.refresh();
            return ok;
          }}
        />
      )}
    </div>
  );
}

/** Subir/descer e excluir a aula. */
export function LessonAdmin({ lessonId, trainingId, title, first, last }: { lessonId: string; trainingId: string; title: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const move = (dir: "up" | "down") =>
    startTransition(async () => {
      if (handleResult(await moveLesson({ id: lessonId, trainingId, dir }))) router.refresh();
    });
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" aria-label={`Subir a aula ${title}`} disabled={pending || first} onClick={() => move("up")}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" aria-label={`Descer a aula ${title}`} disabled={pending || last} onClick={() => move("down")}><ArrowDown /></Button>
      <ConfirmDialog
        trigger={<Button variant="ghost" size="icon" aria-label={`Excluir a aula ${title}`}><Trash2 /></Button>}
        title="Excluir esta aula?"
        description={`“${title}” e o arquivo dela são apagados. Quem já concluiu perde a marcação desta aula.`}
        confirmLabel="Excluir aula"
        onConfirm={async () => {
          const ok = handleResult(await deleteLesson({ id: lessonId, trainingId }));
          if (ok) router.replace(`/treinamentos/${trainingId}`, { scroll: false });
          return ok;
        }}
      />
    </div>
  );
}

export function DeleteTrainingButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost"><Trash2 aria-hidden="true" /> Excluir</Button>}
      title="Excluir este treinamento?"
      description={`“${title}”, as aulas, os arquivos e o progresso da equipe são apagados. Não dá para desfazer.`}
      confirmLabel="Excluir treinamento"
      onConfirm={async () => {
        const ok = handleResult(await deleteTraining({ id }));
        if (ok) router.replace("/treinamentos");
        return ok;
      }}
    />
  );
}

export function UnassignButton({ id, trainingId, name }: { id: string; trainingId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Tirar ${name} da lista`}><X /></Button>}
      title={`Tirar ${name} da lista?`}
      description="A pessoa deixa de ter este treinamento como pendência. O que ela já concluiu continua salvo."
      confirmLabel="Tirar da lista"
      onConfirm={async () => {
        const ok = handleResult(await unassignTraining({ id, trainingId }));
        if (ok) router.refresh();
        return ok;
      }}
    />
  );
}
