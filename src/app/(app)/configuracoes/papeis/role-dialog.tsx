"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { saveRole } from "@/features/admin/actions";
import { roleSchema } from "@/features/admin/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Criar papel novo (sem id) ou editar nome/descrição (com id). */
export function RoleDialog({ role }: { role?: { id: string; name: string; description: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { id: role?.id, name: role?.name ?? "", description: role?.description ?? "" },
  });

  const onSubmit = form.handleSubmit((v) =>
    startTransition(async () => {
      const res = await saveRole(v);
      if (!handleResult(res, form)) return;
      setOpen(false);
      if (!role && res.ok && res.data) router.push(`/configuracoes/papeis/${(res.data as { id: string }).id}`);
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        {role ? (
          <Button variant="outline">Renomear</Button>
        ) : (
          <Button>
            <Plus aria-hidden="true" /> Novo papel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? "Editar papel" : "Novo papel"}</DialogTitle>
          <DialogDescription>
            {role ? "Altere o nome e a descrição. As permissões ficam na página do papel." : "Depois de criar, marque as permissões do papel."}
          </DialogDescription>
        </DialogHeader>
        <form id="role-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Nome" error={form.formState.errors.name?.message} required>
            <Input placeholder="Ex.: Estagiário de design…" {...form.register("name")} />
          </FormField>
          <FormField label="Descrição" optional error={form.formState.errors.description?.message}>
            <Textarea rows={3} placeholder="Quem usa este papel e o que faz…" {...form.register("description")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {role ? "Salvar" : "Criar papel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
