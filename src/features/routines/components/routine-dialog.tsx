"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { WEEKDAY_LABEL } from "@/domain/tasks/repeat";
import { saveRoutine } from "@/features/routines/actions";
import type { RoutineInput } from "@/features/routines/schemas";
import { handleResult } from "@/lib/action-feedback";

type Opt = { id: string; name: string };
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Criar/editar uma rotina semanal de um serviço (ex.: legendas toda segunda). */
export function RoutineDialog({ routine, services, sectors, trigger }: { routine?: RoutineInput; services: Opt[]; sectors: Opt[]; trigger: ReactNode }) {
  const router = useRouter();
  const blank: RoutineInput = { serviceId: services[0]?.id ?? "", title: "", description: "", sectorId: sectors[0]?.id ?? "", weekday: 1, dueHour: 18, leadDays: 3, isActive: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<RoutineInput>(routine ?? blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const res = await saveRoutine(v);
      if (!res.ok) {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      handleResult(res);
      setOpen(false);
      router.refresh();
    });

  const pick = (label: string, value: string, items: { id: string; name: string }[], set: (x: string) => void) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(routine ?? blank); setError(null); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine?.id ? "Editar rotina" : "Nova rotina"}</DialogTitle>
          <DialogDescription>Toda semana, cada cliente ativo com o serviço ganha esta demanda, com a pessoa marcada no setor escolhido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome da demanda" required error={errors.title?.[0]}>
            <Input autoComplete="off" placeholder="Ex.: Legendas da semana…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Serviço do cliente">{pick("Serviço do cliente", v.serviceId, services, (x) => setV({ ...v, serviceId: x }))}</FormField>
            <FormField label="Setor responsável">{pick("Setor responsável", v.sectorId, sectors, (x) => setV({ ...v, sectorId: x }))}</FormField>
            <FormField label="Dia da semana">
              {pick("Dia da semana", String(v.weekday), WEEKDAY_LABEL.map((n, i) => ({ id: String(i), name: n })), (x) => setV({ ...v, weekday: Number(x) }))}
            </FormField>
            <FormField label="Até que horas">
              {pick("Até que horas", String(v.dueHour), HOURS.map((h) => ({ id: String(h), name: `${String(h).padStart(2, "0")}:00` })), (x) => setV({ ...v, dueHour: Number(x) }))}
            </FormField>
            <FormField label="Aparece quantos dias antes" error={errors.leadDays?.[0]} hint="Entre 0 e 6.">
              <Input type="number" inputMode="numeric" min={0} max={6} value={v.leadDays} onChange={(e) => setV({ ...v, leadDays: Number(e.target.value) })} />
            </FormField>
            <div className="flex items-center gap-2 self-end pb-2">
              <Switch id="routine-active" checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c })} />
              <label htmlFor="routine-active" className="text-sm">Rotina ligada</label>
            </div>
          </div>
          <FormField label="O que fazer" optional error={errors.description?.[0]}>
            <Textarea rows={3} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar rotina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
