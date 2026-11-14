"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { REQUEST_KIND_LABEL, type RequestKind } from "@/domain/privacy";
import { answerPrivacyRequest } from "@/features/privacy/actions";
import { answerSchema } from "@/features/privacy/schemas";
import { handleResult } from "@/lib/action-feedback";

type Status = "em_andamento" | "concluido" | "recusado";

/** Responder um pedido: a resposta vai para a pessoa como aviso e fica no perfil dela. */
export function AnswerDialog({ id, person, kind, details }: { id: string; person: string; kind: RequestKind; details: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("concluido");
  const [response, setResponse] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const parsed = answerSchema.safeParse({ id, status, response });
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await answerPrivacyRequest(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setStatus("concluido"); setResponse(""); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Responder o pedido de ${person}`}>Responder</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responder pedido de {person}</DialogTitle>
          <DialogDescription>{REQUEST_KIND_LABEL[kind]}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {details && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm leading-6 break-words whitespace-pre-line">{details}</p>}
          <FormAlert>{error}</FormAlert>
          <FormField label="Situação" required>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="w-full" aria-label="Situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concluido">Atendido</SelectItem>
                <SelectItem value="recusado">Não pode ser atendido (explicar o motivo)</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Resposta para a pessoa" required={status !== "em_andamento"} optional={status === "em_andamento"} error={errors.response} hint="Diga o que foi feito ou por que o dado precisa ser mantido (ex.: obrigação legal).">
            <Textarea rows={4} maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : status === "em_andamento" ? "Marcar em andamento" : "Enviar resposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
