"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { formatCnpj } from "@/domain/privacy";
import { saveController } from "@/features/privacy/actions";
import { controllerSchema } from "@/features/privacy/schemas";
import type { Controller } from "@/features/privacy/queries";
import { handleResult } from "@/lib/action-feedback";

/** Quem responde pelos dados: aparece na Política de Privacidade pública. */
export function ControllerForm({ initial }: { initial: Controller }) {
  const [v, setV] = useState({
    legalName: initial.legalName ?? "",
    cnpj: initial.cnpj ?? "",
    address: initial.address ?? "",
    dpoName: initial.dpoName ?? "",
    dpoEmail: initial.dpoEmail ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: k === "cnpj" ? formatCnpj(e.target.value) : e.target.value });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = controllerSchema.safeParse(v);
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await saveController(v);
      if (!res.ok) {
        setError(res.message);
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
    });
  };

  return (
    <form onSubmit={save} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Razão social" optional error={errors.legalName}>
          <Input autoComplete="organization" value={v.legalName} onChange={set("legalName")} placeholder="Como está no CNPJ…" />
        </FormField>
        <FormField label="CNPJ" optional error={errors.cnpj}>
          <Input inputMode="numeric" autoComplete="off" value={v.cnpj} onChange={set("cnpj")} placeholder="Ex.: 12.345.678/0001-90…" />
        </FormField>
      </div>
      <FormField label="Endereço da sede" optional error={errors.address}>
        <Input autoComplete="street-address" value={v.address} onChange={set("address")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Encarregado de dados (DPO)" optional error={errors.dpoName} hint="Pessoa que responde pela privacidade.">
          <Input autoComplete="name" value={v.dpoName} onChange={set("dpoName")} />
        </FormField>
        <FormField label="E-mail para assuntos de privacidade" optional error={errors.dpoEmail} hint="Sem e-mail aqui, a política mostra hub.extend@agenciaextend.com.br.">
          <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} value={v.dpoEmail} onChange={set("dpoEmail")} />
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar dados do controlador"}
        </Button>
      </div>
    </form>
  );
}
