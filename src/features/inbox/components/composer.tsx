"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, LoaderCircle, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkOutgoingMedia, extensionOf } from "@/domain/whatsapp/media";
import { fillQuickReply, matchQuickReplies, shortcutQuery } from "@/domain/inbox";
import type { QuickReply } from "@/features/inbox/queries";
import { cn } from "@/lib/utils";
import { markConversationRead, prepareMediaUpload, replyConversation, sendMediaMessage } from "@/features/inbox/actions";
import { replySchema } from "@/features/inbox/schemas";
import { createClient } from "@/lib/supabase/client";
import { AttachButton, AudioRecorder } from "./composer-tools";

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Caixa de resposta: Enter envia, Shift+Enter quebra a linha. Clipe anexa foto, vídeo ou documento (o texto vira a
 * legenda); o microfone grava um áudio e envia ao parar. "/" abre as respostas rápidas. Abre marcando a conversa como lida.
 */
export function Composer({ conversationId, unread, disabledReason, quickReplies = [], contactName = "" }: {
  conversationId: string; unread: number; disabledReason: string | null; quickReplies?: QuickReply[]; contactName?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  const query = shortcutQuery(text);
  const matches = query !== null && !closed ? matchQuickReplies(quickReplies, query) : [];
  const pickReply = (r: QuickReply) => {
    setText(fillQuickReply(r.body, contactName));
    setActive(0);
    ref.current?.focus();
  };

  useEffect(() => {
    if (unread > 0) void markConversationRead({ id: conversationId });
  }, [conversationId, unread]);

  /** Sobe o arquivo direto para o armazenamento e manda pelo WhatsApp. Devolve a mensagem de erro, ou null. */
  async function sendFile(blob: Blob, name: string, caption: string): Promise<string | null> {
    const mime = blob.type || "application/octet-stream";
    const check = checkOutgoingMedia({ mime, size: blob.size });
    if (!check.ok) return check.message;
    const prep = await prepareMediaUpload({ id: conversationId, mime, size: blob.size });
    if (!prep.ok) return prep.message ?? "Não foi possível preparar o envio.";
    const { path, token } = prep.data as { path: string; token: string };
    const up = await createClient().storage.from("whatsapp-midia").uploadToSignedUrl(path, token, blob, { contentType: mime });
    if (up.error) return "O arquivo não subiu. Confira a internet e tente de novo.";
    const res = await sendMediaMessage({ id: conversationId, path, mime, size: blob.size, name, caption });
    return res.ok ? null : (res.message ?? "O WhatsApp não aceitou o arquivo.");
  }

  const send = () => {
    if (file) {
      const caption = text.trim();
      if (caption.length > 1024) return setError("Legenda de até 1.024 caracteres.");
      setError(null);
      return run(async () => {
        const problem = await sendFile(file, file.name, caption);
        if (problem) return void setError(problem);
        setFile(null);
        setText("");
        ref.current?.focus();
      });
    }
    const parsed = replySchema.safeParse({ id: conversationId, text });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira a mensagem.");
    setError(null);
    run(async () => {
      const res = await replyConversation(parsed.data);
      if (!res.ok) return void setError(res.message);
      setText("");
      ref.current?.focus();
    });
  };

  const pick = (f: File) => {
    const check = checkOutgoingMedia({ mime: f.type || "application/octet-stream", size: f.size });
    if (!check.ok) return setError(check.message);
    setError(null);
    setFile(f);
    ref.current?.focus();
  };

  const recorded = (blob: Blob, mime: string) => {
    setError(null);
    run(async () => {
      const problem = await sendFile(blob, `audio.${extensionOf(mime)}`, "");
      if (problem) setError(problem);
    });
  };

  if (disabledReason) return <p role="status" className="border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{disabledReason}</p>;
  return (
    <div className="relative grid gap-1.5 border-t bg-card p-2 sm:p-3">
      {matches.length > 0 && (
        <ul id="respostas-rapidas" role="listbox" aria-label="Respostas rápidas" className="absolute inset-x-2 bottom-full z-20 mb-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg sm:inset-x-3">
          {matches.map((r, i) => (
            <li key={r.id} id={`rr-${r.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pickReply(r); }} onMouseEnter={() => setActive(i)}
              className={cn("grid cursor-pointer gap-0.5 rounded-md px-2.5 py-1.5 text-sm", i === active && "bg-accent")}>
              <span className="font-medium">/{r.shortcut}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{r.body}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {file && (
        <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/40 py-1 pl-3 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular">{kb(file.size)}</span>
          <Button type="button" variant="ghost" size="icon" aria-label={`Tirar o anexo ${file.name}`} disabled={pending} onClick={() => setFile(null)}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-1">
        {!recording && <AttachButton disabled={pending} onPick={pick} />}
        {!recording && (
          <Textarea
            ref={ref}
            rows={1}
            maxLength={4096}
            name="mensagem"
            autoComplete="off"
            aria-label={file ? "Legenda do arquivo" : "Mensagem"}
            placeholder={file ? "Legenda (opcional)…" : quickReplies.length ? "Mensagem ou /atalho…" : "Mensagem…"}
            className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none py-2"
            value={text}
            onChange={(e) => { setText(e.target.value); setClosed(false); setActive(0); }}
            role={matches.length ? "combobox" : undefined}
            aria-expanded={matches.length ? true : undefined}
            aria-controls={matches.length ? "respostas-rapidas" : undefined}
            aria-activedescendant={matches.length ? `rr-${matches[active]?.id}` : undefined}
            onKeyDown={(e) => {
              if (matches.length) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                  return;
                }
                if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
                  e.preventDefault();
                  pickReply(matches[active] ?? matches[0]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setClosed(true);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
        )}
        {!file && !text.trim() ? (
          <AudioRecorder disabled={pending} onRecorded={recorded} onRecording={setRecording} />
        ) : null}
        {!recording && (file || text.trim()) ? (
          <Button onClick={send} disabled={pending} aria-label={file ? "Enviar arquivo" : "Enviar"}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
          </Button>
        ) : null}
        {pending && !file && !text.trim() && <LoaderCircle className="m-2 size-5 animate-spin text-muted-foreground" aria-label="Enviando áudio…" />}
      </div>
    </div>
  );
}
