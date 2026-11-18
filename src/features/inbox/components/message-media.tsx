import { Download, FileText, ImageOff } from "lucide-react";
import { mediaView } from "@/domain/whatsapp/media";
import type { ChatMessage } from "@/features/inbox/queries";
import { cn } from "@/lib/utils";

/** Foto, áudio, vídeo ou documento de uma mensagem. Sem o arquivo guardado (histórico antigo), diz onde ver. */
export function MessageMedia({ message: m }: { message: ChatMessage }) {
  const view = mediaView(m.mediaMime);
  if (!m.hasFile) {
    return (
      <p className="flex items-center gap-1.5 text-xs opacity-80">
        <ImageOff className="size-3.5 shrink-0" aria-hidden="true" />
        {view === "image" ? "Foto" : view === "audio" ? "Áudio" : view === "video" ? "Vídeo" : "Arquivo"} antigo: abra no WhatsApp para ver.
      </p>
    );
  }
  const src = `/api/whatsapp/midia/${m.id}`;
  if (view === "image") {
    return (
      <a href={src} target="_blank" rel="noopener" className="mb-1 block overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Abrir a foto em tamanho real">
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pelo próprio sistema */}
        <img src={src} alt={m.body ? `Foto: ${m.body.slice(0, 80)}` : "Foto enviada na conversa"} width={260} height={260} loading="lazy" className="h-auto max-h-72 w-full max-w-64 bg-muted object-cover" />
      </a>
    );
  }
  if (view === "audio") return <audio controls preload="none" src={src} className="mb-1 h-10 w-64 max-w-full" aria-label="Áudio da conversa" />;
  if (view === "video") return <video controls preload="metadata" src={src} width={256} className="mb-1 max-h-72 w-64 max-w-full rounded-lg bg-black" aria-label="Vídeo da conversa" />;
  return (
    <a href={src} download={m.mediaName ?? undefined}
      className={cn("mb-1 flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", m.fromMe ? "border-primary-foreground/30" : "bg-muted/40")}>
      <FileText className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{m.mediaName || "Documento"}</span>
      <Download className="size-4 shrink-0 opacity-70" aria-hidden="true" />
    </a>
  );
}
