"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Hourglass, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/app/form-field";
import { archiveStep, moveStep, saveStep } from "@/features/tasks/actions";
import type { Workflow } from "@/features/tasks/queries";
import { handleResult } from "@/lib/action-feedback";
import { TASK_STATUS_LABEL } from "@/domain/tasks/status";

const NONE = "__nenhum";
type Step = { id?: string; name: string; sectorId: string | null; status: string; waitsClient: boolean; color: string };

export function WorkflowEditor({ workflow, sectors }: { workflow: Workflow; sectors: { id: string; name: string }[] }) {
  const [edit, setEdit] = useState<Step | null>(null);
  const [pending, startTransition] = useTransition();
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const run = (p: Promise<{ ok: boolean; message?: string }>) => startTransition(async () => void handleResult((await p) as never));
  return (
    <section aria-labelledby={`wf-${workflow.id}`} className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`wf-${workflow.id}`} className="text-base font-semibold">{workflow.name}</h2>
        <Button variant="outline" size="sm" onClick={() => setEdit({ name: "", sectorId: null, status: "em_andamento", waitsClient: false, color: "#64748B" })}><Plus aria-hidden="true" /> Etapa</Button>
      </div>
      <ol className="divide-y rounded-xl border bg-card">
        {workflow.steps.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="w-5 text-xs text-muted-foreground tabular">{i + 1}</span>
            <span className="size-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 basis-40 text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">
              {[s.sectorId ? sectorName.get(s.sectorId) : "Sem setor", TASK_STATUS_LABEL[s.status as keyof typeof TASK_STATUS_LABEL]].join(" · ")}
            </span>
            {s.waitsClient && <Hourglass className="size-4 text-warning" aria-label="Aguarda o cliente" />}
            <span className="flex">
              <Button variant="ghost" size="icon" aria-label={`Subir ${s.name}`} disabled={pending || i === 0} onClick={() => run(moveStep({ id: s.id, direction: "up" }))}><ArrowUp /></Button>
              <Button variant="ghost" size="icon" aria-label={`Descer ${s.name}`} disabled={pending || i === workflow.steps.length - 1} onClick={() => run(moveStep({ id: s.id, direction: "down" }))}><ArrowDown /></Button>
              <Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`} onClick={() => setEdit(s)}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label={`Remover ${s.name}`} disabled={pending || workflow.steps.length <= 2} onClick={() => run(archiveStep({ id: s.id }))}><Trash2 /></Button>
            </span>
          </li>
        ))}
      </ol>
      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && !pending && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar etapa" : "Nova etapa"} · {workflow.name}</DialogTitle>
            <DialogDescription>O setor define quem recebe o card nesta etapa. O status alimenta a Demanda do mês.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid gap-4">
              <FormField label="Nome" required><Input autoComplete="off" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Setor da etapa">
                  <Select value={edit.sectorId ?? NONE} onValueChange={(v) => setEdit({ ...edit, sectorId: v === NONE ? null : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem setor (mantém o responsável)</SelectItem>
                      {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Conta como">
                  <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["pendente", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido"] as const).map((k) => <SelectItem key={k} value={k}>{TASK_STATUS_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch id={`wc-${workflow.id}`} checked={edit.waitsClient} onCheckedChange={(v) => setEdit({ ...edit, waitsClient: v })} />
                  <Label htmlFor={`wc-${workflow.id}`} className="font-normal">Aguarda o cliente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input id={`cor-${workflow.id}`} type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="size-9 rounded border p-0.5" />
                  <Label htmlFor={`cor-${workflow.id}`} className="font-normal">Cor</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pending || !edit?.name.trim()} onClick={() => edit && startTransition(async () => {
              if (handleResult(await saveStep({ ...edit, workflowId: workflow.id, status: edit.status as "pendente" }))) setEdit(null);
            })}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
