"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setCadenceActive } from "@/features/crm/cadence-actions";
import { handleResult } from "@/lib/action-feedback";

export function CadenceToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, run] = useTransition();
  return (
    <Switch checked={active} disabled={pending} aria-label={`${active ? "Desativar" : "Ativar"} ${name}`}
      onCheckedChange={(on) => run(async () => void handleResult(await setCadenceActive({ id, active: on })))} />
  );
}
