"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { updateUserAccess } from "@/features/admin/actions";
import { updateUserAccessSchema } from "@/features/admin/schemas";
import { handleResult } from "@/lib/action-feedback";
import { SectorPicker } from "../sector-picker";

type Option = { id: string; name: string };

export function AccessForm({
  userId,
  roles,
  sectors,
  defaults,
  disabled,
}: {
  userId: string;
  roles: Option[];
  sectors: Option[];
  defaults: { roleId: string; sectorIds: string[]; jobTitle: string };
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof updateUserAccessSchema>>({
    resolver: zodResolver(updateUserAccessSchema),
    defaultValues: { userId, ...defaults },
  });
  const onSubmit = form.handleSubmit((v) => startTransition(async () => void handleResult(await updateUserAccess(v), form)));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="roleId"
          render={({ field, fieldState }) => (
            <FormField label="Papel" error={fieldState.error ? "Escolha um papel." : undefined} required>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um papel" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        />
        <FormField label="Cargo" optional error={form.formState.errors.jobTitle?.message}>
          <Input placeholder="Ex.: Editora de vídeo…" disabled={disabled} {...form.register("jobTitle")} />
        </FormField>
      </div>
      <Controller
        control={form.control}
        name="sectorIds"
        render={({ field }) => <SectorPicker sectors={sectors} value={field.value} onChange={field.onChange} disabled={disabled} />}
      />
      <Button type="submit" disabled={pending || disabled} className="justify-self-start">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Salvar acesso
      </Button>
    </form>
  );
}
