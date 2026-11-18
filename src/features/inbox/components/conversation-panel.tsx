"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { formatBRL } from "@/domain/shared/money";
import { assignConversation, createLeadFromConversation, setConversationStatus, unlinkConversationLead } from "@/features/inbox/actions";
import { leadNameSchema } from "@/features/inbox/schemas";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__ninguem";
type Lead = { id: string; name: string; company: string | null; valueCents: number | null; stageName: string | null; stageColor: string | null } | null;

/** Responsável, encerrar/reabrir e o lead do Comercial ligado à conversa. */
export function ConversationPanel({ id, status, assigneeId, agents, lead, hasLead, suggestedName, canReply, canCreateLead, group = null }: {
  id: string; status: "aberta" | "encerrada"; assigneeId: string | null; agents: { id: string; name: string }[]; lead: Lead; hasLead: boolean;
  suggestedName: string; canReply: boolean; canCreateLead: boolean;
  /** Conversa de grupo: no lugar do lead, o cliente ligado ao grupo (Configurações › WhatsApp). */
  group?: { clientId: string | null; clientName: string | null } | null;
}) {
  const [pending, run] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(assigneeId ?? NONE);

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
      <section aria-labelledby="cv-resp" className="grid gap-2">
        <h2 id="cv-resp" className="text-sm font-semibold">Responsável</h2>
        <Select value={assignee} disabled={!canReply || pending}
          onValueChange={(v) => { setAssignee(v); run(async () => { if (!handleResult(await assignConversation({ id, userId: v === NONE ? null : v }))) setAssignee(assigneeId ?? NONE); }); }}>
          <SelectTrigger className="w-full" aria-label="Responsável pela conversa"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem responsável</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {group ? (
        <section aria-labelledby="cv-cliente" className="grid gap-2">
          <h2 id="cv-cliente" className="text-sm font-semibold">Cliente do grupo</h2>
          {group.clientId && group.clientName ? (
            <Link href={`/clientes/${group.clientId}`} className="text-sm font-medium break-words hover:underline">{group.clientName}</Link>
          ) : group.clientId ? (
            <p className="text-sm text-muted-foreground">Ligado a um cliente que você não vê.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Grupo sem cliente. Quem administra liga o grupo ao cliente em Configurações › WhatsApp.</p>
          )}
        </section>
      ) : (
      <section aria-labelledby="cv-lead" className="grid gap-2">
        <h2 id="cv-lead" className="text-sm font-semibold">Lead no Comercial</h2>
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

      {canReply && (
        <Button variant="outline" disabled={pending} className="w-fit"
          onClick={() => run(async () => void handleResult(await setConversationStatus({ id, status: status === "aberta" ? "encerrada" : "aberta" })))}>
          {status === "aberta" ? "Encerrar conversa" : "Reabrir conversa"}
        </Button>
      )}
    </div>
  );
}
