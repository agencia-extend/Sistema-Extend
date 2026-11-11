"use client";

import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { undoImport } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

export function UndoImportButton({ id, count }: { id: string; count: number }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" size="sm"><Undo2 aria-hidden="true" /> Desfazer</Button>}
      title="Desfazer esta importação?"
      description={`Os ${count} cliente(s) desta importação serão removidos, com tudo o que foi cadastrado neles desde então.`}
      confirmLabel="Desfazer importação"
      onConfirm={async () => handleResult(await undoImport({ id }))}
    />
  );
}
