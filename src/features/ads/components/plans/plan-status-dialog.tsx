"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PLAN_STATUS_LABEL, nextStatuses, type PlanStatus } from "@/domain/ads/plans";
import { setPlanStatus } from "@/features/ads/plan-actions";
import { planStatusSchema } from "@/features/ads/plan-schemas";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const HELP: Record<PlanStatus, string> = {
  rascunho: "Volta a ser rascunho; a aprovação registrada sai.",
  aprovado: "O cliente aprovou o plano. Se a campanha ligada já estiver ativa, o plano vai direto para No ar.",
  no_ar: "A campanha está rodando. Com a campanha ligada, isso acontece sozinho quando ela fica ativa.",
  encerrado: "O plano terminou. A campanha não se liga mais sozinha.",
};

/** Mudar a situação do plano; aprovado pede quem aprovou no cliente e quando. */
export function PlanStatusDialog({ id, clientId, name, status, today, trigger }: { id: string; clientId: string; name: string; status: PlanStatus; today: string; trigger: ReactNode }) {
  const options = nextStatuses(status);
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<PlanStatus>(options[0]);
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedOn, setApprovedOn] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = () => {
    const parsed = planStatusSchema.safeParse({ id, clientId, status: next, approvedBy, approvedOn });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    setAlert(null);
    run(async () => {
      const res = await setPlanStatus(parsed.data);
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setNext(options[0]); setApprovedBy(""); setApprovedOn(today); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Situação do plano</DialogTitle>
          <DialogDescription className="break-all">{name} · hoje: {PLAN_STATUS_LABEL[status]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Passar para</legend>
            {options.map((s) => (
              <label key={s} className={cn("flex cursor-pointer gap-3 rounded-md border p-3 text-sm", next === s && "border-primary bg-primary/5")}>
                <input type="radio" name="plan-status" value={s} checked={next === s} onChange={() => setNext(s)} className="mt-0.5 accent-[var(--primary)]" />
                <span className="grid gap-0.5">
                  <span className="font-medium">{PLAN_STATUS_LABEL[s]}</span>
                  <span className="text-muted-foreground">{HELP[s]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {next === "aprovado" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Quem aprovou no cliente" required error={errors.approvedBy}>
                <Input autoComplete="off" maxLength={120} placeholder="Ex.: Marcos (sócio)…" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
              </FormField>
              <FormField label="Aprovado em" required error={errors.approvedOn}>
                <Input type="date" max={today} value={approvedOn} onChange={(e) => setApprovedOn(e.target.value)} />
              </FormField>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar situação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
