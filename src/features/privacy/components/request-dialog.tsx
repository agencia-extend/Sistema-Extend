"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { REQUEST_KINDS, REQUEST_KIND_LABEL, type RequestKind } from "@/domain/privacy";
import { createPrivacyRequest } from "@/features/privacy/actions";
import { requestSchema } from "@/features/privacy/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Pedido do titular sobre os próprios dados (art. 18 da LGPD). */
export function RequestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RequestKind | "">("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    setError(null);
    const parsed = requestSchema.safeParse({ kind: kind || undefined, details });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    start(async () => {
      const res = await createPrivacyRequest(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setKind(""); setDetails(""); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline">Fazer um pedido sobre meus dados</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido sobre meus dados</DialogTitle>
          <DialogDescription>Quem cuida da privacidade na agência recebe o pedido e responde em até 15 dias. Você é avisado aqui no sistema.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="O que você quer" required error={errors.kind}>
            <Select value={kind} onValueChange={(v) => setKind(v as RequestKind)}>
              <SelectTrigger className="w-full" aria-label="O que você quer"><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>{REQUEST_KINDS.map((k) => <SelectItem key={k} value={k}>{REQUEST_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Detalhes" optional error={errors.details} hint="Ex.: qual dado está errado e qual é o certo.">
            <Textarea rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : "Enviar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
