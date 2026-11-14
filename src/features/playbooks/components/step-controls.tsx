"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deletePlaybook, deleteStep, moveStep } from "@/features/playbooks/actions";
import { handleResult } from "@/lib/action-feedback";

export function StepControls({ id, playbookId, title, first, last }: { id: string; playbookId: string; title: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (direction: "up" | "down") => start(async () => { if (handleResult(await moveStep({ id, playbookId, direction }))) router.refresh(); });
  return (
    <div className="flex gap-0.5">
      <Button variant="ghost" size="icon" disabled={first || pending} onClick={() => move("up")} aria-label={`Subir a etapa ${title}`}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" disabled={last || pending} onClick={() => move("down")} aria-label={`Descer a etapa ${title}`}><ArrowDown /></Button>
      <ConfirmDialog
        trigger={<Button variant="ghost" size="icon" aria-label={`Excluir a etapa ${title}`}><Trash2 /></Button>}
        title="Excluir esta etapa?"
        description="Vale para as próximas vezes que o playbook for aplicado. O que já foi criado nos clientes continua."
        confirmLabel="Excluir etapa"
        onConfirm={async () => { if (handleResult(await deleteStep({ id, playbookId }))) router.refresh(); }}
      />
    </div>
  );
}

export function DeletePlaybookButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" aria-label={`Excluir o playbook ${name}`}><Trash2 aria-hidden="true" /> Excluir</Button>}
      title="Excluir este playbook?"
      description="As demandas e marcos já criados nos clientes continuam. Para só parar de usar, prefira arquivar."
      confirmLabel="Excluir playbook"
      onConfirm={async () => { if (handleResult(await deletePlaybook({ id }))) router.push("/playbooks"); }}
    />
  );
}
