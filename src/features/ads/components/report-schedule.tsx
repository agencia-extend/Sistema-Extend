"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FREQUENCY_LABEL, type ReportFrequency, type ReportSchedule } from "@/domain/ads/report";
import { setClientReportSchedule } from "@/features/ads/report-actions";
import { handleResult } from "@/lib/action-feedback";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Em palavras: "Toda segunda às 9h", "Todo dia 5 às 14h"… */
export function describeSchedule(s: ReportSchedule): string {
  if (s.frequency === "desligado") return "Não sai sozinho: envie pelo botão quando quiser.";
  const when = s.frequency === "diario" ? "Todo dia, com o dia anterior" : s.frequency === "semanal" ? "Toda segunda, com a semana passada" : `Todo dia ${s.monthDay}, com o mês passado`;
  return `${when}, às ${s.hour}h.`;
}

/** Envio automático do cliente no grupo de relatórios (RF-REL-01): frequência, dia do mês e horário. */
export function ReportScheduleForm({ clientId, schedule, canEdit }: { clientId: string; schedule: ReportSchedule; canEdit: boolean }) {
  const [v, setV] = useState(schedule);
  const [saved, setSaved] = useState(schedule);
  const [pending, run] = useTransition();
  const dirty = v.frequency !== saved.frequency || v.hour !== saved.hour || (v.frequency === "mensal" && v.monthDay !== saved.monthDay);

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Envio automático:</span> {describeSchedule(schedule)}
      </p>
    );
  }

  const save = () =>
    run(async () => {
      const res = await setClientReportSchedule({ clientId, ...v });
      handleResult(res);
      if (res.ok) setSaved(v);
    });

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Envio automático no grupo de relatórios</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="rel-freq">Frequência</Label>
          <Select value={v.frequency} onValueChange={(x) => setV((c) => ({ ...c, frequency: x as ReportFrequency }))} disabled={pending}>
            <SelectTrigger id="rel-freq" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(FREQUENCY_LABEL) as [ReportFrequency, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {v.frequency === "mensal" && (
          <div className="grid gap-1.5">
            <Label htmlFor="rel-dia">Dia do mês</Label>
            <Select value={String(v.monthDay)} onValueChange={(x) => setV((c) => ({ ...c, monthDay: Number(x) }))} disabled={pending}>
              <SelectTrigger id="rel-dia" className="w-full sm:w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {v.frequency !== "desligado" && (
          <div className="grid gap-1.5">
            <Label htmlFor="rel-hora">Horário</Label>
            <Select value={String(v.hour)} onValueChange={(x) => setV((c) => ({ ...c, hour: Number(x) }))} disabled={pending}>
              <SelectTrigger id="rel-hora" className="w-full sm:w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{describeSchedule(v)} O texto e o PDF vão juntos; o PDF fica na aba Relatórios.</p>
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={pending || !dirty}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar envio"}
        </Button>
      </div>
    </fieldset>
  );
}
