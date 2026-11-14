"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { useHydrated } from "@/hooks/use-hydrated";
import { acceptInvitation } from "@/features/admin/invitations";
import { acceptInvitationSchema } from "@/features/auth/schemas";

export function AcceptInvitationForm({ token, email, defaultName }: { token: string; email: string; defaultName: string }) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.input<typeof acceptInvitationSchema>>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { token, fullName: defaultName, password: "", acceptPolicy: false as unknown as true },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await acceptInvitation(values);
      if (res && !res.ok) setServerError(res.message);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{serverError}</FormAlert>
      <FormField label="E-mail">
        <Input type="email" name="username" autoComplete="username" value={email} readOnly />
      </FormField>
      <FormField label="Seu nome" error={form.formState.errors.fullName?.message} required>
        <Input autoComplete="name" autoFocus {...form.register("fullName")} />
      </FormField>
      <FormField label="Crie uma senha" hint="Pelo menos 8 caracteres, com letras e números." error={form.formState.errors.password?.message} required>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <div className="grid gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="acceptPolicy"
            render={({ field }) => (
              <Checkbox
                id="aceite"
                className="mt-0.5"
                checked={Boolean(field.value)}
                onCheckedChange={(v) => field.onChange(v === true)}
                aria-invalid={Boolean(form.formState.errors.acceptPolicy)}
                aria-describedby={form.formState.errors.acceptPolicy ? "aceite-erro" : undefined}
              />
            )}
          />
          <label htmlFor="aceite" className="text-sm leading-5">
            Li e concordo com a{" "}
            <Link href="/privacidade" target="_blank" className="font-medium text-brand underline underline-offset-2">Política de Privacidade</Link> e os{" "}
            <Link href="/termos" target="_blank" className="font-medium text-brand underline underline-offset-2">Termos de uso</Link>.
          </label>
        </div>
        {form.formState.errors.acceptPolicy && (
          <p id="aceite-erro" className="text-sm text-danger">{form.formState.errors.acceptPolicy.message}</p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending || !hydrated} className="w-full">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Ativando acesso…" : "Aceitar convite e entrar"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Este link é pessoal e funciona uma única vez. Se você não esperava este convite, ignore.
      </p>
    </form>
  );
}
