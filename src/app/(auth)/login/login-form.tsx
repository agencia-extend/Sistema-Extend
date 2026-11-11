"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { useHydrated } from "@/hooks/use-hydrated";
import { login } from "@/features/auth/actions";
import { loginSchema } from "@/features/auth/schemas";

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true, next },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await login(values);
      if (res && !res.ok) setServerError(res.message);
    });
  });

  return (
    // method="post" + botão travado até hidratar: um envio sem JavaScript não põe a senha na URL.
    <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{serverError}</FormAlert>
      <FormField label="E-mail" error={form.formState.errors.email?.message} required>
        <Input type="email" autoComplete="username" inputMode="email" autoFocus spellCheck={false} {...form.register("email")} />
      </FormField>
      <FormField label="Senha" error={form.formState.errors.password?.message} required>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <div className="flex min-h-11 items-center gap-2">
              <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="remember" className="font-normal">
                Manter conectado
              </Label>
            </div>
          )}
        />
        <Link href="/recuperar-senha" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending || !hydrated} className="w-full">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
