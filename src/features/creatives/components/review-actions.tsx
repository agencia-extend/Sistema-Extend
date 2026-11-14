"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, LoaderCircle, Rocket, Send, Truck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { reviewCreative } from "@/features/creatives/actions";
import { handleResult } from "@/lib/action-feedback";

type Decision = "ajustes" | "cliente" | "aprovado" | "entregue" | "no_ar";
const LABEL: Record<Decision, string> = { ajustes: "Pedir ajuste", cliente: "Aprovar e enviar ao cliente", aprovado: "Aprovar", entregue: "Marcar como entregue", no_ar: "Marcar como no ar" };
const ICON = { ajustes: Wrench, cliente: Send, aprovado: Check, entregue: Truck, no_ar: Rocket } as const;

/** Decisões de quem pediu (aprovação interna e próximos passos). */
export function ReviewActions({ taskId, actions }: { taskId: string; actions: Decision[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (decision: Decision, comment = "") =>
    start(async () => {
      if (handleResult(await reviewCreative({ taskId, decision, comment }))) router.refresh();
    });
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = ICON[a];
        if (a === "ajustes") return <FixDialog key={a} taskId={taskId} />;
        return (
          <Button key={a} variant={a === "cliente" || a === "aprovado" ? "default" : "outline"} disabled={pending} onClick={() => run(a)}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />} {LABEL[a]}
          </Button>
        );
      })}
    </div>
  );
}

function FixDialog({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = () => {
    if (comment.trim().length < 3) return void setError("Descreva o que precisa mudar.");
    start(async () => {
      const res = await reviewCreative({ taskId, decision: "ajustes", comment });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setComment(""); setError(null); } }}>
      <DialogTrigger asChild><Button variant="outline"><Wrench aria-hidden="true" /> Pedir ajuste</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir ajuste</DialogTitle>
          <DialogDescription>A mídia recebe o aviso com este comentário e envia uma nova versão.</DialogDescription>
        </DialogHeader>
        <FormAlert>{error}</FormAlert>
        <FormField label="O que precisa mudar" required>
          <Textarea rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button onClick={send} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : "Enviar ajuste"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
