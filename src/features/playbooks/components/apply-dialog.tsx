"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Flag, LoaderCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { previewMilestones, type StepLike } from "@/domain/playbooks";
import { dayLabel } from "@/domain/trainings";
import { clientCode } from "@/domain/clients";
import { applyPlaybook } from "@/features/playbooks/actions";
import { handleResult } from "@/lib/action-feedback";

/** Aplicar a um cliente: escolhe cliente e início, vê os marcos com as datas e cria tudo de uma vez. */
export function ApplyDialog({
  playbookId,
  name,
  steps,
  clients,
  today,
  defaultClientId,
}: {
  playbookId: string;
  name: string;
  steps: StepLike[];
  clients: { id: string; name: string; code: number }[];
  today: string;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [startOn, setStartOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const preview = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(startOn) ? previewMilestones(startOn, steps) : []), [startOn, steps]);

  const apply = () => {
    setError(null);
    if (!clientId) return void setError("Escolha o cliente.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return void setError("Escolha a data de início.");
    start(async () => {
      const res = await applyPlaybook({ playbookId, clientId, startOn });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.push(`/clientes/${clientId}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setError(null); setStartOn(today); } }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={steps.length === 0}><Rocket aria-hidden="true" /> Aplicar a um cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar “{name}”</DialogTitle>
          <DialogDescription>Cria {steps.length} demanda(s) com responsável e prazo, e os marcos na linha do tempo do cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Cliente" required>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full" aria-label="Cliente"><SelectValue placeholder="Escolha o cliente…" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{clientCode(c.code)} · {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Data de início" required>
            <Input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
          </FormField>
          {preview.length > 0 && (
            <ol aria-label="Prévia dos marcos" className="grid gap-1.5 rounded-xl border bg-muted/40 p-3">
              {preview.map((m) => (
                <li key={m.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2"><Flag className="size-3.5 shrink-0 text-brand" aria-hidden="true" /><span className="truncate">{m.title}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">{m.count} demanda(s) · até {dayLabel(m.dueOn)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter>
          <Button onClick={apply} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Criando…" : "Criar demandas e marcos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
