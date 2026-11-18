"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markConversationRead, replyConversation } from "@/features/inbox/actions";
import { replySchema } from "@/features/inbox/schemas";

/** Caixa de resposta: Enter envia, Shift+Enter quebra a linha. Abre marcando a conversa como lida. */
export function Composer({ conversationId, unread, disabledReason }: { conversationId: string; unread: number; disabledReason: string | null }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (unread > 0) void markConversationRead({ id: conversationId });
  }, [conversationId, unread]);

  const send = () => {
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

  if (disabledReason) return <p role="status" className="border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{disabledReason}</p>;
  return (
    <div className="grid gap-1.5 border-t bg-card p-3">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          rows={2}
          maxLength={4096}
          aria-label="Mensagem"
          placeholder="Escreva a resposta…"
          className="max-h-40 min-h-11 flex-1 resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={pending} aria-label="Enviar">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
