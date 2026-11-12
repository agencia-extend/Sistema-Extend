"use client";

import { useEffect, useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { setStepDefault } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";

const AUTO = "__auto";

/** Responsável padrão de cada etapa neste cliente (sobrepõe a pessoa marcada no setor). */
export function StepDefaults({ clientId, steps, team }: { clientId: string; steps: { id: string; name: string }[]; team: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!open) return;
    createClient()
      .from("client_step_defaults")
      .select("step_id, profile_id")
      .eq("client_id", clientId)
      .then(({ data }) => setMap(Object.fromEntries((data ?? []).map((d) => [d.step_id, d.profile_id]))));
  }, [open, clientId]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Users aria-hidden="true" /> Responsáveis por etapa</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Responsáveis por etapa</DialogTitle>
          <DialogDescription>Quando um card entra na etapa, vai para esta pessoa. “Automático” usa quem está marcado no setor da etapa na equipe do cliente.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{s.name}</span>
              <Select
                value={map[s.id] ?? AUTO}
                disabled={pending}
                onValueChange={(v) => {
                  setMap({ ...map, [s.id]: v === AUTO ? "" : v });
                  startTransition(async () => void handleResult(await setStepDefault({ clientId, stepId: s.id, profileId: v === AUTO ? null : v })));
                }}
              >
                <SelectTrigger className="w-48" aria-label={`Responsável por ${s.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>Automático</SelectItem>
                  {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
