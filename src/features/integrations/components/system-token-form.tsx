"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { saveMetaSystemToken } from "@/features/integrations/actions";
import { systemTokenSchema } from "@/features/integrations/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Token do usuário do sistema do BM da Extend: a forma recomendada (não vence a cada 60 dias). */
export function SystemTokenForm({ replacing = false }: { replacing?: boolean }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const submit = () => {
    setAlert(null);
    const parsed = systemTokenSchema.safeParse({ token });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    run(async () => {
      const res = await saveMetaSystemToken(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        return;
      }
      handleResult(res);
      setToken("");
    });
  };

  return (
    <div className="grid gap-3">
      <FormAlert>{alert}</FormAlert>
      <FormField
        label={replacing ? "Novo token do usuário do sistema" : "Token do usuário do sistema"}
        required
        error={error}
        hint="Gerado no BM da Extend em Configurações do negócio › Usuários do sistema › Gerar token. O sistema guarda cifrado e nunca mostra de novo."
      >
        <Textarea
          rows={3}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
          placeholder="EAAG…"
        />
      </FormField>
      <div>
        <Button onClick={submit} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {replacing ? "Trocar token" : "Salvar token e buscar contas"}
        </Button>
      </div>
    </div>
  );
}
