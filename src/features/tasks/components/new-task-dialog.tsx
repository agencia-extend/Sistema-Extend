"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { createTask } from "@/features/tasks/actions";
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/domain/tasks";
import { REPEAT_OPTIONS, TEMPLATE_CATEGORY_LABEL, repeatFromKey, repeatKey } from "@/domain/tasks/repeat";

type Opt = { id: string; name: string };
export type TemplateOpt = { id: string; name: string; category: string; type: string; description: string; dueDays: number; priority: string; repeatUnit: string | null; repeatEvery: number | null };
const NONE = "__nenhum";
const TYPES = ["video", "design", "conteudo", "gravacao", "site", "geral"] as const;

/** Prazo do modelo: hoje + N dias, às 18h de São Paulo (como as demandas geradas). */
function dueFromDays(days: number) {
  const sp = new Date(Date.now() - 3 * 3600_000 + days * 86_400_000);
  return `${sp.toISOString().slice(0, 10)}T18:00`;
}

/** Nova demanda do zero ou a partir de um modelo (cliente, tipo, responsável, prazo, repetição). */
export function NewTaskDialog({
  clients,
  team,
  templates = [],
  preset,
  label = "Nova demanda",
}: {
  clients: Opt[];
  team: Opt[];
  templates?: TemplateOpt[];
  preset?: { clientId?: string; type?: (typeof TYPES)[number]; boardId?: string; columnId?: string; assigneeId?: string };
  label?: string;
}) {
  const router = useRouter();
  const blank = { template: NONE, title: "", clientId: preset?.clientId ?? "", type: preset?.type ?? "geral", assigneeId: preset?.assigneeId ?? "", dueAt: "", priority: "media", description: "", repeat: "nao" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const categories = [...new Set(templates.map((t) => t.category))];

  const useTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return setV({ ...v, template: NONE });
    setV({
      ...v,
      template: id,
      title: t.name,
      type: preset?.type ?? (t.type as (typeof TYPES)[number]),
      description: t.description,
      dueAt: dueFromDays(t.dueDays),
      priority: t.priority,
      repeat: repeatKey(t.repeatUnit, t.repeatEvery),
    });
  };

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
        repeat: repeatFromKey(v.repeat),
      });
      if (!res.ok) return setError(res.message);
      setOpen(false);
      setV(blank);
      router.push(`/tarefas/${(res.data as { id: string }).id}`);
    });

  const repeating = v.repeat !== "nao";
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>Quem for escolhido como responsável é avisado na hora, no sistema e no celular.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          {templates.length > 0 && (
            <FormField label="Começar de um modelo" optional hint="Preenche título, tipo, descrição, prazo e repetição. Dá para mudar tudo depois.">
              <Select value={v.template} onValueChange={useTemplate}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Em branco</SelectItem>
                  {categories.map((c) => (
                    <SelectGroup key={c}>
                      <SelectLabel>{TEMPLATE_CATEGORY_LABEL[c] ?? c}</SelectLabel>
                      {templates.filter((t) => t.category === c).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
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
            <FormField label="Responsável" optional hint={repeating && !v.assigneeId ? "Numa demanda que se repete, escolha quem fica com a série." : undefined}>
              <Select value={v.assigneeId || NONE} onValueChange={(x) => setV({ ...v, assigneeId: x === NONE ? "" : x })}>
                <SelectTrigger className="w-full" aria-label="Responsável"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Automático pelo fluxo</SelectItem>
                  {team.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Prazo" optional hint={repeating && !v.dueAt ? "A repetição conta a partir do prazo." : undefined}>
              <Input type="datetime-local" value={v.dueAt} onChange={(e) => setV({ ...v, dueAt: e.target.value })} />
            </FormField>
            <FormField label="Prioridade">
              <Select value={v.priority} onValueChange={(x) => setV({ ...v, priority: x })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Repetir">
              <Select value={v.repeat} onValueChange={(x) => setV({ ...v, repeat: x })}>
                <SelectTrigger className="w-full" aria-label="Repetir"><SelectValue /></SelectTrigger>
                <SelectContent>{REPEAT_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
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
