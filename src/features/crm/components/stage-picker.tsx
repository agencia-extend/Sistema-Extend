"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moveLead } from "@/features/crm/actions";
import type { Stage } from "@/features/crm/queries";
import { LoseDialog } from "./lose-dialog";

/** Trocar a etapa pela página do lead (mesma regra do quadro: perdido pede motivo). */
export function StagePicker({ leadId, leadName, stageId, stages, canHandoff, won }: { leadId: string; leadName: string; stageId: string; stages: Stage[]; canHandoff: boolean; won: boolean }) {
  const router = useRouter();
  const [losing, setLosing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (to: string, reason = "") =>
    new Promise<string | null>((resolve) =>
      start(async () => {
        const res = await moveLead({ id: leadId, stageId: to, reason });
        if (!res.ok) {
          toast.error(res.message);
          return resolve(res.message);
        }
        resolve(null);
        const stage = stages.find((s) => s.id === to)!;
        if (stage.kind === "ganho" && canHandoff && !won) {
          toast.success("Ganho! Registre o fechamento para o cliente entrar em onboarding.");
          router.push(`/clientes/novo?lead=${leadId}`);
        } else {
          toast.success(`Movido para ${stage.name}.`);
          router.refresh();
        }
      }),
    );

  return (
    <>
      <Select
        value={stageId}
        disabled={pending}
        onValueChange={(to) => {
          if (to === stageId) return;
          if (stages.find((s) => s.id === to)?.kind === "perdido") setLosing(to);
          else void go(to);
        }}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label="Etapa do funil"><SelectValue /></SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" /> {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LoseDialog
        open={Boolean(losing)}
        leadName={leadName}
        onCancel={() => setLosing(null)}
        onConfirm={async (reason) => {
          const err = await go(losing!, reason);
          if (!err) setLosing(null);
          return err;
        }}
      />
    </>
  );
}
