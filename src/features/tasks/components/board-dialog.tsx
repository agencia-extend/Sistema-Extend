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
const PRESET = "Ideias e pedidos, A fazer, Em produção, Revisão interna, Aprovação do cliente e Concluído";

/**
 * Criar ou renomear um quadro. Quadro novo já nasce com as colunas prontas. Com `clientId`, o quadro é do cliente
 * (aparece na aba Quadros dele) e abre lá.
 */
export function BoardDialog({ sectors, board, clientId }: {
  sectors: { id: string; name: string }[];
  board?: { id: string; name: string; sectorId: string | null };
  clientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(board?.name ?? "");
  const [sector, setSector] = useState(board?.sectorId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = () => {
    if (name.trim().length < 2) return setError("Dê um nome ao quadro (2 letras ou mais).");
    setError(null);
    startTransition(async () => {
      const res = await saveBoard({ id: board?.id, name, sectorId: sector || null, clientId: clientId ?? null });
      if (!handleResult(res) || !res.ok) return;
      setOpen(false);
      if (board) return router.refresh();
      const id = (res.data as { id: string }).id;
      router.push(clientId ? `/clientes/${clientId}/quadros?quadro=${id}` : `/quadros/${id}`);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setName(board?.name ?? ""); setError(null); } }}>
      <DialogTrigger asChild>
        {board ? <Button variant="outline"><Pencil aria-hidden="true" /> Renomear</Button> : <Button><Plus aria-hidden="true" /> Novo quadro</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{board ? "Editar quadro" : "Novo quadro"}</DialogTitle>
          <DialogDescription>{board ? "Nome e setor do quadro." : `Começa com as colunas ${PRESET}. Você renomeia, reordena, cria e exclui colunas depois.`}</DialogDescription>
        </DialogHeader>
        <form id="board-form" noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <FormField label="Nome" required error={error ?? undefined}>
            <Input autoComplete="off" maxLength={80} placeholder={clientId ? "Ex.: Campanha de Natal…" : "Ex.: Demandas internas…"} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Setor" optional>
            <Select value={sector || NONE} onValueChange={(v) => setSector(v === NONE ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos os setores</SelectItem>
                {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="board-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {board ? "Salvar quadro" : "Criar quadro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
