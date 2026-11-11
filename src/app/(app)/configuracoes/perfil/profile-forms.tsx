"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { changePassword, updateProfile } from "@/features/profile/actions";
import { changePasswordSchema, profileSchema } from "@/features/profile/schemas";
import { handleResult } from "@/lib/action-feedback";

export function ProfileForm({ fullName, phone, jobTitle, sectors }: { fullName: string; phone: string; jobTitle: string | null; sectors: string[] }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName, phone },
  });
  const onSubmit = form.handleSubmit((v) => startTransition(async () => void handleResult(await updateProfile(v), form)));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField label="Nome" error={form.formState.errors.fullName?.message} required>
        <Input autoComplete="name" {...form.register("fullName")} />
      </FormField>
      <FormField label="Celular (WhatsApp)" optional hint="Com DDD. Usado para avisos da equipe." error={form.formState.errors.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="41 99999-0000" {...form.register("phone")} />
      </FormField>
      <dl className="grid gap-1 text-sm">
        <dt className="text-muted-foreground">Cargo e setores (definidos pelo administrador)</dt>
        <dd>{[jobTitle, sectors.join(", ")].filter(Boolean).join(" · ") || "Nenhum setor definido"}</dd>
      </dl>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Salvar perfil
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });
  const onSubmit = form.handleSubmit((v) =>
    startTransition(async () => {
      if (handleResult(await changePassword(v), form)) form.reset();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField label="Senha atual" error={form.formState.errors.current?.message} required>
        <PasswordInput autoComplete="current-password" {...form.register("current")} />
      </FormField>
      <FormField label="Nova senha" hint="Pelo menos 8 caracteres, com letras e números." error={form.formState.errors.password?.message} required>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField label="Repita a nova senha" error={form.formState.errors.confirm?.message} required>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </FormField>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Trocar senha
      </Button>
    </form>
  );
}
