"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteTask } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteTask({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost"><Trash2 aria-hidden="true" /> Excluir</Button>}
      title="Excluir esta demanda?"
      description="Ela some dos quadros e das listas. O histórico fica na auditoria."
      confirmLabel="Excluir demanda"
      onConfirm={async () => {
        const res = await deleteTask({ id });
        if (handleResult(res)) router.push("/tarefas");
        return res.ok;
      }}
    />
  );
}
