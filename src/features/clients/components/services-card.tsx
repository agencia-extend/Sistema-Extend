"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { setClientService } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { UNIT_LABEL, type ClientStatus } from "@/domain/clients";
import { centsToInput, formatBRL, parseBRL } from "@/domain/shared/money";
import { formatDate } from "@/domain/shared/dates";
import { Section } from "./section";

type Cat = { id: string; name: string; unit: string };
type Cur = { serviceId: string; qty: number; priceCents: number | null; startsOn: string };

export function ServicesCard({
  clientId,
  status,
  canManage,
  current,
  upcoming,
  catalog,
  showPrices,
}: {
  clientId: string;
  status: ClientStatus;
  canManage: boolean;
  current: Cur[];
  upcoming: { serviceId: string; qty: number; startsOn: string }[];
  catalog: Cat[];
  showPrices: boolean;
}) {
  const [editing, setEditing] = useState<{ serviceId: string; qty: string; price: string; isNew: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const available = catalog.filter((c) => !current.some((s) => s.serviceId === c.id));

  const save = (remove = false) => {
    if (!editing?.serviceId) return;
    const qty = remove ? null : Number(editing.qty) || 0;
    startTransition(async () => {
      const ok = handleResult(await setClientService({ clientId, serviceId: editing.serviceId, qty, priceCents: parseBRL(editing.price) }));
      if (ok) setEditing(null);
    });
  };

  const unitOf = (id: string) => byId.get(id)?.unit ?? "nenhuma";
  return (
    <Section
      title="Serviços contratados"
      action={
        canManage && available.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setEditing({ serviceId: "", qty: "", price: "", isNew: true })}>
            <Plus aria-hidden="true" /> Adicionar
          </Button>
        ) : undefined
      }
    >
      {status !== "onboarding" && canManage && (
        <p className="-mt-2 text-xs text-muted-foreground">Mudanças em cliente ativo valem a partir do mês seguinte; o mês atual fica como está.</p>
      )}
      {current.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Nenhum serviço vigente.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {current.map((s) => {
            const c = byId.get(s.serviceId);
            const nextChange = upcoming.find((u) => u.serviceId === s.serviceId);
            return (
              <li key={s.serviceId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-medium">{c?.name ?? "Serviço"}</span>
                  <span className="text-xs text-muted-foreground">
                    {[s.qty ? `${s.qty} ${UNIT_LABEL[unitOf(s.serviceId)]}` : null, showPrices && s.priceCents ? `${formatBRL(s.priceCents)}/mês` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem quantidade mensal"}
                    {nextChange && ` · a partir de ${formatDate(nextChange.startsOn)}: ${nextChange.qty}`}
                  </span>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${c?.name}`}
                    onClick={() => setEditing({ serviceId: s.serviceId, qty: String(s.qty || ""), price: centsToInput(s.priceCents), isNew: false })}
                  >
                    <Pencil aria-hidden="true" /> Editar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && !pending && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? "Adicionar serviço" : `Editar ${byId.get(editing?.serviceId ?? "")?.name ?? "serviço"}`}</DialogTitle>
            <DialogDescription>
              {status === "onboarding" ? "Vale desde o início do contrato." : "Vale a partir do mês seguinte. As demandas do mês atual não mudam."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4">
              {editing.isNew && (
                <FormField label="Serviço" required>
                  <Select value={editing.serviceId} onValueChange={(v) => setEditing({ ...editing, serviceId: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              {editing.serviceId && unitOf(editing.serviceId) !== "nenhuma" && (
                <FormField label={`Quantidade (${UNIT_LABEL[unitOf(editing.serviceId)]})`}>
                  <Input type="number" min={0} max={200} inputMode="numeric" value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} />
                </FormField>
              )}
              {showPrices && (
                <FormField label="Valor por mês (R$)" optional>
                  <Input inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
                </FormField>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {editing && !editing.isNew && (
              <Button variant="ghost" className="text-danger sm:mr-auto" onClick={() => save(true)} disabled={pending}>
                Remover serviço
              </Button>
            )}
            <Button onClick={() => save()} disabled={pending || !editing?.serviceId}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
