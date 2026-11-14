"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteRecording } from "@/features/schedule/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteRecordingButton({ id, clientId, label }: { id: string; clientId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Excluir a gravação de ${label}`}><Trash2 /></Button>}
      title="Excluir esta gravação?"
      description="O registro some daqui. Os conteúdos continuam com a data e o link dos brutos que receberam."
      confirmLabel="Excluir gravação"
      onConfirm={async () => {
        if (handleResult(await deleteRecording({ id, clientId }))) router.refresh();
      }}
    />
  );
}
