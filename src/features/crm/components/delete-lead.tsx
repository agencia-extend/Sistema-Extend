"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteLead } from "@/features/crm/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteLead({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost"><Trash2 aria-hidden="true" /> Excluir</Button>}
      title={`Excluir ${name}?`}
      description="O lead e todo o histórico dele saem do comercial. Para registrar que não fechou, prefira mover para Perdido com o motivo."
      confirmLabel="Excluir lead"
      onConfirm={async () => {
        const ok = handleResult(await deleteLead({ id }));
        if (ok) router.push("/comercial/leads");
        return ok;
      }}
    />
  );
}
