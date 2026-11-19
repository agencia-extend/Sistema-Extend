"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Tag } from "@/features/inbox/queries";
import { setConversationTags } from "@/features/inbox/actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { TagChip } from "./tag-chip";

/** Etiquetas da conversa: toque para pôr ou tirar (salva na hora). */
export function TagPicker({ conversationId, tags, selected, canEdit }: { conversationId: string; tags: Tag[]; selected: string[]; canEdit: boolean }) {
  const [ids, setIds] = useState(selected);
  const [pending, run] = useTransition();
  if (!tags.length) return <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada. Quem administra o atendimento cria em Ajustes.</p>;
  if (!canEdit) {
    const mine = tags.filter((t) => ids.includes(t.id));
    return mine.length ? <div className="flex flex-wrap gap-1">{mine.map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div> : <p className="text-sm text-muted-foreground">Sem etiquetas.</p>;
  }
  const toggle = (id: string) => {
    const before = ids;
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    run(async () => {
      const res = await setConversationTags({ id: conversationId, tagIds: next });
      if (!res.ok) {
        setIds(before);
        handleResult(res);
      }
    });
  };
  return (
    <div className="flex flex-wrap gap-1.5" aria-busy={pending}>
      {tags.map((t) => {
        const on = ids.includes(t.id);
        return (
          <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)}
            className={cn("inline-flex items-center gap-1 rounded-full border px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", on ? "border-transparent" : "border-dashed opacity-70 hover:opacity-100")}>
            {on && <Check className="size-3" aria-hidden="true" />}
            <TagChip name={t.name} color={t.color} />
          </button>
        );
      })}
    </div>
  );
}
