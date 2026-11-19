import { Check, CheckCheck, CircleAlert } from "lucide-react";
import { clockTime, dayKey, dayLabel } from "@/domain/inbox";
import type { ChatMessage } from "@/features/inbox/queries";
import { cn } from "@/lib/utils";
import { MessageMedia } from "./message-media";

const ACK_LABEL = { enviada: "Enviada", entregue: "Entregue", lida: "Lida", erro: "Não enviada" } as const;

function Ack({ ack }: { ack: ChatMessage["ack"] }) {
  if (!ack) return null;
  const Icon = ack === "erro" ? CircleAlert : ack === "enviada" ? Check : CheckCheck;
  return <Icon className={cn("size-3.5", ack === "lida" && "text-info", ack === "erro" && "text-danger")} aria-label={ACK_LABEL[ack]} />;
}

/**
 * Mensagens da conversa com separador de dia. A coluna é invertida (column-reverse): a tela abre na mensagem mais
 * nova e continua nela quando chega outra, sem script.
 */
export function ChatThread({ messages, group, now }: { messages: ChatMessage[]; group: boolean; now: Date }) {
  const items: ({ type: "day"; key: string; label: string } | { type: "msg"; m: ChatMessage; first: boolean })[] = [];
  let lastDay = "";
  let lastAuthor: string | null = null;
  for (const m of messages) {
    const day = dayKey(m.sentAt);
    if (day !== lastDay) {
      items.push({ type: "day", key: day, label: dayLabel(m.sentAt, now) });
      lastDay = day;
      lastAuthor = null;
    }
    const author = m.fromMe ? "__eu" : (m.authorName ?? "__contato");
    items.push({ type: "msg", m, first: author !== lastAuthor });
    lastAuthor = author;
  }
  return (
    <div role="region" aria-label="Mensagens da conversa" tabIndex={0} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset">
      <ol aria-label="Mensagens" className="flex flex-col gap-0.5 px-3 py-4 sm:px-6">
        {items.length === 0 && <li className="mx-auto rounded-lg bg-card px-3 py-2 text-center text-sm text-muted-foreground shadow-xs">Nenhuma mensagem guardada nesta conversa.</li>}
        {items.map((it) =>
          it.type === "day" ? (
            <li key={`d-${it.key}`} className="sticky top-2 z-10 mx-auto my-2 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-xs" suppressHydrationWarning>
              {it.label}
            </li>
          ) : (
            <li key={it.m.id} className={cn("flex", it.m.fromMe ? "justify-end" : "justify-start", it.first && "mt-2")}>
              <div className={cn("max-w-[85%] rounded-xl px-2.5 pt-1.5 pb-1 text-sm shadow-xs sm:max-w-[65%]",
                it.m.fromMe ? "bg-accent text-foreground" : "bg-card", it.first && (it.m.fromMe ? "rounded-tr-sm" : "rounded-tl-sm"))}>
                {it.first && (it.m.fromMe ? it.m.authorName : group && it.m.authorName) && (
                  <p className={cn("mb-0.5 text-xs font-semibold", it.m.fromMe ? "text-accent-foreground" : "text-primary")}>{it.m.authorName}</p>
                )}
                {it.m.kind === "media" && <MessageMedia message={it.m} />}
                {it.m.body && <p className="break-words whitespace-pre-wrap">{it.m.body}</p>}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground tabular-nums" suppressHydrationWarning>
                  {clockTime(it.m.sentAt)}{it.m.fromMe && <Ack ack={it.m.ack} />}
                </p>
              </div>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
