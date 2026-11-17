"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { saveWhatsappServer } from "@/features/whatsapp/actions";
import { serverSchema } from "@/features/whatsapp/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Endereço e chave do servidor WAHA. A chave nunca volta para a tela: para trocar, cole de novo. */
export function ServerForm({ baseUrl, hasServer }: { baseUrl: string | null; hasServer: boolean }) {
  const [url, setUrl] = useState(baseUrl ?? "");
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const parsed = serverSchema.safeParse({ baseUrl: url, apiKey: key });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      return setErrors(out);
    }
    setErrors({});
    run(async () => {
      const res = await saveWhatsappServer(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setKey("");
    });
  };

  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <FormAlert>{alert}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Endereço do servidor" required error={errors.baseUrl} hint="O endereço do túnel (máquina local) ou da VPS.">
          <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://whatsapp.agenciaextend.com.br…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </FormField>
        <FormField label="Chave da API (WAHA_API_KEY)" required error={errors.apiKey} hint={hasServer ? "Já salva e cifrada. Cole de novo só para trocar." : "Fica cifrada no banco."}>
          <Input type="password" autoComplete="off" spellCheck={false} placeholder={hasServer ? "••••••••••••" : "Cole a chave…"} value={key} onChange={(e) => setKey(e.target.value)} />
        </FormField>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Testar e salvar
      </Button>
    </form>
  );
}
