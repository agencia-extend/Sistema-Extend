"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { FEEDBACKS, FEEDBACK_LABEL, REPORT_AREA_LABEL, nextStep, type Feedback, type ReportArea } from "@/domain/reports";
import { saveFeedback } from "@/features/reports/actions";
import { feedbackSchema } from "@/features/reports/schemas";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const STYLE: Record<Feedback, string> = {
  positivo: "peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success",
  negativo: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger",
  sem_retorno: "peer-checked:border-warning peer-checked:bg-warning-soft peer-checked:text-warning",
};
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Retorno do cliente ao relatório: positivo, negativo (com o motivo) ou sem retorno (gera a ligação). */
export function FeedbackDialog({ id, clientId, clientName, area, weekOn, initial, trigger }: {
  id: string; clientId: string; clientName: string; area: ReportArea; weekOn: string; initial?: { feedback: Feedback | null; note: string | null }; trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | "">(initial?.feedback ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = () => {
    setAlert(null);
    const parsed = feedbackSchema.safeParse({ id, clientId, feedback: feedback || undefined, feedbackNote: note });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveFeedback(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setFeedback(initial?.feedback ?? ""); setNote(initial?.note ?? ""); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Retorno do cliente</DialogTitle>
          <DialogDescription>
            {clientName}: relatório de {REPORT_AREA_LABEL[area].toLowerCase()} da semana de {br(weekOn)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <fieldset className="grid gap-2" aria-describedby={errors.feedback ? "feedback-err" : feedback ? "feedback-next" : undefined}>
            <legend className="mb-1 text-sm font-medium">Como o cliente recebeu</legend>
            <div className="grid grid-cols-3 gap-2">
              {FEEDBACKS.map((f) => (
                <label key={f} className="relative">
                  <input type="radio" name="feedback" value={f} checked={feedback === f} onChange={() => setFeedback(f)} className="peer sr-only" />
                  <span className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-muted/60", STYLE[f])}>
                    {FEEDBACK_LABEL[f]}
                  </span>
                </label>
              ))}
            </div>
            {errors.feedback ? (
              <p id="feedback-err" className="text-xs text-danger">{errors.feedback}</p>
            ) : feedback ? (
              <p id="feedback-next" className="text-xs text-muted-foreground" aria-live="polite">{nextStep(area, feedback)}</p>
            ) : null}
          </fieldset>
          {feedback && (
            <FormField
              label={feedback === "negativo" ? "O que o cliente achou ruim" : "O que o cliente disse"}
              required={feedback === "negativo"}
              optional={feedback !== "negativo"}
              error={errors.feedbackNote}
            >
              <Textarea rows={3} maxLength={1000} placeholder={feedback === "negativo" ? "Ex.: poucos leads no WhatsApp esta semana…" : "Ex.: gostou do resultado, perguntou sobre aumentar a verba…"} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
