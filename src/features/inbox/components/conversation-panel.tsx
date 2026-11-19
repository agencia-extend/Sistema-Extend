"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { ExternalLink, LoaderCircle, Megaphone, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import type { AdOrigin, Tag } from "@/features/inbox/queries";
import { TagPicker } from "./tag-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { formatBRL } from "@/domain/shared/money";
import { assignConversation, createLeadFromConversation, deleteConversation, setConversationStatus, unlinkConversationLead } from "@/features/inbox/actions";
import { leadNameSchema } from "@/features/inbox/schemas";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__ninguem";
type Lead = { id: string; name: string; company: string | null; valueCents: number | null; stageName: string | null; stageColor: string | null } | null;

/** Responsável, encerrar/reabrir e o lead do Comercial ligado à conversa. */
export function ConversationPanel({ id, status, assigneeId, agents, lead, hasLead, suggestedName, canReply, canCreateLead, group = null, tags, tagIds, ad, canManage, deleted }: {
  id: string; status: "aberta" | "encerrada"; assigneeId: string | null; agents: { id: string; name: string }[]; lead: Lead; hasLead: boolean;
  suggestedName: string; canReply: boolean; canCreateLead: boolean;
  tags: Tag[]; tagIds: string[]; ad: AdOrigin | null; canManage: boolean; deleted: boolean;
  /** Conversa de grupo: no lugar do lead, o cliente ligado ao grupo (Configurações › WhatsApp). */
  group?: { clientId: string | null; clientName: string | null } | null;
}) {
  const [pending, run] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(assigneeId ?? NONE);
  const uid = useId();
  const h = (k: string) => `${uid}-${k}`;

  const createLead = () => {
    const parsed = leadNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Informe o nome.");
    setError(null);
    run(async () => {
      const res = await createLeadFromConversation({ id, name: parsed.data });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
    });
  };

  return (
    <div className="grid content-start gap-5">
      <section aria-labelledby={h("resp")} className="grid gap-2">
        <h2 id={h("resp")} className="text-sm font-semibold">Responsável</h2>
        <Select value={assignee} disabled={!canReply || pending}
          onValueChange={(v) => { setAssignee(v); run(async () => { if (!handleResult(await assignConversation({ id, userId: v === NONE ? null : v }))) setAssignee(assigneeId ?? NONE); }); }}>
          <SelectTrigger className="w-full" aria-label="Responsável pela conversa"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem responsável</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <section aria-labelledby={h("tags")} className="grid gap-2">
        <h2 id={h("tags")} className="text-sm font-semibold">Etiquetas</h2>
        <TagPicker key={tagIds.join(",")} conversationId={id} tags={tags} selected={tagIds} canEdit={canReply} />
      </section>

      {ad && (
        <section aria-labelledby={h("ad")} className="grid gap-1.5 rounded-lg border border-info/30 bg-info-soft/40 p-3 text-sm">
          <h2 id={h("ad")} className="flex items-center gap-1.5 font-semibold"><Megaphone className="size-4 text-info" aria-hidden="true" /> Veio de anúncio</h2>
          {(ad.adName || ad.headline) && <p className="break-words">{ad.adName ?? ad.headline}</p>}
          {ad.campaignName && <p className="text-xs text-muted-foreground">Campanha: {ad.campaignName}</p>}
          {!ad.adName && ad.sourceId && <p className="text-xs text-muted-foreground">Anúncio {ad.sourceId} (ainda não sincronizado)</p>}
          {ad.url && <a href={ad.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-info hover:underline">Ver o anúncio <ExternalLink className="size-3" aria-hidden="true" /></a>}
        </section>
      )}

      {group ? (
        <section aria-labelledby={h("cliente")} className="grid gap-2">
          <h2 id={h("cliente")} className="text-sm font-semibold">Cliente do grupo</h2>
          {group.clientId && group.clientName ? (
            <Link href={`/clientes/${group.clientId}`} className="text-sm font-medium break-words hover:underline">{group.clientName}</Link>
          ) : group.clientId ? (
            <p className="text-sm text-muted-foreground">Ligado a um cliente que você não vê.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Grupo sem cliente. Quem administra liga o grupo ao cliente em Configurações › WhatsApp.</p>
          )}
        </section>
      ) : (
      <section aria-labelledby={h("lead")} className="grid gap-2">
        <h2 id={h("lead")} className="text-sm font-semibold">Lead no Comercial</h2>
        {lead ? (
          <div className="grid gap-1 rounded-lg border p-3 text-sm">
            <Link href={`/comercial/leads/${lead.id}`} className="font-medium break-words hover:underline">{lead.name}</Link>
            {lead.company && <span className="text-muted-foreground">{lead.company}</span>}
            {lead.stageName && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="size-2 rounded-full" style={{ background: lead.stageColor ?? undefined }} aria-hidden="true" /> {lead.stageName}
              </span>
            )}
            {lead.valueCents !== null && <span className="text-xs text-muted-foreground tabular">{formatBRL(lead.valueCents)}</span>}
            {canReply && (
              <Button size="sm" variant="ghost" className="w-fit px-0 text-muted-foreground" disabled={pending}
                onClick={() => run(async () => void handleResult(await unlinkConversationLead({ id })))}>Desligar da conversa</Button>
            )}
          </div>
        ) : hasLead ? (
          <p className="text-sm text-muted-foreground">Ligada a um lead que você não vê.</p>
        ) : canCreateLead ? (
          <div className="grid gap-2">
            <FormField label="Nome do lead" error={error ?? undefined}>
              <Input autoComplete="off" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <Button variant="outline" className="w-fit" disabled={pending} onClick={createLead}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />} Criar lead no funil
            </Button>
            <p className="text-xs text-muted-foreground">Entra no início do funil padrão, com origem WhatsApp e este telefone. Lead que já tem este telefone é ligado sozinho.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem lead ligado.</p>
        )}
      </section>
      )}

      {canReply && !deleted && (
        <Button variant="outline" disabled={pending} className="w-fit"
          onClick={() => run(async () => void handleResult(await setConversationStatus({ id, status: status === "aberta" ? "encerrada" : "aberta" })))}>
          {status === "aberta" ? "Encerrar conversa" : "Reabrir conversa"}
        </Button>
      )}
      {canManage && (deleted ? (
        <Button variant="outline" disabled={pending} className="w-fit" onClick={() => run(async () => void handleResult(await deleteConversation({ id, restore: true })))}>
          <RotateCcw aria-hidden="true" /> Restaurar conversa
        </Button>
      ) : (
        <ConfirmDialog
          trigger={<Button variant="ghost" className="w-fit text-danger hover:text-danger" disabled={pending}><Trash2 aria-hidden="true" /> {group ? "Apagar grupo da lista" : "Apagar conversa"}</Button>}
          title={group ? "Apagar este grupo da lista?" : "Apagar esta conversa?"}
          description="Ela some do Atendimento para todos. As mensagens ficam guardadas e a conversa volta se chegar mensagem nova. Dá para restaurar na aba Apagadas."
          confirmLabel="Apagar"
          onConfirm={async () => { handleResult(await deleteConversation({ id, restore: false })); }}
        />
      ))}
    </div>
  );
}
