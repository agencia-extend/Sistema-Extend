"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormAlert, FormField } from "@/components/app/form-field";
import { deletePipeline, deleteStage, moveStage, savePipeline, saveStage } from "@/features/crm/actions";
import { pipelineSchema, stageSchema } from "@/features/crm/schemas";
import type { Pipeline, Stage } from "@/features/crm/queries";
import { handleResult } from "@/lib/action-feedback";

const KIND_NOTE = { ganho: "Fechamento: abre o formulário de onboarding", perdido: "Exige motivo da perda" } as const;

/** Etapas de um funil: nome, cor, prazo de parada e ordem. Ganho e Perdido são fixos. */
export function PipelineEditor({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = pipeline.stages.filter((s) => s.kind === "aberta");
  const move = (id: string, direction: "up" | "down") => start(async () => { if (handleResult(await moveStage({ id, pipelineId: pipeline.id, direction }))) router.refresh(); });

  return (
    <section aria-labelledby={`p-${pipeline.id}`} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`p-${pipeline.id}`} className="flex-1 text-base font-semibold">{pipeline.name}{pipeline.isDefault && <span className="ml-2 text-xs font-normal text-muted-foreground">principal</span>}</h2>
        <PipelineDialog pipeline={pipeline} trigger={<Button variant="ghost" size="sm"><Pencil aria-hidden="true" /> Renomear</Button>} />
        {!pipeline.isDefault && (
          <ConfirmDialog
            trigger={<Button variant="ghost" size="sm"><Trash2 aria-hidden="true" /> Excluir</Button>}
            title={`Excluir o funil ${pipeline.name}?`}
            description="Só é possível excluir um funil sem leads."
            confirmLabel="Excluir funil"
            onConfirm={async () => { if (handleResult(await deletePipeline({ id: pipeline.id }))) router.refresh(); }}
          />
        )}
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {pipeline.stages.map((s) => {
          const i = open.findIndex((o) => o.id === s.id);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.kind === "aberta" ? (s.slaDays ? `Avisa o responsável depois de ${s.slaDays} dia(s) parado` : "Sem prazo de parada") : KIND_NOTE[s.kind]}</span>
              </span>
              <span className="flex gap-0.5">
                {s.kind === "aberta" && (
                  <>
                    <Button variant="ghost" size="icon" disabled={i === 0 || pending} onClick={() => move(s.id, "up")} aria-label={`Subir a etapa ${s.name}`}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" disabled={i === open.length - 1 || pending} onClick={() => move(s.id, "down")} aria-label={`Descer a etapa ${s.name}`}><ArrowDown /></Button>
                  </>
                )}
                <StageDialog pipelineId={pipeline.id} stage={s} trigger={<Button variant="ghost" size="icon" aria-label={`Editar a etapa ${s.name}`}><Pencil /></Button>} />
                {s.kind === "aberta" && (
                  <ConfirmDialog
                    trigger={<Button variant="ghost" size="icon" aria-label={`Excluir a etapa ${s.name}`}><Trash2 /></Button>}
                    title={`Excluir a etapa ${s.name}?`}
                    description="Só é possível excluir uma etapa sem leads. Mova os leads antes."
                    confirmLabel="Excluir etapa"
                    onConfirm={async () => { if (handleResult(await deleteStage({ id: s.id }))) router.refresh(); }}
                  />
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <StageDialog pipelineId={pipeline.id} trigger={<Button variant="outline" className="justify-self-start"><Plus aria-hidden="true" /> Adicionar etapa</Button>} />
    </section>
  );
}

export function PipelineDialog({ pipeline, trigger }: { pipeline?: Pipeline; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(pipeline?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => {
    const parsed = pipelineSchema.safeParse({ id: pipeline?.id, name });
    if (!parsed.success) return void setError(parsed.error.issues[0]?.message ?? "Revise o nome.");
    start(async () => {
      const res = await savePipeline(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setName(pipeline?.name ?? ""); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pipeline ? "Renomear funil" : "Novo funil"}</DialogTitle>
          <DialogDescription>{pipeline ? "O nome aparece no seletor do comercial." : "Um funil separado, por exemplo para sites ou para clientes da base. Já nasce com as etapas básicas."}</DialogDescription>
        </DialogHeader>
        <FormField label="Nome" required error={error ?? undefined}>
          <Input autoComplete="off" placeholder="Ex.: Funil de sites…" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </FormField>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pipeline ? "Salvar nome" : "Criar funil"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageDialog({ pipelineId, stage, trigger }: { pipelineId: string; stage?: Stage; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = { name: stage?.name ?? "", color: stage?.color ?? "#64748B", sla: stage?.slaDays ? String(stage.slaDays) : "" };
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const closed = stage && stage.kind !== "aberta";
  const save = () => {
    const parsed = stageSchema.safeParse({ id: stage?.id, pipelineId, name: v.name, color: v.color, slaDays: closed || !v.sla ? null : Number(v.sla) });
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await saveStage(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(blank); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          <DialogDescription>{stage ? "Mudanças valem na hora para todos os leads desta etapa." : "Entra antes de Ganho e Perdido. Depois, ajuste a ordem com as setas."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome" required error={errors.name}>
            <Input autoComplete="off" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Cor" error={errors.color}>
              <Input type="color" className="h-10 w-20 p-1" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />
            </FormField>
            {!closed && (
              <FormField label="Prazo parado (dias)" optional hint="Passou disso, o responsável é avisado." error={errors.slaDays}>
                <Input type="number" min={1} max={180} inputMode="numeric" value={v.sla} onChange={(e) => setV({ ...v, sla: e.target.value })} />
              </FormField>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {stage ? "Salvar etapa" : "Adicionar etapa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
