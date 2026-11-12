"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { createTask } from "@/features/tasks/actions";
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/domain/tasks";

type Opt = { id: string; name: string };
const NONE = "__nenhum";
const TYPES = ["video", "design", "conteudo", "gravacao", "site", "geral"] as const;

/** Nova demanda do zero (cliente, tipo, responsável, prazo). O fluxo define a primeira etapa. */
export function NewTaskDialog({
  clients,
  team,
  preset,
  label = "Nova demanda",
}: {
  clients: Opt[];
  team: Opt[];
  preset?: { clientId?: string; type?: (typeof TYPES)[number]; boardId?: string; columnId?: string; assigneeId?: string };
  label?: string;
}) {
  const router = useRouter();
  const blank = { title: "", clientId: preset?.clientId ?? "", type: preset?.type ?? "geral", assigneeId: preset?.assigneeId ?? "", dueAt: "", priority: "media", description: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await createTask({
        title: v.title,
        clientId: v.clientId || null,
        type: v.type as (typeof TYPES)[number],
        assigneeId: v.assigneeId || null,
        dueAt: v.dueAt ? new Date(`${v.dueAt}:00-03:00`).toISOString() : null,
        priority: v.priority as "media",
        description: v.description,
        boardId: preset?.boardId ?? null,
        columnId: preset?.columnId ?? null,
      });
      if (!res.ok) return setError(res.message);
      setOpen(false);
      setV(blank);
      router.push(`/tarefas/${(res.data as { id: string }).id}`);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>Sem responsável, o sistema usa a pessoa marcada no cliente para a primeira etapa do fluxo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Título" required>
            <Input autoComplete="off" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {!preset?.clientId && (
              <FormField label="Cliente" optional>
                <Select value={v.clientId || NONE} onValueChange={(x) => setV({ ...v, clientId: x === NONE ? "" : x })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Interna (sem cliente)</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            {!preset?.boardId && (
              <FormField label="Tipo" required>
                <Select value={v.type} onValueChange={(x) => setV({ ...v, type: x as (typeof TYPES)[number] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{TASK_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="Responsável" optional>
              <Select value={v.assigneeId || NONE} onValueChange={(x) => setV({ ...v, assigneeId: x === NONE ? "" : x })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Automático pelo fluxo</SelectItem>
                  {team.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Prazo" optional>
              <Input type="datetime-local" value={v.dueAt} onChange={(e) => setV({ ...v, dueAt: e.target.value })} />
            </FormField>
            <FormField label="Prioridade">
              <Select value={v.priority} onValueChange={(x) => setV({ ...v, priority: x })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Descrição / briefing" optional>
            <Textarea rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Criar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
