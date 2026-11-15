"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { REPORT_AREA_LABEL, type ReportArea } from "@/domain/reports";
import { saveReport } from "@/features/reports/actions";
import { reportSchema } from "@/features/reports/schemas";
import { handleResult } from "@/lib/action-feedback";

type Values = { sentOn: string; link: string; notes: string };

/** Registrar (ou corrigir) o envio do relatório da semana ao cliente. */
export function ReportDialog({ clientId, clientName, area, today, trigger, id, initial }: {
  clientId: string; clientName: string; area: ReportArea; today: string; trigger: ReactNode; id?: string; initial?: Values;
}) {
  const blank: Values = { sentOn: today, link: "", notes: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Values>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = () => {
    setAlert(null);
    const parsed = reportSchema.safeParse({ id, clientId, area, ...v });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    if (parsed.data.sentOn > today) {
      setErrors({ sentOn: "A data de envio não pode ser no futuro." });
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveReport(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial ?? blank); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? "Corrigir envio" : "Registrar envio"} do relatório de {REPORT_AREA_LABEL[area].toLowerCase()}</DialogTitle>
          <DialogDescription>{clientName}. Um relatório por semana; o retorno do cliente você registra depois.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <FormField label="Data do envio" required error={errors.sentOn}>
            <Input type="date" max={today} value={v.sentOn} onChange={(e) => setV({ ...v, sentOn: e.target.value })} />
          </FormField>
          <FormField label="Link do relatório" optional error={errors.link} hint="Reportei, PDF no Drive ou print enviado no grupo.">
            <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={500} placeholder="https://…" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} />
          </FormField>
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} maxLength={1000} placeholder="Ex.: enviado no grupo do cliente com áudio explicando os números…" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {id ? "Salvar correção" : "Registrar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
