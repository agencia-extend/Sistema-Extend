"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { CHANGE_CATEGORIES, CHANGE_CATEGORY_LABEL, PLATFORMS, PLATFORM_LABEL } from "@/domain/traffic";
import { saveChange } from "@/features/traffic/actions";
import { changeSchema } from "@/features/traffic/schemas";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__nenhuma";
type Values = { platform: string; category: string; happenedOn: string; what: string; why: string };

/** Registrar ou corrigir uma alteração do tráfego: o que mudou, quando e por quê. */
export function ChangeDialog({ clientId, today, trigger, initial, id }: { clientId: string; today: string; trigger: ReactNode; initial?: Values; id?: string }) {
  const blank: Values = { platform: NONE, category: "", happenedOn: today, what: "", why: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Values>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = () => {
    setAlert(null);
    const parsed = changeSchema.safeParse({ id, clientId, platform: v.platform === NONE ? null : v.platform, category: v.category || undefined, happenedOn: v.happenedOn, what: v.what, why: v.why });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveChange(parsed.data);
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
          <DialogTitle>{id ? "Corrigir alteração" : "Registrar alteração"}</DialogTitle>
          <DialogDescription>Fica no histórico do cliente, para ninguém depender da memória de quem gerencia a conta.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Data" required error={errors.happenedOn}>
              <Input type="date" max={today} value={v.happenedOn} onChange={(e) => setV({ ...v, happenedOn: e.target.value })} />
            </FormField>
            <FormField label="Plataforma" optional>
              <Select value={v.platform} onValueChange={(x) => setV({ ...v, platform: x })}>
                <SelectTrigger className="w-full" aria-label="Plataforma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não se aplica</SelectItem>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tipo" required error={errors.category}>
              <Select value={v.category} onValueChange={(x) => setV({ ...v, category: x })}>
                <SelectTrigger className="w-full" aria-label="Tipo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{CHANGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CHANGE_CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="O que mudou" required error={errors.what}>
            <Input autoComplete="off" maxLength={500} placeholder="Ex.: Orçamento da campanha Leads de R$ 50 para R$ 80 por dia…" value={v.what} onChange={(e) => setV({ ...v, what: e.target.value })} />
          </FormField>
          <FormField label="Por quê" required error={errors.why}>
            <Textarea rows={3} maxLength={1000} placeholder="Ex.: CPL abaixo da meta há 5 dias; escalar com cuidado…" value={v.why} onChange={(e) => setV({ ...v, why: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {id ? "Salvar correção" : "Registrar alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
