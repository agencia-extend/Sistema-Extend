import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ChevronLeft, MessageCircle, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { buttonVariants } from "@/components/ui/button";
import { INBOX_TABS, contactLabel, formatPhone, inboxHref, parseInboxFilters } from "@/domain/inbox";
import { getConversation, getInboxSettings, getWhatsappState, listAgents, listConversations, listQuickReplies, listTags } from "@/features/inbox/queries";
import { InboxLive } from "@/features/inbox/components/inbox-live";
import { InboxFilters } from "@/features/inbox/components/inbox-filters";
import { ConversationList } from "@/features/inbox/components/conversation-list";
import { ChatThread } from "@/features/inbox/components/chat-thread";
import { ChatDetails } from "@/features/inbox/components/chat-details";
import { ContactAvatar } from "@/features/inbox/components/contact-avatar";
import { Composer } from "@/features/inbox/components/composer";
import { ConversationPanel } from "@/features/inbox/components/conversation-panel";
import { CompileBanner, WhatsappDialog } from "@/features/whatsapp/components/whatsapp-dialog";
import { refreshAvatars } from "@/lib/whatsapp/avatars";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Atendimento" };

const EMPTY: Record<string, string> = {
  abertas: "As conversas aparecem aqui quando alguém manda mensagem para o WhatsApp da Extend. Para trazer as antigas, use Compilar conversas.",
  aguardando: "Ninguém está esperando resposta.",
  radar: "Nenhum contato esperando além do tempo do radar.",
  minhas: "Nenhuma conversa aberta com você como responsável.",
  grupos: "Os grupos aparecem quando chega mensagem neles ou depois de compilar as conversas.",
  encerradas: "Nenhuma conversa encerrada.",
  apagadas: "Nenhuma conversa apagada.",
};

/** RF-WPP-03/06/07: atendimento do WhatsApp da Extend, como no HubSystem (lista e conversa lado a lado). */
export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["inbox.read"]);
  const sp = await searchParams;
  const filters = parseInboxFilters(sp);
  const canManage = Boolean(user.permissions["inbox.manage"]);
  if (filters.tab === "apagadas" && !canManage) filters.tab = "abertas";
  const canConnect = canManage || Boolean(user.permissions["integrations.manage"]);
  const canReply = Boolean(user.permissions["inbox.reply"]);
  const selectedId = typeof sp.conversa === "string" && /^[0-9a-f-]{36}$/i.test(sp.conversa) ? sp.conversa : null;
  const supabase = await createClient();
  const settings = await getInboxSettings();
  const [list, wa, agents, tags, replies, selected, compiled] = await Promise.all([
    listConversations(filters, user.id, settings.radarMinutes, canManage),
    getWhatsappState(),
    listAgents(),
    listTags(),
    canReply ? listQuickReplies() : Promise.resolve([]),
    selectedId ? getConversation(selectedId, Boolean(user.permissions["crm.leads.read"])) : Promise.resolve(null),
    canConnect ? supabase.from("wa_imports").select("id", { count: "exact", head: true }).then((r) => (r.count ?? 0) > 0) : Promise.resolve(true),
  ]);
  // Fotos e nomes de grupo: buscados depois que a tela abriu, sem atrasar.
  const visible = [...list.rows.map((r) => r.id), ...(selected ? [selected.conversation.id] : [])];
  if (wa?.connected) after(() => refreshAvatars(user.organizationId, visible).catch((e) => console.error("[atendimento] fotos", (e as Error).message)));

  const now = new Date();
  const current = { aba: filters.tab === "abertas" ? undefined : filters.tab, q: filters.q, responsavel: filters.assignee, etiqueta: filters.tag };
  const tabs = INBOX_TABS.filter((t) => t.key !== "apagadas" || canManage);
  const c = selected?.conversation;
  const name = c ? contactLabel(c) : "";
  const disabledReason = !canReply ? "Você pode ler, mas não responder conversas." : !wa?.connected ? "O WhatsApp da Extend não está conectado: não dá para responder agora." : c?.deleted ? "Conversa apagada. Restaure para responder." : null;
  const panel = selected && c ? (
    <ConversationPanel
      id={c.id} status={c.status} assigneeId={c.assigneeId} agents={agents} lead={selected.lead} hasLead={Boolean(c.leadId)} suggestedName={c.contactName || ""}
      canReply={canReply} canCreateLead={canReply && Boolean(user.permissions["crm.leads.manage"])} group={selected.group}
      tags={tags} tagIds={c.tagIds} ad={selected.ad} canManage={canManage} deleted={c.deleted}
    />
  ) : null;

  return (
    <>
      <InboxLive />
      <div className={cn("md:grid md:h-[calc(100dvh-4rem)] md:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)] md:overflow-hidden", selected && "xl:grid-cols-[23rem_minmax(0,1fr)_19rem]")}>
        <aside aria-label="Lista de conversas" className={cn("flex min-h-0 flex-col border-r bg-card", selected && "max-md:hidden")}>
          <div className="grid gap-3 border-b p-3">
            <div className="flex items-center gap-2">
              <h1 className="flex-1 text-lg font-semibold">Atendimento</h1>
              {canManage && (
                <Link href="/atendimento/ajustes" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Ajustes do atendimento" title="Ajustes do atendimento">
                  <SlidersHorizontal aria-hidden="true" />
                </Link>
              )}
              {canConnect && (wa?.connected
                ? <WhatsappDialog mode="history" label="Compilar" variant="outline" />
                : <WhatsappDialog mode="connect" label="Conectar WhatsApp" />)}
            </div>
            {!wa?.connected && (
              <p role="status" className="rounded-md border border-warning/40 bg-warning-soft/60 px-2.5 py-2 text-xs">
                {wa ? "O WhatsApp da Extend está desconectado: mensagens novas não chegam e não dá para responder." : "O WhatsApp da Extend ainda não foi conectado."}{" "}
                {canConnect ? "Toque em Conectar WhatsApp e leia o QR Code com o celular do número." : "Avise quem administra o atendimento."}
              </p>
            )}
            {canConnect && wa?.connected && <CompileBanner show={!compiled} />}
            <InboxFilters agents={agents} tags={tags} />
          </div>
          <nav aria-label="Abas do atendimento" className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5 text-sm [scrollbar-width:none]">
            {tabs.map((t) => {
              const n = t.key === "encerradas" ? null : list.counts[t.key as keyof typeof list.counts];
              const on = t.key === filters.tab;
              return (
                <Link key={t.key} href={inboxHref(current, { aba: t.key === "abertas" ? undefined : t.key, conversa: undefined })} scroll={false} aria-current={on ? "page" : undefined}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {t.label}
                  {n !== null && n > 0 && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-primary-foreground/20" : t.key === "radar" ? "bg-danger-soft text-danger" : "bg-muted")}>{n}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filters.tab === "radar" && (
              <p className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Contatos sem resposta há mais de {settings.radarMinutes} min, do que espera há mais tempo.{canManage ? " O tempo muda em Ajustes." : ""}
              </p>
            )}
            {list.rows.length === 0 ? (
              <div className="grid justify-items-center gap-2 px-6 py-12 text-center">
                <MessageCircle className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">{filters.q || filters.assignee || filters.tag ? "Nada encontrado com estes filtros" : "Nenhuma conversa aqui"}</p>
                <p className="max-w-xs text-sm text-muted-foreground">{filters.q || filters.assignee || filters.tag ? "Mude a busca ou limpe os filtros." : EMPTY[filters.tab]}</p>
                {(filters.q || filters.assignee || filters.tag) && <Link href={inboxHref({ aba: current.aba }, {})} className={buttonVariants({ variant: "outline", size: "sm" })}>Limpar filtros</Link>}
              </div>
            ) : (
              <>
                <ConversationList rows={list.rows} tags={tags} tab={filters.tab} selectedId={selectedId} now={now} href={(id) => inboxHref(current, { conversa: id })} />
                {list.truncated && <p className="px-3 py-3 text-center text-xs text-muted-foreground">Mostrando as 200 mais recentes. Use a busca para achar as outras.</p>}
              </>
            )}
          </div>
        </aside>

        {selected && c ? (
          <section aria-label={`Conversa com ${name}`} className="fixed inset-0 z-40 flex min-h-0 flex-col bg-background pt-[env(safe-area-inset-top)] md:static md:z-auto md:pt-0">
            <header className="flex items-center gap-2 border-b bg-card px-2 py-2 sm:px-3">
              <Link href={inboxHref(current, { conversa: undefined })} scroll={false} aria-label="Voltar para as conversas" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </Link>
              <ContactAvatar name={name} url={c.avatarUrl} group={c.kind === "grupo"} />
              <div className="grid min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{name}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {[c.kind === "grupo" ? "Grupo" : formatPhone(c.phone) || null, c.deleted ? "Apagada" : c.status === "encerrada" ? "Encerrada" : c.waitingReply ? "Aguardando resposta" : null, c.assigneeName ? `Com ${c.assigneeName}` : null]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              <ChatDetails name={name}>{panel}</ChatDetails>
            </header>
            <ChatThread messages={selected.messages} group={c.kind === "grupo"} now={now} />
            <div className="pb-safe bg-card">
              <Composer key={c.id} conversationId={c.id} unread={c.unread} disabledReason={disabledReason} quickReplies={replies} contactName={c.leadName || c.contactName} />
            </div>
          </section>
        ) : (
          <div className="hidden place-items-center bg-muted/40 p-8 text-center md:grid">
            <div className="grid max-w-sm justify-items-center gap-2">
              <MessagesSquare className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">{selectedId ? "Conversa não encontrada" : "Escolha uma conversa"}</p>
              <p className="text-sm text-muted-foreground">{selectedId ? "Ela pode ter sido apagada ou você não tem acesso." : "As mensagens, a resposta e os detalhes do contato aparecem aqui."}</p>
            </div>
          </div>
        )}

        {selected && (
          <aside aria-label="Detalhes da conversa" className="hidden min-h-0 overflow-y-auto border-l bg-card p-4 xl:block">{panel}</aside>
        )}
      </div>
    </>
  );
}
