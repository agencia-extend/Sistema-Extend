"use client";

import { useState, useTransition } from "react";
import { Archive, Columns3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { archiveBoard, deleteColumn, saveColumn } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";

type Col = { id: string; name: string; color: string; is_done: boolean };

export function ColumnsEditor({ boardId, columns, archived }: { boardId: string; columns: Col[]; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (p: Promise<{ ok: boolean; message?: string }>) => startTransition(async () => void handleResult((await p) as never));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Columns3 aria-hidden="true" /> Colunas</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Colunas do quadro</DialogTitle>
          <DialogDescription>Cards em coluna marcada como “concluído” contam como entregues.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {columns.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input type="color" aria-label={`Cor de ${c.name}`} defaultValue={c.color} className="size-9 rounded border p-0.5"
                onBlur={(e) => e.target.value !== c.color && run(saveColumn({ id: c.id, boardId, name: c.name, color: e.target.value, isDone: c.is_done }))} />
              <Input defaultValue={c.name} aria-label="Nome da coluna" className="flex-1"
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(saveColumn({ id: c.id, boardId, name: e.target.value, color: c.color, isDone: c.is_done }))} />
              <div className="flex items-center gap-1.5">
                <Checkbox id={`done-${c.id}`} checked={c.is_done} onCheckedChange={(v) => run(saveColumn({ id: c.id, boardId, name: c.name, color: c.color, isDone: v === true }))} />
                <Label htmlFor={`done-${c.id}`} className="text-xs font-normal">Concluído</Label>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Excluir ${c.name}`} disabled={pending} onClick={() => run(deleteColumn({ id: c.id }))}><Trash2 /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { if (handleResult(await saveColumn({ boardId, name, color: "#64748B", isDone: false }))) setName(""); }); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova coluna…" aria-label="Nova coluna" autoComplete="off" />
          <Button type="submit" variant="outline" disabled={pending || !name.trim()}><Plus aria-hidden="true" /> Adicionar</Button>
        </form>
        <Button variant="ghost" className="justify-self-start" disabled={pending} onClick={() => run(archiveBoard({ id: boardId, archived: !archived }))}>
          <Archive aria-hidden="true" /> {archived ? "Restaurar quadro" : "Arquivar quadro"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
