"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { createTag, setParticipants, setTaskTags, updateTask } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { PRIORITY_LABEL } from "@/domain/tasks";
import { TagChips } from "@/features/tasks/components/task-bits";
import { Section } from "@/features/clients/components/section";

type Opt = { id: string; name: string };
type Tag = { id: string; name: string; color: string };
const NONE = "__nenhum";
const COLORS = ["#1D8AE6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16) : "");

export function TaskFields({
  task,
  participants,
  team,
  tags: allTags,
  related,
  canEdit,
  canAssign,
  blocker,
}: {
  task: { id: string; assigneeId: string | null; dueAt: string | null; priority: string; blockedBy: string | null; waitingNote: string; tags: Tag[] };
  participants: string[];
  team: Opt[];
  tags: Tag[];
  related: Opt[] | { id: string; title: string }[];
  canEdit: boolean;
  canAssign: boolean;
  blocker: { id: string; title: string; status: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState(allTags);
  const [selected, setSelected] = useState(task.tags.map((t) => t.id));
  const [newTag, setNewTag] = useState("");
  const [parts, setParts] = useState(participants);
  const run = (p: Promise<{ ok: boolean; message?: string }>) => startTransition(async () => void handleResult((await p) as never));
  const rel = (related as { id: string; title?: string; name?: string }[]).map((r) => ({ id: r.id, name: r.title ?? r.name ?? "" }));

  return (
    <Section title="Detalhes">
      <div className="grid gap-4 rounded-xl border bg-card p-4">
        <FormField label="Responsável">
          <Select value={task.assigneeId ?? NONE} disabled={!canAssign || pending} onValueChange={(v) => run(updateTask({ id: task.id, assigneeId: v === NONE ? null : v }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem responsável</SelectItem>
              {team.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Prazo">
          <Input
            type="datetime-local"
            defaultValue={toLocal(task.dueAt)}
            disabled={!canEdit}
            onBlur={(e) => {
              if (e.target.value !== toLocal(task.dueAt)) run(updateTask({ id: task.id, dueAt: e.target.value ? new Date(`${e.target.value}:00-03:00`).toISOString() : null }));
            }}
          />
        </FormField>
        <FormField label="Prioridade">
          <Select value={task.priority} disabled={!canEdit || pending} onValueChange={(v) => run(updateTask({ id: task.id, priority: v as "media" }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Etiquetas</span>
          <TagChips tags={tags.filter((t) => selected.includes(t.id))} />
          {canEdit && (
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="justify-self-start">Editar etiquetas</Button></PopoverTrigger>
              <PopoverContent className="grid w-72 gap-2">
                <div className="grid max-h-48 gap-1 overflow-y-auto">
                  {tags.map((t) => (
                    <div key={t.id} className="flex min-h-9 items-center gap-2">
                      <Checkbox
                        id={`tag-${t.id}`}
                        checked={selected.includes(t.id)}
                        onCheckedChange={(v) => {
                          const next = v ? [...selected, t.id] : selected.filter((x) => x !== t.id);
                          setSelected(next);
                          run(setTaskTags({ id: task.id, tagIds: next }));
                        }}
                      />
                      <Label htmlFor={`tag-${t.id}`} className="flex items-center gap-1.5 font-normal">
                        <span className="size-2.5 rounded-full" style={{ background: t.color }} aria-hidden="true" />
                        {t.name}
                      </Label>
                    </div>
                  ))}
                  {!tags.length && <p className="text-xs text-muted-foreground">Nenhuma etiqueta ainda. Crie a primeira abaixo.</p>}
                </div>
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      const res = await createTag({ name: newTag, color: COLORS[tags.length % COLORS.length] });
                      if (!handleResult(res) || !res.ok) return;
                      const t = res.data as Tag;
                      setTags([...tags, t]);
                      const next = [...selected, t.id];
                      setSelected(next);
                      setNewTag("");
                      handleResult(await setTaskTags({ id: task.id, tagIds: next }));
                    });
                  }}
                >
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova etiqueta…" aria-label="Nova etiqueta" autoComplete="off" />
                  <Button type="submit" size="icon" variant="outline" aria-label="Criar etiqueta" disabled={!newTag.trim() || pending}><Plus /></Button>
                </form>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Participantes <span className="font-normal text-muted-foreground">(acompanham e são avisados)</span></span>
          <p className="text-sm text-muted-foreground">{parts.length ? team.filter((t) => parts.includes(t.id)).map((t) => t.name).join(", ") : "Ninguém além do responsável."}</p>
          {canEdit && (
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="justify-self-start">Editar participantes</Button></PopoverTrigger>
              <PopoverContent className="grid max-h-72 w-64 gap-1 overflow-y-auto">
                {team.map((p) => (
                  <div key={p.id} className="flex min-h-9 items-center gap-2">
                    <Checkbox
                      id={`part-${p.id}`}
                      checked={parts.includes(p.id)}
                      onCheckedChange={(v) => {
                        const next = v ? [...parts, p.id] : parts.filter((x) => x !== p.id);
                        setParts(next);
                        run(setParticipants({ id: task.id, profileIds: next }));
                      }}
                    />
                    <Label htmlFor={`part-${p.id}`} className="font-normal">{p.name}</Label>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <FormField label="Aguardando outra demanda" hint={blocker ? undefined : "Use quando este card depende de outro (RF-TAR-10)."}>
          <Select value={task.blockedBy ?? NONE} disabled={!canEdit || pending} onValueChange={(v) => run(updateTask({ id: task.id, blockedBy: v === NONE ? null : v }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Não depende de outra</SelectItem>
              {blocker && !rel.some((r) => r.id === blocker.id) && <SelectItem value={blocker.id}>{blocker.title}</SelectItem>}
              {rel.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        {blocker && (
          <p className="-mt-2 text-sm">
            Aguardando: <Link href={`/tarefas/${blocker.id}`} className="text-primary hover:underline">{blocker.title}</Link>
          </p>
        )}
      </div>
    </Section>
  );
}
