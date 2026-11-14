"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, LoaderCircle, PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { BLOCK_LABEL, BLOCK_TYPES, VARIABLES, buildDoc, newBlockId, todaySP, addDaysSP, type Block, type BlockType, type ProposalItem } from "@/domain/proposals";
import { saveTemplate } from "@/features/proposals/actions";
import { templateSchema } from "@/features/proposals/schemas";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { BlockCard } from "./block-card";
import { ProposalDocument } from "./proposal-document";

type Draft = { id: string; name: string; blocks: Block[]; whatsappMessage: string; validityDays: string };

/** Editor de modelo (RF-PRO-01): blocos reordenáveis, texto com variáveis e prévia. Salvar gera nova versão. */
export function TemplateEditor({ initial, images: initialImages, sampleItems }: { initial: Draft; images: Record<string, string>; sampleItems: ProposalItem[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [images, setImages] = useState(initialImages);
  const [alert, setAlert] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<"form" | "preview">("form");
  const [pending, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useUnsavedGuard(v !== initial && !pending);
  const setBlocks = (fn: (b: Block[]) => Block[]) => setV((p) => ({ ...p, blocks: fn(p.blocks) }));

  const doc = useMemo(() => {
    const label = Object.fromEntries(VARIABLES.map((x) => [x.key, `[${x.label}]`]));
    const d = buildDoc({
      number: 0, issuedAt: todaySP(), templateName: v.name, blocks: v.blocks.map((b) => ({ ...b, body: b.body.replace(/\{observacoes\}/g, label.observacoes) })),
      clientName: label.cliente, contactName: label.contato, contactPhone: null, contactEmail: null, sellerName: label.vendedor,
      items: sampleItems, paymentTerms: label.forma_pagamento, notes: "", validUntil: addDaysSP(Number(v.validityDays) || 10),
    });
    return { ...d, number: "0000" };
  }, [v, sampleItems]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setBlocks((b) => arrayMove(b, b.findIndex((x) => x.id === e.active.id), b.findIndex((x) => x.id === e.over!.id)));
  };

  const add = (type: BlockType) => setBlocks((b) => [...b, { id: newBlockId(), type, title: type === "imagem" || type === "texto" ? "" : BLOCK_LABEL[type], body: "", imagePath: null }]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = templateSchema.safeParse({ ...v, validityDays: Number(v.validityDays) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path[0] === "blocks" ? "blocks" : i.path.join(".")] ??= i.message;
      setErrors(errs);
      return void setAlert(parsed.error.issues[0]?.message ?? "Revise os campos.");
    }
    setErrors({});
    setAlert(null);
    start(async () => {
      const res = await saveTemplate(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-1 rounded-lg border bg-surface p-1 lg:hidden" role="group" aria-label="Alternar entre editar e prévia">
        <Button type="button" variant={view === "form" ? "default" : "ghost"} className="flex-1" aria-pressed={view === "form"} onClick={() => setView("form")}><PencilLine aria-hidden="true" /> Editar</Button>
        <Button type="button" variant={view === "preview" ? "default" : "ghost"} className="flex-1" aria-pressed={view === "preview"} onClick={() => setView("preview")}><Eye aria-hidden="true" /> Prévia</Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <form onSubmit={submit} noValidate className={cn("grid content-start gap-5", view === "preview" && "hidden lg:grid")}>
          <FormAlert>{alert}</FormAlert>
          <FormField label="Nome do modelo" required error={errors.name}>
            <Input value={v.name} maxLength={80} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Validade padrão (dias)" required error={errors.validityDays}>
            <Input inputMode="numeric" value={v.validityDays} className="w-28 tabular" onChange={(e) => setV((p) => ({ ...p, validityDays: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
          </FormField>
          <FormField label="Mensagem do WhatsApp" required error={errors.whatsappMessage} hint="Use {link} onde entra o endereço da proposta.">
            <Textarea rows={3} maxLength={1000} value={v.whatsappMessage} onChange={(e) => setV((p) => ({ ...p, whatsappMessage: e.target.value }))} />
          </FormField>
          <details className="rounded-lg border bg-surface p-3 text-sm">
            <summary className="cursor-pointer font-medium">Variáveis e formatação</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">{VARIABLES.map((x) => <li key={x.key}><code className="text-primary">{`{${x.key}}`}</code> {x.label}</li>)}</ul>
            <p className="mt-2 text-muted-foreground">Linha em branco separa parágrafos, “- ” no começo da linha faz lista e **texto** fica em negrito.</p>
          </details>
          <section aria-labelledby="blocos" className="grid gap-3">
            <h2 id="blocos" className="text-sm font-semibold">Blocos, na ordem da proposta</h2>
            {errors.blocks && <p role="alert" className="text-sm text-danger">{errors.blocks}</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={v.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ol className="grid gap-3">
                  {v.blocks.map((b, i) => (
                    <BlockCard
                      key={b.id}
                      block={b}
                      index={i}
                      total={v.blocks.length}
                      onChange={(patch) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))}
                      onMove={(to) => setBlocks((bs) => arrayMove(bs, i, to))}
                      onRemove={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                      onImage={(path, url) => { setImages((m) => ({ ...m, [path]: url })); setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, imagePath: path } : x))); }}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <Select value="" onValueChange={(t) => add(t as BlockType)}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Adicionar bloco"><Plus aria-hidden="true" /><SelectValue placeholder="Adicionar bloco" /></SelectTrigger>
              <SelectContent>{BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{BLOCK_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </section>
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar nova versão
          </Button>
        </form>
        <section aria-label="Prévia do modelo" className={cn("grid min-w-0 content-start gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto", view === "form" && "hidden lg:grid")}>
          <p className="text-xs text-muted-foreground">Prévia: os nomes entre colchetes viram os dados de cada proposta; os valores são os preços padrão do catálogo.</p>
          <ProposalDocument doc={doc} images={images} />
        </section>
      </div>
    </div>
  );
}
