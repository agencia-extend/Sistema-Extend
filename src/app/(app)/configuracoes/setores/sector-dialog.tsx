"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/app/form-field";
import { saveSector } from "@/features/admin/actions";
import { sectorSchema } from "@/features/admin/schemas";
import { handleResult } from "@/lib/action-feedback";

type Sector = z.input<typeof sectorSchema>;

export function SectorDialog({ sector }: { sector?: Sector }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<Sector>({
    resolver: zodResolver(sectorSchema),
    defaultValues: sector ?? { name: "", area: "criacao", color: "#1D8AE6", isActive: true },
  });
  const onSubmit = form.handleSubmit((v) =>
    startTransition(async () => {
      if (handleResult(await saveSector(v), form)) {
        setOpen(false);
        if (!sector) form.reset();
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        {sector ? (
          <Button variant="outline" size="sm" aria-label={`Editar ${sector.name}`}>
            Editar
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden="true" /> Novo setor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sector ? "Editar setor" : "Novo setor"}</DialogTitle>
          <DialogDescription>Desativar um setor esconde ele dos convites e filtros, sem apagar o histórico.</DialogDescription>
        </DialogHeader>
        <form id="sector-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Nome" error={form.formState.errors.name?.message} required>
            <Input {...form.register("name")} />
          </FormField>
          <Controller
            control={form.control}
            name="area"
            render={({ field }) => (
              <FormField label="Área" required>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestao">Gestão</SelectItem>
                    <SelectItem value="trafego">Tráfego</SelectItem>
                    <SelectItem value="criacao">Criação de conteúdo</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />
          <FormField label="Cor" hint="Aparece ao lado do nome do setor nas listas." error={form.formState.errors.color?.message} required>
            <Input type="color" className="h-10 w-20 p-1" {...form.register("color")} />
          </FormField>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex min-h-10 items-center gap-3">
                <Switch id="sector-active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="sector-active" className="font-normal">
                  Setor ativo
                </Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="sector-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {sector ? "Salvar" : "Criar setor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
