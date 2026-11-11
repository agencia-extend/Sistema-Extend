"use client";

import { useRef, useTransition } from "react";
import { LoaderCircle, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileUrl, uploadClientFile } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

/** Abre um anexo privado por URL assinada (5 minutos). */
export function FileLink({ path, name }: { path: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fileUrl({ path });
          if (!res.ok) return void toast.error(res.message);
          window.open((res.data as { url: string }).url, "_blank", "noopener");
        })
      }
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Paperclip className="size-3.5" aria-hidden="true" />}
      <span className="truncate">{name}</span>
    </button>
  );
}

export function UploadButton({
  clientId,
  category,
  meetingId,
  label = "Enviar arquivo",
  variant = "ghost",
}: {
  clientId: string;
  category: "geral" | "fechamento" | "reuniao" | "identidade" | "contrato" | "referencia";
  meetingId?: string;
  label?: string;
  variant?: "ghost" | "outline" | "default";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          startTransition(async () => {
            for (const f of files) {
              const fd = new FormData();
              fd.set("clientId", clientId);
              fd.set("category", category);
              if (meetingId) fd.set("meetingId", meetingId);
              fd.set("file", f);
              handleResult(await uploadClientFile(fd));
            }
          });
        }}
      />
      <Button type="button" variant={variant} size="sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        {pending ? "Enviando…" : label}
      </Button>
    </>
  );
}
