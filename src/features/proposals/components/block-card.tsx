"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BLOCK_HINT, BLOCK_LABEL, unknownVariables, type Block } from "@/domain/proposals";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

/** Um bloco do modelo: arrastar pela alça (ou usar as setas), editar título e texto, imagem. */
export function BlockCard({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onImage,
}: {
  block: Block;
  index: number;
  total: number;
  onChange: (patch: Partial<Block>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onImage: (path: string, url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const hydrated = useHydrated();
  const [uploading, setUploading] = useState(false);
  const unknown = unknownVariables(`${block.title} ${block.body}`);
  const label = BLOCK_LABEL[block.type];

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return void toast.error("Use uma imagem PNG ou JPG.");
    if (file.size > 5 * 1024 * 1024) return void toast.error("A imagem passa de 5 MB. Reduza e tente de novo.");
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `modelos/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from("propostas").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = await supabase.storage.from("propostas").createSignedUrl(path, 3600);
      onImage(path, data?.signedUrl ?? "");
      toast.success("Imagem enviada. Salve o modelo para manter.");
    } catch {
      toast.error("Não foi possível enviar a imagem. Confira a conexão e tente de novo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("grid gap-3 rounded-xl border bg-card p-3", isDragging && "relative z-10 shadow-lg")}>
      <div className="flex items-center gap-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex size-9 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Arrastar o bloco ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{index + 1}. {label}</span>
        <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Subir o bloco ${label}`}><ArrowUp aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(index + 1)} aria-label={`Descer o bloco ${label}`}><ArrowDown aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={block.type === "investimento"} onClick={onRemove} aria-label={`Remover o bloco ${label}`}><Trash2 aria-hidden="true" /></Button>
      </div>
      {BLOCK_HINT[block.type] && <p className="text-xs text-muted-foreground">{BLOCK_HINT[block.type]}</p>}
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Título do bloco {label}</span>
        <Input value={block.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Texto do bloco {label}</span>
        <Textarea rows={block.type === "imagem" ? 2 : 5} maxLength={6000} value={block.body} onChange={(e) => onChange({ body: e.target.value })} className="font-mono text-[13px]" />
      </label>
      {unknown.length > 0 && <p role="alert" className="text-xs text-danger">Variável que não existe: {unknown.map((u) => `{${u}}`).join(", ")}.</p>}
      {block.type === "imagem" && (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{block.imagePath ? "Trocar imagem" : "Imagem"}</span>
          <span className="flex items-center gap-2">
            <Input type="file" accept="image/png,image/jpeg" disabled={!hydrated || uploading} onChange={(e) => void upload(e.target.files?.[0])} className="min-w-0" />
            {uploading ? <LoaderCircle className="size-4 animate-spin" aria-label="Enviando" /> : <ImageUp className="size-4 text-muted-foreground" aria-hidden="true" />}
          </span>
        </label>
      )}
    </li>
  );
}
