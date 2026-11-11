"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/app/form-field";
import { saveChecklistTemplate } from "@/features/clients/settings-actions";
import { handleResult } from "@/lib/action-feedback";

type Item = { id?: string; title: string; default_sector_id: string | null; due_days: number; is_active: boolean };
const NONE = "__nenhum";

export function ChecklistTemplates({ sectors, items }: { sectors: { id: string; name: string }[]; items: Item[] }) {
  const [edit, setEdit] = useState<Item | null>(null);
  const [pending, startTransition] = useTransition();
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  return (
    <section aria-labelledby="ckl" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <h2 id="ckl" className="text-base font-semibold">Checklist padrão</h2>
          <p className="text-sm text-muted-foreground">Criado em todo cliente novo. O responsável sai do setor indicado; o prazo conta a partir do fechamento.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEdit({ title: "", default_sector_id: null, due_days: 3, is_active: true })}><Plus aria-hidden="true" /> Novo item</Button>
      </div>
      <ol className="divide-y rounded-xl border bg-card">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setEdit(i)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-muted/50">
              <span className={i.is_active ? "flex-1 text-sm" : "flex-1 text-sm text-muted-foreground line-through"}>{i.title}</span>
              <span className="text-xs text-muted-foreground">{[i.default_sector_id ? sectorName.get(i.default_sector_id) : "Sem setor", `${i.due_days} dia(s)`].join(" · ")}</span>
            </button>
          </li>
        ))}
      </ol>
      <Dialog open={Boolean(edit)} onOpenChange={(v) => !v && !pending && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar item" : "Novo item"}</DialogTitle>
            <DialogDescription>Vale para os próximos clientes; os onboardings em andamento não mudam.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid gap-4">
              <FormField label="Item" required><Input autoComplete="off" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Setor responsável">
                  <Select value={edit.default_sector_id ?? NONE} onValueChange={(v) => setEdit({ ...edit, default_sector_id: v === NONE ? null : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem setor</SelectItem>
                      {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Prazo (dias após o fechamento)">
                  <Input type="number" min={0} max={90} inputMode="numeric" value={edit.due_days} onChange={(e) => setEdit({ ...edit, due_days: Number(e.target.value) || 0 })} />
                </FormField>
              </div>
              <div className="flex min-h-10 items-center gap-3">
                <Switch id="ckl-ativo" checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
                <Label htmlFor="ckl-ativo" className="font-normal">Item ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pending || (edit?.title.trim().length ?? 0) < 2} onClick={() => edit && startTransition(async () => { if (handleResult(await saveChecklistTemplate(edit))) setEdit(null); })}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
