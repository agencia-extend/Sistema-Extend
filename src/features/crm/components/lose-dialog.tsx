"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";

const COMMON = ["Preço acima do orçamento", "Parou de responder", "Fechou com outra agência", "Sem perfil para o serviço", "Adiou a decisão"];

/** Perder um lead exige o motivo (RF-CRM-02): alimenta o painel de motivos de perda. */
export function LoseDialog({
  open,
  leadName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirm = () => {
    if (reason.trim().length < 3) return void setError("Informe o motivo da perda.");
    start(async () => {
      const err = await onConfirm(reason.trim());
      if (err) setError(err);
      else setReason("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) { setReason(""); setError(null); onCancel(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Por que perdemos {leadName}?</DialogTitle>
          <DialogDescription>O motivo fica no histórico do lead e no painel comercial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos frequentes">
            {COMMON.map((c) => (
              <Button key={c} type="button" size="sm" variant={reason === c ? "default" : "outline"} onClick={() => { setReason(c); setError(null); }}>
                {c}
              </Button>
            ))}
          </div>
          <FormField label="Motivo da perda" required error={error ?? undefined}>
            <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Marcar como perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
