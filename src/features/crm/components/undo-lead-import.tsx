"use client";

import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { undoLeadImport } from "@/features/crm/actions";
import { handleResult } from "@/lib/action-feedback";

export function UndoLeadImport({ id, count }: { id: string; count: number }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" size="sm"><Undo2 aria-hidden="true" /> Desfazer</Button>}
      title="Desfazer esta importação?"
      description={`Os ${count} lead(s) desta importação saem do funil, com o histórico registrado neles. Leads que já viraram cliente ficam.`}
      confirmLabel="Desfazer importação"
      onConfirm={async () => handleResult(await undoLeadImport({ id }))}
    />
  );
}
