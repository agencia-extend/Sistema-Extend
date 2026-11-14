"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { DEFAULT_LEAD_DAYS, MARKETING_KINDS, MARKETING_KIND_LABEL, requestDay, shortDate, type MarketingKind } from "@/domain/marketing";
import { deleteMarketingDate, saveMarketingDate } from "@/features/marketing/actions";
import { marketingDateSchema, type BriefInput } from "@/features/marketing/schemas";
import { handleResult } from "@/lib/action-feedback";
import { BLANK_BRIEF, BriefFields, type BriefValues } from "./brief-fields";

export type EditableDate = {
  id: string;
  clientId: string;
  title: string;
  onDate: string;
  kind: MarketingKind;
  notes: string | null;
  leadDays: number;
  brief: BriefInput | null;
  requestTaskId: string | null;
};

type Client = { id: string; name: string; canRequest: boolean };

const toBrief = (b: BriefInput | null): BriefValues =>
  b ? { ...b, quantity: String(b.quantity), notes: b.notes ?? "" } : BLANK_BRIEF;

/** Cadastrar ou alterar uma data do cliente, com o pedido de criativo automático opcional (RF-PLA-04/05). */
export function DateDialog({ trigger, clients, today, date, prefill }: { trigger: ReactNode; clients: Client[]; today: string; date?: EditableDate; prefill?: { title: string; onDate: string } }) {
  const router = useRouter();
  const start = () => ({
    clientId: date?.clientId ?? (clients.length === 1 ? clients[0].id : ""),
    title: date?.title ?? prefill?.title ?? "",
    onDate: date?.onDate ?? prefill?.onDate ?? "",
    kind: (date?.kind ?? (prefill ? "sazonal" : "")) as string,
    notes: date?.notes ?? "",
    leadDays: String(date?.leadDays ?? DEFAULT_LEAD_DAYS),
    withBrief: Boolean(date?.brief),
    brief: toBrief(date?.brief ?? null),
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const client = clients.find((c) => c.id === v.clientId);
  const locked = Boolean(date?.requestTaskId);
  const lead = Number(v.leadDays) || DEFAULT_LEAD_DAYS;

  const save = () => {
    setAlert(null);
    const input = {
      id: date?.id,
      clientId: v.clientId,
      title: v.title,
      onDate: v.onDate,
      kind: v.kind || undefined,
      notes: v.notes,
      leadDays: Number(v.leadDays),
      brief: v.withBrief ? { ...v.brief, quantity: Number(v.brief.quantity), format: v.brief.format || undefined, objective: v.brief.objective || undefined } : null,
    };
    const parsed = marketingDateSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveMarketingDate(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setOpen(false);
      if (!date) setV(start());
      router.refresh();
    });
  };

  const remove = () =>
    run(async () => {
      if (handleResult(await deleteMarketingDate({ id: date!.id }))) {
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(start()); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{date ? "Alterar data" : "Nova data do cliente"}</DialogTitle>
          <DialogDescription>Lançamentos, promoções e eventos do cliente. A equipe de tráfego e de mídias vê no calendário.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <FormField label="Cliente" required error={errors.clientId}>
            <Select value={v.clientId} onValueChange={(x) => setV({ ...v, clientId: x })} disabled={Boolean(date)}>
              <SelectTrigger className="w-full" aria-label="Cliente"><SelectValue placeholder="Escolha o cliente…" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
            <FormField label="Nome da data" required error={errors.title}>
              <Input autoComplete="off" maxLength={120} placeholder="Ex.: Lançamento da coleção de verão…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
            </FormField>
            <FormField label="Data" required error={errors.onDate}>
              <Input type="date" min={today} value={v.onDate} onChange={(e) => setV({ ...v, onDate: e.target.value })} />
            </FormField>
            <FormField label="Tipo" required error={errors.kind}>
              <Select value={v.kind} onValueChange={(x) => setV({ ...v, kind: x })}>
                <SelectTrigger className="w-full" aria-label="Tipo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{MARKETING_KINDS.map((k) => <SelectItem key={k} value={k}>{MARKETING_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>

          <fieldset className="grid gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Pedido de criativo</legend>
            {locked ? (
              <p className="text-sm">
                O pedido já foi criado.{" "}
                <Link href={`/criativos/${date!.requestTaskId}`} className="font-medium text-primary hover:underline">Abrir o pedido em Criativos</Link>
              </p>
            ) : client && !client.canRequest ? (
              <p className="text-sm text-muted-foreground">Para agendar um pedido de criativo para este cliente, peça a quem do tráfego ou da coordenação cadastrar a data.</p>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="md-brief" checked={v.withBrief} onCheckedChange={(c) => setV({ ...v, withBrief: c === true })} className="mt-0.5" />
                  <Label htmlFor="md-brief" className="grid gap-0.5 font-normal">
                    <span className="font-medium">Pedir o criativo sozinho antes da data</span>
                    <span className="text-xs text-muted-foreground">O pedido vai para a fila de Criativos em seu nome, com prazo de 5 dias antes da data.</span>
                  </Label>
                </div>
                {v.withBrief && (
                  <>
                    <FormField
                      label="Quantos dias antes pedir"
                      required
                      error={errors.leadDays}
                      hint={v.onDate ? (requestDay(v.onDate, lead) <= today ? "O pedido sai assim que você salvar." : `O pedido sai em ${shortDate(requestDay(v.onDate, lead))}.`) : "Padrão: 15 dias."}
                    >
                      <Input type="number" inputMode="numeric" min={1} max={90} className="w-24" value={v.leadDays} onChange={(e) => setV({ ...v, leadDays: e.target.value })} />
                    </FormField>
                    <BriefFields v={v.brief} set={(b) => setV({ ...v, brief: b })} errors={errors} />
                  </>
                )}
              </>
            )}
          </fieldset>
        </div>
        <DialogFooter className="gap-2">
          {date && (
            <Button variant="ghost" className="text-danger sm:mr-auto" disabled={pending} onClick={remove}>
              <Trash2 aria-hidden="true" /> Excluir
            </Button>
          )}
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
