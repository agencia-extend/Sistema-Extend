"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormAlert, FormField } from "@/components/app/form-field";
import type { AlertLimits } from "@/domain/ads/alerts";
import { centsToInput } from "@/domain/shared/money";
import { resetAlertLimits, saveAlertLimits } from "@/features/alerts/actions";
import { limitsSchema } from "@/features/alerts/schemas";
import { handleResult } from "@/lib/action-feedback";

type V = { fundsDays: string; fundsMin: string; dailySpendMax: string; noDelivery: boolean; fatigueEnabled: boolean; fatigueFrequency: string; fatigueCtrDrop: string };

const toForm = (l: AlertLimits): V => ({
  fundsDays: String(l.fundsDays),
  fundsMin: centsToInput(l.fundsMinCents),
  dailySpendMax: centsToInput(l.dailySpendMaxCents),
  noDelivery: l.noDelivery,
  fatigueEnabled: l.fatigueEnabled,
  fatigueFrequency: String(l.fatigueFrequency).replace(".", ","),
  fatigueCtrDrop: String(l.fatigueCtrDrop),
});

/**
 * Limites dos alertas (RF-ALE-01). clientId null: padrão da agência. Com cliente: limites próprios, que substituem o
 * padrão inteiro; "Usar o padrão da agência" apaga os limites próprios.
 */
export function LimitsDialog({ clientId, clientName, limits, custom, trigger }: { clientId: string | null; clientName?: string; limits: AlertLimits; custom: boolean; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<V>(() => toForm(limits));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement>) => setV((c) => ({ ...c, [k]: e.target.value }));
  const formId = `limits-${clientId ?? "agencia"}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const parsed = limitsSchema.safeParse({ clientId, ...v });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      setErrors(out);
      return setAlert("Revise os campos destacados.");
    }
    setErrors({});
    run(async () => {
      const res = await saveAlertLimits({ clientId, ...v });
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  const reset = () =>
    run(async () => {
      if (!clientId) return;
      const res = await resetAlertLimits({ clientId });
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(toForm(limits)); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{clientId ? `Limites dos alertas: ${clientName ?? "cliente"}` : "Limites padrão dos alertas"}</DialogTitle>
          <DialogDescription>
            {clientId
              ? custom ? "Este cliente tem limites próprios." : "Este cliente usa o padrão da agência. Salvar cria limites próprios para ele."
              : "Valem para os clientes sem limites próprios. Cada cliente pode ter os dele, na aba Anúncios."}
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={save} className="grid gap-5" noValidate>
          <FormAlert>{alert}</FormAlert>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Saldo (contas pré-pagas)</legend>
            <FormField label="Avisar com saldo para (dias)" required error={errors.fundsDays} hint="0 não avisa por dias.">
              <Input inputMode="numeric" autoComplete="off" value={v.fundsDays} onChange={set("fundsDays")} />
            </FormField>
            <FormField label="Ou abaixo de (R$)" optional error={errors.fundsMin}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 100,00…" value={v.fundsMin} onChange={set("fundsMin")} />
            </FormField>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Gasto e entrega</legend>
            <FormField label="Gasto do dia acima de (R$)" optional error={errors.dailySpendMax} hint="Soma das contas ligadas no dia.">
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 300,00…" value={v.dailySpendMax} onChange={set("dailySpendMax")} />
            </FormField>
            <label className="flex items-center justify-between gap-3 self-start rounded-lg border p-3 text-sm sm:mt-6">
              Avisar campanha ativa sem gasto ontem
              <Switch checked={v.noDelivery} onCheckedChange={(x) => setV((c) => ({ ...c, noDelivery: x }))} />
            </label>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Criativo cansado</legend>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:col-span-2">
              Avisar quando o criativo cansar
              <Switch checked={v.fatigueEnabled} onCheckedChange={(x) => setV((c) => ({ ...c, fatigueEnabled: x }))} />
            </label>
            {v.fatigueEnabled && (
              <>
                <FormField label="Frequência em 7 dias a partir de" required error={errors.fatigueFrequency}>
                  <Input inputMode="decimal" autoComplete="off" value={v.fatigueFrequency} onChange={set("fatigueFrequency")} />
                </FormField>
                <FormField label="E CTR menor em (%)" required error={errors.fatigueCtrDrop} hint="Últimos 3 dias contra os 7 anteriores.">
                  <Input inputMode="numeric" autoComplete="off" value={v.fatigueCtrDrop} onChange={set("fatigueCtrDrop")} />
                </FormField>
              </>
            )}
          </fieldset>
        </form>
        <DialogFooter className="gap-2">
          {clientId && custom && (
            <Button type="button" variant="outline" disabled={pending} onClick={reset}>Usar o padrão da agência</Button>
          )}
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar limites
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
