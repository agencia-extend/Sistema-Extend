"use client";

import { useState, useTransition } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { acceptProposal } from "@/features/proposals/actions";

/** Aceite (RF-PRO-04): nome completo + confirmação. Uma vez aceita, a página mostra o registro. */
export function AcceptForm({ token, total }: { token: string; total: string }) {
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; confirm?: string }>({});
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (name.trim().length < 3) errs.name = "Escreva seu nome completo.";
    if (!confirm) errs.confirm = "Confirme que leu e aceita a proposta.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    start(async () => {
      const res = await acceptProposal({ token, name, confirm });
      setResult({ ok: res.ok, message: res.ok ? (res.message ?? "") : res.message });
    });
  };

  if (result?.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-success/40 bg-success-soft p-4 text-sm font-medium text-success">
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {result.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="aceitar">
      <h2 id="aceitar" className="font-heading text-xl font-semibold">Aceitar proposta</h2>
      <FormAlert>{result && !result.ok ? result.message : null}</FormAlert>
      <FormField label="Seu nome completo" required error={errors.name}>
        <Input autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <div className="grid gap-1">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? "confirm-erro" : undefined} />
          <span>Li a proposta e aceito os serviços e o investimento de {total}.</span>
        </label>
        {errors.confirm && <p id="confirm-erro" className="text-sm text-danger">{errors.confirm}</p>}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="sm:justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CircleCheck aria-hidden="true" />} Aceitar proposta
      </Button>
    </form>
  );
}
