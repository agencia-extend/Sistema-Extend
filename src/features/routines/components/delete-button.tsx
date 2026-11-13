"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteRoutine, deleteTemplate } from "@/features/routines/actions";
import { handleResult } from "@/lib/action-feedback";

/** Excluir rotina ou modelo, com confirmação. */
export function DeleteButton({ kind, id, name }: { kind: "rotina" | "modelo"; id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="icon" aria-label={`Excluir ${kind}: ${name}`}><Trash2 /></Button>}
      title={kind === "rotina" ? "Excluir esta rotina?" : "Excluir este modelo?"}
      description={kind === "rotina" ? `“${name}” deixa de ser criada nas próximas semanas. As demandas que já existem continuam.` : `“${name}” some da lista de modelos. Demandas criadas com ele continuam.`}
      confirmLabel={kind === "rotina" ? "Excluir rotina" : "Excluir modelo"}
      onConfirm={async () => {
        const ok = handleResult(kind === "rotina" ? await deleteRoutine({ id }) : await deleteTemplate({ id }));
        if (ok) router.refresh();
        return ok;
      }}
    />
  );
}
