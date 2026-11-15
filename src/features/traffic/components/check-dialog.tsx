"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { CHECK_ITEMS, CHECK_STATUSES, CHECK_STATUS_LABEL, type CheckKind, type CheckStatus } from "@/domain/traffic";
import { saveCheck } from "@/features/traffic/actions";
import type { CheckRow } from "@/features/traffic/queries";
import { checkSchema } from "@/features/traffic/schemas";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { DecisionsEditor, type DecisionDraft } from "./decisions-editor";

type ItemDraft = { status: CheckStatus | ""; note: string };
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success",
  problema: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger",
  na: "peer-checked:border-foreground/40 peer-checked:bg-muted",
};

/** Checklist diário (saldo, reprovações, gasto, entrega) ou semanal (criativos, públicos, custos e decisões). */
export function CheckDialog({ clientId, clientName, kind, periodOn, existing, trigger }: { clientId: string; clientName: string; kind: CheckKind; periodOn: string; existing?: CheckRow | null; trigger: ReactNode }) {
  const defs = CHECK_ITEMS[kind];
  const initial = () => ({
    items: Object.fromEntries(defs.map((d) => {
      const it = existing?.items.find((i) => i.key === d.key);
      return [d.key, { status: it?.status ?? "", note: it?.note ?? "" }];
    })) as Record<string, ItemDraft>,
    decisions: (existing?.decisions ?? []) as DecisionDraft[],
    notes: existing?.notes ?? "",
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const setItem = (key: string, patch: Partial<ItemDraft>) => setV((s) => ({ ...s, items: { ...s.items, [key]: { ...s.items[key], ...patch } } }));

  const save = () => {
    setAlert(null);
    const e: Record<string, string> = {};
    defs.forEach((d, i) => { if (!v.items[d.key].status) e[`items.${i}.status`] = "Marque este item."; });
    const parsed = checkSchema.safeParse({
      clientId, kind, periodOn,
      items: defs.map((d) => ({ key: d.key, status: v.items[d.key].status || undefined, note: v.items[d.key].note })),
      decisions: kind === "semanal" ? v.decisions.map((d) => ({ ...d, decision: d.decision || undefined })) : [],
      notes: v.notes,
    });
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    if (Object.keys(e).length || !parsed.success) {
      setErrors(e);
      setAlert("Revise os itens destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveCheck(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  const title = kind === "diario" ? `Checklist do dia ${br(periodOn)}` : `Checklist da semana de ${br(periodOn)}`;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial()); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {clientName}. Confira no Gerenciador e marque cada item; o que tiver problema vai para o histórico do cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <FormAlert>{alert}</FormAlert>
          {defs.map((d, i) => {
            const it = v.items[d.key];
            const statusError = errors[`items.${i}.status`];
            const noteError = errors[`items.${i}.note`];
            return (
              <fieldset key={d.key} className="grid gap-2" aria-describedby={statusError ? `${d.key}-err` : undefined}>
                <legend className="text-sm font-medium">{d.label}</legend>
                <p className="-mt-1 text-xs text-muted-foreground">{d.hint}</p>
                <div className="grid grid-cols-3 gap-2">
                  {CHECK_STATUSES.map((s) => (
                    <label key={s} className="relative">
                      <input type="radio" name={`${kind}-${d.key}`} value={s} checked={it.status === s} onChange={() => setItem(d.key, { status: s })} className="peer sr-only" />
                      <span className={cn("flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-muted/60", STATUS_STYLE[s])}>
                        {CHECK_STATUS_LABEL[s]}
                      </span>
                    </label>
                  ))}
                </div>
                {statusError && <p id={`${d.key}-err`} className="text-xs text-danger">{statusError}</p>}
                {it.status && it.status !== "ok" && (
                  <FormField label={it.status === "problema" ? `O que aconteceu em ${d.label.toLowerCase()}` : "Comentário"} required={it.status === "problema"} optional={it.status !== "problema"} error={noteError}>
                    <Input autoComplete="off" maxLength={500} placeholder={it.status === "problema" ? "Ex.: saldo para 1 dia, cartão recusado…" : "Ex.: conta sem campanha ativa…"} value={it.note} onChange={(e) => setItem(d.key, { note: e.target.value })} />
                  </FormField>
                )}
              </fieldset>
            );
          })}
          {kind === "semanal" && <DecisionsEditor value={v.decisions} onChange={(decisions) => setV((s) => ({ ...s, decisions }))} errors={errors} />}
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} maxLength={1000} value={v.notes} onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
