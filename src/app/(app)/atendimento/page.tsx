import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { INBOX_TABS, contactLabel, formatPhone, parseInboxTab } from "@/domain/inbox";
import { formatRelative } from "@/domain/shared/dates";
import { getWhatsappState, listConversations } from "@/features/inbox/queries";
import { InboxLive } from "@/features/inbox/components/inbox-live";
import { CompileBanner, WhatsappDialog } from "@/features/whatsapp/components/whatsapp-dialog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Atendimento" };

const EMPTY: Record<string, string> = {
  abertas: "As conversas com contatos aparecem aqui quando alguém manda mensagem para o WhatsApp da Extend. Para trazer as conversas antigas, use Compilar conversas.",
  grupos: "Os grupos do WhatsApp da Extend aparecem aqui quando chega mensagem neles ou depois de compilar as conversas.",
  aguardando: "Nenhum contato esperando resposta.",
  minhas: "Nenhuma conversa aberta com você como responsável.",
  encerradas: "Nenhuma conversa encerrada.",
};

/** RF-WPP-03: caixa de entrada do WhatsApp da Extend, ligada ao Comercial. */
export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requirePermission(["inbox.read"]);
  const tab = parseInboxTab((await searchParams).aba);
  const canConnect = Boolean(user.permissions["inbox.manage"] || user.permissions["integrations.manage"]);
  const supabase = await createClient();
  const [{ rows, counts }, wa, compiled] = await Promise.all([
    listConversations(tab, user.id),
    getWhatsappState(),
    canConnect ? supabase.from("wa_imports").select("id", { count: "exact", head: true }).then((r) => (r.count ?? 0) > 0) : Promise.resolve(true),
  ]);
  const actions = canConnect
    ? wa?.connected
      ? <WhatsappDialog mode="history" label="Compilar conversas" variant="outline" />
      : <WhatsappDialog mode="connect" label="Conectar WhatsApp" />
    : undefined;

  return (
    <>
      <InboxLive />
      <PageHeader title="Atendimento" description="Conversas e grupos do WhatsApp da Extend. Responda, defina quem cuida e ligue cada conversa a um lead do Comercial." actions={actions} />
      <PageBody className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-4">
        {!wa?.connected && (
          <p role="status" className="rounded-lg border border-warning/40 bg-warning-soft/50 px-3 py-2 text-sm">
            {wa ? "O WhatsApp da Extend não está conectado agora: as mensagens novas não chegam e não dá para responder." : "O WhatsApp da Extend ainda não foi conectado ao sistema."}{" "}
            {canConnect ? "Clique em Conectar WhatsApp e leia o QR Code com o celular do número." : "Avise quem cuida do atendimento."}
          </p>
        )}
        {canConnect && wa?.connected && <CompileBanner show={!compiled} />}
        <nav aria-label="Conversas" className="flex flex-wrap gap-1 text-sm">
          {INBOX_TABS.map((t) => {
            const n = t.key === "encerradas" ? null : counts[t.key];
            return (
              <Link key={t.key} href={`/atendimento?aba=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5", t.key === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {t.label}{n !== null && <span className="ml-1.5 tabular">{n}</span>}
              </Link>
            );
          })}
        </nav>
        {rows.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Nenhuma conversa aqui" description={EMPTY[tab]}
            action={tab !== "abertas" ? <Link href="/atendimento" className={buttonVariants({ variant: "outline" })}>Ver as abertas</Link> : undefined} />
        ) : (
          <ul aria-label="Conversas" className="divide-y overflow-hidden rounded-xl border bg-card">
            {rows.map((c) => {
              const name = contactLabel(c);
              return (
                <li key={c.id}>
                  <Link href={`/atendimento/${c.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{name}</span>
                    <span className="text-xs text-muted-foreground tabular" suppressHydrationWarning>{c.lastMessageAt ? formatRelative(c.lastMessageAt) : ""}</span>
                    <span className="truncate text-sm text-muted-foreground">{c.preview || "—"}</span>
                    <span className="flex items-center justify-end gap-1.5">
                      {c.waitingReply && c.status === "aberta" && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Aguardando</span>}
                      {c.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular" aria-label={`${c.unread} não lidas`}>{c.unread}</span>}
                    </span>
                    <span className="col-span-2 truncate text-xs text-muted-foreground">
                      {[c.kind === "grupo" ? "Grupo" : null, c.phone && name !== formatPhone(c.phone) ? formatPhone(c.phone) : null, c.leadName ? "Lead no Comercial" : null, c.assigneeName ? `Com ${c.assigneeName}` : "Sem responsável"].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
