"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, ThumbsDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormField } from "@/components/app/form-field";
import { deleteProposal, refuseProposal } from "@/features/proposals/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeleteProposal({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost"><Trash2 aria-hidden="true" /> Excluir rascunho</Button>}
      title="Excluir este rascunho?"
      description="A proposta ainda não foi enviada. Ela e as versões salvas serão apagadas."
      confirmLabel="Excluir rascunho"
      onConfirm={async () => {
        const ok = handleResult(await deleteProposal({ id }));
        if (ok) router.push("/comercial/propostas");
        return ok;
      }}
    />
  );
}

/** O cliente disse não (por mensagem ou ligação): registra o motivo. */
export function RefuseProposal({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirm = () => {
    if (reason.trim().length < 3) return void setError("Informe o motivo da recusa.");
    start(async () => {
      const res = await refuseProposal({ id, reason });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild><Button variant="outline"><ThumbsDown aria-hidden="true" /> Marcar como recusada</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Por que o cliente recusou?</DialogTitle>
          <DialogDescription>O link deixa de aceitar o aceite. Para tentar de novo, edite e envie outra vez.</DialogDescription>
        </DialogHeader>
        <FormField label="Motivo" required error={error ?? undefined}>
          <Textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={confirm} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Marcar como recusada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
