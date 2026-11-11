"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, UserPlus } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { inviteUser } from "@/features/admin/invitations";
import { inviteSchema } from "@/features/admin/schemas";
import { handleResult } from "@/lib/action-feedback";
import { SectorPicker } from "./sector-picker";

type Option = { id: string; name: string };

export function InviteDialog({ roles, sectors }: { roles: Option[]; sectors: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", fullName: "", roleId: "", sectorIds: [] },
  });

  const onSubmit = form.handleSubmit((v) =>
    startTransition(async () => {
      if (handleResult(await inviteUser(v), form)) {
        form.reset();
        setOpen(false);
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" /> Convidar pessoa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>A pessoa recebe um e-mail com um link pessoal (válido por 7 dias) para criar a senha.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Nome" error={form.formState.errors.fullName?.message} required>
            <Input autoComplete="off" {...form.register("fullName")} />
          </FormField>
          <FormField label="E-mail" error={form.formState.errors.email?.message} required>
            <Input type="email" inputMode="email" autoComplete="off" spellCheck={false} {...form.register("email")} />
          </FormField>
          <Controller
            control={form.control}
            name="roleId"
            render={({ field, fieldState }) => (
              <FormField label="Papel" hint="Define o que a pessoa pode ver e fazer." error={fieldState.error ? "Escolha um papel." : undefined} required>
                <Select value={field.value} onValueChange={field.onChange}>
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
          <Controller
            control={form.control}
            name="sectorIds"
            render={({ field }) => <SectorPicker sectors={sectors} value={field.value ?? []} onChange={field.onChange} />}
          />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="invite-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
