"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { decideApproval } from "@/features/creatives/actions";

/** Aprovar ou pedir alteração (o texto é obrigatório para pedir alteração). */
export function DecisionForm({ token }: { token: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"aprovado" | "ajustes" | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const send = (decision: "aprovado" | "ajustes") => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Diga seu nome.";
    if (decision === "ajustes" && comment.trim().length < 3) e.comment = "Descreva o que precisa mudar.";
    setErrors(e);
    if (Object.keys(e).length) return;
    start(async () => {
      const res = await decideApproval({ token, decision, comment, name });
      setResult({ ok: res.ok, message: res.ok ? (res.message ?? "") : res.message });
      if (res.ok) router.refresh();
    });
  };

  if (result?.ok) return <p role="status" className="rounded-lg border border-success/40 bg-success-soft p-3 text-sm font-medium text-success">{result.message}</p>;

  return (
    <section aria-labelledby="decisao" className="grid gap-4 rounded-xl border bg-card p-4">
      <h2 id="decisao" className="text-base font-semibold">Sua decisão</h2>
      <FormAlert>{result && !result.ok ? result.message : null}</FormAlert>
      <FormField label="Seu nome" required error={errors.name}>
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      {mode === "ajustes" && (
        <FormField label="O que precisa mudar" required error={errors.comment}>
          <Textarea rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </FormField>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" disabled={pending} onClick={() => { setMode("aprovado"); send("aprovado"); }}>
          {pending && mode === "aprovado" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ThumbsUp aria-hidden="true" />} Aprovar
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => (mode === "ajustes" ? send("ajustes") : setMode("ajustes"))}>
          {pending && mode === "ajustes" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ThumbsDown aria-hidden="true" />} {mode === "ajustes" ? "Enviar pedido de alteração" : "Pedir alteração"}
        </Button>
      </div>
    </section>
  );
}
