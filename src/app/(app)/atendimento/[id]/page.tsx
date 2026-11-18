import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { contactLabel, formatPhone } from "@/domain/inbox";
import { formatDateTime } from "@/domain/shared/dates";
import { getConversation, getWhatsappState, listAgents } from "@/features/inbox/queries";
import { Composer } from "@/features/inbox/components/composer";
import { ConversationPanel } from "@/features/inbox/components/conversation-panel";
import { InboxLive } from "@/features/inbox/components/inbox-live";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversa" };

/** Uma conversa do atendimento: mensagens, resposta, responsável e lead. */
export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(["inbox.read"]);
  const { id } = await params;
  const canSeeLeads = Boolean(user.permissions["crm.leads.read"]);
  const [data, agents, wa] = await Promise.all([getConversation(id, canSeeLeads), listAgents(), getWhatsappState()]);
  if (!data) notFound();
  const { conversation: c, messages, lead, group } = data;
  const name = contactLabel(c);
  const canReply = Boolean(user.permissions["inbox.reply"]);
  const disabledReason = !canReply ? "Você pode ler, mas não responder conversas." : !wa?.connected ? "O WhatsApp da Extend não está conectado: não dá para responder agora." : null;

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_300px]">
      <InboxLive />
      <section aria-label={`Conversa com ${name}`} className="flex min-h-0 flex-col border-r">
        <header className="flex items-center gap-2 border-b px-3 py-3 sm:px-4">
          <Link href="/atendimento" aria-label="Voltar para as conversas" className="grid size-9 place-items-center rounded-md hover:bg-muted"><ChevronLeft className="size-5" /></Link>
          <div className="grid min-w-0">
            <h1 className="truncate text-base font-semibold">{name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {[c.kind === "grupo" ? "Grupo" : formatPhone(c.phone) || null, c.status === "encerrada" ? "Encerrada" : c.waitingReply ? "Aguardando resposta" : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </header>
        <ol aria-label="Mensagens" className="flex flex-1 flex-col gap-2 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-4">
          {messages.length === 0 && <li className="text-center text-sm text-muted-foreground">Nenhuma mensagem guardada nesta conversa.</li>}
          {messages.map((m) => (
            <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs sm:max-w-[70%]", m.fromMe ? "self-end rounded-br-sm bg-primary text-primary-foreground" : "self-start rounded-bl-sm border bg-card")}>
              {(m.fromMe || c.kind === "grupo") && m.authorName && <p className="mb-0.5 text-[11px] font-medium opacity-80">{m.authorName}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body || (m.kind === "media" ? "[Mídia: abra no WhatsApp para ver]" : "")}</p>
              <p className={cn("mt-1 text-right text-[11px] tabular", m.fromMe ? "opacity-80" : "text-muted-foreground")} suppressHydrationWarning>{formatDateTime(m.sentAt)}</p>
            </li>
          ))}
        </ol>
        <Composer conversationId={c.id} unread={c.unread} disabledReason={disabledReason} />
      </section>
      <aside aria-label="Detalhes da conversa" className="border-t p-4 lg:border-t-0">
        <ConversationPanel
          id={c.id}
          status={c.status}
          assigneeId={c.assigneeId}
          agents={agents}
          lead={lead}
          hasLead={Boolean(c.leadId)}
          suggestedName={c.contactName || ""}
          canReply={canReply}
          canCreateLead={canReply && Boolean(user.permissions["crm.leads.manage"])}
          group={group}
        />
      </aside>
    </div>
  );
}
