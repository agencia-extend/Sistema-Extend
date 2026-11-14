"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteContract } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteContractButton({ id, clientId, label }: { id: string; clientId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Excluir o contrato de ${label}`}><Trash2 /></Button>}
      title="Excluir este contrato?"
      description="Use só para corrigir um registro feito por engano. O cadastro do cliente passa a usar o contrato mais recente que sobrar."
      confirmLabel="Excluir contrato"
      onConfirm={async () => {
        if (handleResult(await deleteContract({ id, clientId }))) router.refresh();
      }}
    />
  );
}
