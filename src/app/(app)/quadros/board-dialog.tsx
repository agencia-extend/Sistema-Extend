"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { saveBoard } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__nenhum";

export function BoardDialog({ sectors, board }: { sectors: { id: string; name: string }[]; board?: { id: string; name: string; sectorId: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(board?.name ?? "");
  const [sector, setSector] = useState(board?.sectorId ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        {board ? <Button variant="outline"><Pencil aria-hidden="true" /> Renomear</Button> : <Button><Plus aria-hidden="true" /> Novo quadro</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{board ? "Editar quadro" : "Novo quadro"}</DialogTitle>
          <DialogDescription>{board ? "Nome e setor do quadro." : "Começa com as colunas A fazer, Fazendo e Feito. Você muda depois."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Nome" required><Input autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="Setor" optional>
            <Select value={sector || NONE} onValueChange={(v) => setSector(v === NONE ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos os setores</SelectItem>
                {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button disabled={pending || name.trim().length < 2} onClick={() => startTransition(async () => {
            const res = await saveBoard({ id: board?.id, name, sectorId: sector || null });
            if (!handleResult(res) || !res.ok) return;
            setOpen(false);
            if (!board) router.push(`/quadros/${(res.data as { id: string }).id}`);
          })}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar quadro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
