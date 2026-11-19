"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deletePlan } from "@/features/ads/plan-actions";
import { handleResult } from "@/lib/action-feedback";

export function PlanDelete({ id, clientId, name }: { id: string; clientId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" className="text-danger" aria-label={`Apagar o plano ${name}`}><Trash2 /></Button>}
      title="Apagar este plano?"
      description="O plano sai da lista. A campanha na conta não muda."
      confirmLabel="Apagar"
      onConfirm={async () => handleResult(await deletePlan({ id, clientId }))}
    />
  );
}
