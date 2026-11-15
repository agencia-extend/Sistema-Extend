"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { parseBRL } from "@/domain/shared/money";
import { BUDGET_CHANNELS, BUDGET_CHANNEL_LABEL, BUDGET_PLATFORMS, PLATFORM_LABEL } from "@/domain/traffic";
import { saveBudget } from "@/features/traffic/actions";
import { budgetSchema } from "@/features/traffic/schemas";
import { handleResult } from "@/lib/action-feedback";

export type BudgetValues = { amount: string; platform: string; periodStart: string; periodEnd: string; approvedBy: string; approvedOn: string; channel: string; notes: string };
const MAX = 10 * 1024 * 1024;

/** Registrar a verba aprovada pelo cliente: valor, período, quem aprovou, por onde e o comprovante. */
export function BudgetDialog({ clientId, today, trigger, initial, id, hasProof }: { clientId: string; today: string; trigger: ReactNode; initial?: BudgetValues; id?: string; hasProof?: boolean }) {
  const blank: BudgetValues = { amount: "", platform: "", periodStart: "", periodEnd: "", approvedBy: "", approvedOn: today, channel: "", notes: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<BudgetValues>(initial ?? blank);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const f = (k: keyof BudgetValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const save = () => {
    setAlert(null);
    const cents = parseBRL(v.amount);
    const parsed = budgetSchema.safeParse({
      id, clientId, amountCents: cents ?? Number.NaN, platform: v.platform || undefined, periodStart: v.periodStart, periodEnd: v.periodEnd,
      approvedBy: v.approvedBy, approvedOn: v.approvedOn, channel: v.channel || undefined, notes: v.notes,
    });
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    if (cents === null && v.amount.trim()) e.amountCents = "Use só números, como 1.500,00.";
    if (file && file.size > MAX) e.file = "Comprovante maior que 10 MB.";
    if (file && !/^(image|audio)\/|^application\/pdf$/.test(file.type)) e.file = "Envie um print (imagem), um áudio ou um PDF.";
    if (Object.keys(e).length || !parsed.success) {
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("clientId", clientId);
    fd.set("amountCents", String(parsed.data.amountCents));
    for (const k of ["platform", "periodStart", "periodEnd", "approvedBy", "approvedOn", "channel", "notes"] as const) fd.set(k, String(parsed.data[k] ?? ""));
    if (file) fd.set("file", file);
    run(async () => {
      const res = await saveBudget(fd);
      if (!res.ok) {
        setAlert(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k.replace(/^input\./, ""), m[0]])));
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial ?? blank); setFile(null); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{id ? "Alterar verba" : "Registrar verba aprovada"}</DialogTitle>
          <DialogDescription>Quanto o cliente aprovou para anúncios, em que período e como aprovou. A equipe de tráfego do cliente é avisada.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Valor (R$)" required error={errors.amountCents}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 1.500,00…" value={v.amount} onChange={f("amount")} />
            </FormField>
            <FormField label="Plataforma" required error={errors.platform}>
              <Select value={v.platform} onValueChange={(x) => setV({ ...v, platform: x })}>
                <SelectTrigger className="w-full" aria-label="Plataforma"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{BUDGET_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Início do período" required error={errors.periodStart}>
              <Input type="date" value={v.periodStart} onChange={f("periodStart")} />
            </FormField>
            <FormField label="Fim do período" required error={errors.periodEnd}>
              <Input type="date" min={v.periodStart || undefined} value={v.periodEnd} onChange={f("periodEnd")} />
            </FormField>
            <FormField label="Quem aprovou no cliente" required error={errors.approvedBy}>
              <Input autoComplete="off" maxLength={120} placeholder="Ex.: Marcos (sócio)…" value={v.approvedBy} onChange={f("approvedBy")} />
            </FormField>
            <FormField label="Aprovado em" required error={errors.approvedOn}>
              <Input type="date" max={today} value={v.approvedOn} onChange={f("approvedOn")} />
            </FormField>
            <FormField label="Por onde aprovou" required error={errors.channel}>
              <Select value={v.channel} onValueChange={(x) => setV({ ...v, channel: x })}>
                <SelectTrigger className="w-full" aria-label="Por onde aprovou"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{BUDGET_CHANNELS.map((c) => <SelectItem key={c} value={c}>{BUDGET_CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Comprovante" optional error={errors.file} hint={hasProof && !file ? "Já tem comprovante; envie outro só para trocar." : "Print, áudio ou PDF, até 10 MB."}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" hidden aria-label="Comprovante da aprovação" accept="image/*,audio/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{file ? "Trocar arquivo" : "Escolher arquivo"}</Button>
                {file && <span className="min-w-0 truncate text-sm text-muted-foreground">{file.name}</span>}
              </div>
            </FormField>
          </div>
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} maxLength={1000} value={v.notes} onChange={f("notes")} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {id ? "Salvar verba" : "Registrar verba"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
