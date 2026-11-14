"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY, type MaterialCategory } from "@/domain/clients";
import { addMaterial } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

const MAX = 10 * 1024 * 1024;

/** Novo material: arquivo de até 10 MB ou link do Drive, numa categoria. */
export function MaterialDialog({ clientId, defaultCategory }: { clientId: string; defaultCategory?: MaterialCategory }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<MaterialCategory | "">(defaultCategory ?? "");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setCategory(defaultCategory ?? "");
    setTitle("");
    setUrl("");
    setNotes("");
    setFile(null);
    setErrors({});
    setError(null);
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (!category) e.category = "Escolha a categoria.";
    if (title.trim().length < 2) e.title = "Dê um nome ao material.";
    if (url.trim() && !/^https:\/\//.test(url.trim())) e.url = "O link precisa começar com https://";
    if (!url.trim() && !file) e.url = "Envie um arquivo ou cole o link do Drive.";
    if (file && file.size > MAX) e.file = "Arquivo maior que 10 MB. Coloque no Drive e cole o link.";
    if (file && file.type.startsWith("video/")) e.file = "Vídeos ficam no Drive: cole o link.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("category", category);
    fd.set("title", title.trim());
    fd.set("url", url.trim());
    fd.set("notes", notes.trim());
    if (file) fd.set("file", file);
    start(async () => {
      const res = await addMaterial(fd);
      if (!res.ok) {
        setError(res.message);
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus aria-hidden="true" /> Adicionar material</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar material</DialogTitle>
          <DialogDescription>Envie um arquivo de até 10 MB ou cole o link da pasta ou do arquivo no Drive.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Categoria" required error={errors.category} hint={category ? MATERIAL_CATEGORY[category].hint : undefined}>
            <Select value={category} onValueChange={(v) => setCategory(v as MaterialCategory)}>
              <SelectTrigger className="w-full" aria-label="Categoria"><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>{MATERIAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{MATERIAL_CATEGORY[c].label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Nome" required error={errors.title}>
            <Input autoComplete="off" placeholder="Ex.: Manual de marca 2026…" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Link do Drive" optional error={errors.url}>
            <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://drive.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </FormField>
          <FormField label="Ou envie um arquivo" optional error={errors.file} hint="PDF, imagens, documentos (até 10 MB). Fica em Documentos → Mídias.">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                hidden
                aria-label="Arquivo do material"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.ai,.psd,.svg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{file ? "Trocar arquivo" : "Escolher arquivo"}</Button>
              {file && <span className="min-w-0 truncate text-sm text-muted-foreground">{file.name}</span>}
            </div>
          </FormField>
          <FormField label="Observações" optional>
            <Textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : "Adicionar material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
