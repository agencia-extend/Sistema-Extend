"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { decideInPortal } from "@/features/portal/actions";
import { handleResult } from "@/lib/action-feedback";

/** Aprovar ou pedir alteração pela área do cliente (o texto é obrigatório para pedir alteração). */
export function PortalDecision({ taskId, title, preview }: { taskId: string; title: string; preview: boolean }) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<"aprovado" | "ajustes" | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (preview) {
    return <p className="rounded-lg border border-dashed bg-surface p-3 text-sm text-muted-foreground">Na prévia os botões ficam desligados: só a pessoa do cliente aprova.</p>;
  }

  const send = (decision: "aprovado" | "ajustes") => {
    if (decision === "ajustes" && comment.trim().length < 3) return setError("Descreva o que precisa mudar.");
    setError(null);
    setAlert(null);
    setMode(decision);
    start(async () => {
      const res = await decideInPortal({ taskId, decision, comment });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-3" role="group" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="sr-only">Sua decisão sobre {title}</h3>
      <FormAlert>{alert}</FormAlert>
      {mode === "ajustes" && (
        <FormField label="O que precisa mudar" required error={error ?? undefined}>
          <Textarea rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex.: trocar a música e deixar o logo maior no final…" />
        </FormField>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" disabled={pending} onClick={() => send("aprovado")}>
          {pending && mode === "aprovado" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ThumbsUp aria-hidden="true" />} Aprovar
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => (mode === "ajustes" ? send("ajustes") : setMode("ajustes"))}>
          {pending && mode === "ajustes" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ThumbsDown aria-hidden="true" />}{" "}
          {mode === "ajustes" ? "Enviar pedido de alteração" : "Pedir alteração"}
        </Button>
      </div>
    </div>
  );
}
