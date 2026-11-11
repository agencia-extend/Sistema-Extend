"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteFile } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteFileButton({ id, clientId, name }: { id: string; clientId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" className="size-9" aria-label={`Excluir ${name}`}><Trash2 /></Button>}
      title="Excluir arquivo?"
      description={`“${name}” será apagado do sistema. Esta ação não pode ser desfeita.`}
      confirmLabel="Excluir arquivo"
      onConfirm={async () => handleResult(await deleteFile({ id, clientId }))}
    />
  );
}
