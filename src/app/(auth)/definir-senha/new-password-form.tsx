"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { useHydrated } from "@/hooks/use-hydrated";
import { setNewPassword } from "@/features/auth/actions";
import { newPasswordSchema } from "@/features/auth/schemas";

export function NewPasswordForm() {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.input<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await setNewPassword(values);
      if (res && !res.ok) setServerError(res.message);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{serverError}</FormAlert>
      <FormField label="Nova senha" error={form.formState.errors.password?.message} required>
        <PasswordInput autoComplete="new-password" autoFocus {...form.register("password")} />
      </FormField>
      <FormField label="Repita a nova senha" error={form.formState.errors.confirm?.message} required>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </FormField>
      <Button type="submit" size="lg" disabled={pending || !hydrated} className="w-full">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Salvando…" : "Salvar senha e entrar"}
      </Button>
    </form>
  );
}
