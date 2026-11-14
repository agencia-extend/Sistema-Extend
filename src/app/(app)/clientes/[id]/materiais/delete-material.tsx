"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteMaterial } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteMaterialButton({ id, clientId, title }: { id: string; clientId: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Excluir o material ${title}`}><Trash2 /></Button>}
      title="Excluir este material?"
      description="Se ele tem um arquivo enviado, o arquivo também é apagado. Links do Drive continuam no Drive."
      confirmLabel="Excluir material"
      onConfirm={async () => {
        if (handleResult(await deleteMaterial({ id, clientId }))) router.refresh();
      }}
    />
  );
}
