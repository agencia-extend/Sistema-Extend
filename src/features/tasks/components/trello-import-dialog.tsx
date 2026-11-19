"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { buildPayload, matchMembers, parseTrello, type TrelloBoard } from "@/domain/tasks/trello";
import { importTrello } from "@/features/tasks/trello-actions";
import { trelloPayloadSchema } from "@/features/tasks/trello-schemas";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__ninguem";
const MAX_MB = 40;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/**
 * Importar um quadro do Trello (RF-TAR-11) para o cliente: escolher o JSON exportado, conferir listas e membros e
 * criar o quadro com os cards, etiquetas, checklists, comentários e links.
 */
export function TrelloImportDialog({ clientId, team }: { clientId: string; team: { id: string; name: string }[] }) {
  const router = useRouter();
  const fileId = useId();
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [name, setName] = useState("");
  const [done, setDone] = useState<boolean[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pending, run] = useTransition();

  const reset = () => { setBoard(null); setName(""); setDone([]); setMembers({}); setAlert(null); };

  const read = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setAlert(`O arquivo tem mais de ${MAX_MB} MB. Arquive cards antigos no Trello e exporte de novo.`);
    setReading(true);
    try {
      const r = parseTrello(await file.text());
      if (!r.ok) return setAlert(r.message);
      if (!r.board.cards.length) return setAlert("O quadro não tem cards abertos para importar.");
      setBoard(r.board);
      setName(r.board.sourceName.slice(0, 60));
      setDone(r.board.columns.map((c) => c.done));
      setMembers(matchMembers(r.board.members, team));
    } catch {
      setAlert("Não foi possível ler o arquivo. Tente exportar de novo no Trello.");
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    if (!board) return;
    const parsed = trelloPayloadSchema.safeParse(buildPayload(board, { name, done, members }));
    if (!parsed.success) return setAlert(parsed.error.issues[0]?.message ?? "Revise os dados do quadro.");
    setAlert(null);
    run(async () => {
      const res = await importTrello({ clientId, board: parsed.data });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      setOpen(false);
      router.push(`/clientes/${clientId}/quadros?quadro=${(res.data as { boardId: string }).boardId}`);
    });
  };

  const t = board?.totals;
  const skipped = board
    ? [board.skipped.archivedCards && plural(board.skipped.archivedCards, "card", "cards"), board.skipped.closedLists && plural(board.skipped.closedLists, "lista", "listas")].filter(Boolean).join(" e ")
    : "";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { reset(); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileUp aria-hidden="true" /> Importar do Trello</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar quadro do Trello</DialogTitle>
          <DialogDescription>
            No Trello, abra o quadro e use Menu › Imprimir, exportar e compartilhar › Exportar como JSON. Entram as listas abertas e os cards
            não arquivados, com etiquetas, checklists, comentários e anexos (como links).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Arquivo JSON do Trello</span>
            <div className="flex flex-wrap items-center gap-3">
              <input id={fileId} type="file" accept=".json,application/json" className="peer sr-only" aria-label="Arquivo JSON do Trello" aria-describedby={`${fileId}-hint`}
                disabled={reading || pending} onChange={(e) => { setFileName(e.target.files?.[0]?.name ?? ""); read(e.target.files?.[0]); }} />
              <label htmlFor={fileId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-surface px-3 text-sm font-medium hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                {reading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />} Escolher arquivo
              </label>
              <span className="min-w-0 text-sm break-all text-muted-foreground">{fileName || "Nenhum arquivo escolhido"}</span>
            </div>
            <p id={`${fileId}-hint`} className="text-xs text-muted-foreground">{reading ? "Lendo o arquivo…" : `Até ${MAX_MB} MB.`}</p>
          </div>

          {board && t && (
            <>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                {plural(board.cards.length, "card", "cards")} em {plural(board.columns.length, "lista", "listas")}, com {plural(t.comments, "comentário", "comentários")},{" "}
                {plural(t.checklistItems, "item de checklist", "itens de checklist")} e {plural(t.links, "link", "links")}.
                {skipped && <> Fica de fora o que está arquivado no Trello: {skipped}.</>}
              </p>
              {board.commentsMayBeMissing && (
                <FormAlert tone="info">O Trello exporta só as 1.000 ações mais recentes do quadro: comentários mais antigos podem não vir no arquivo.</FormAlert>
              )}
              <FormField label="Nome do quadro no sistema" required>
                <Input autoComplete="off" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>

              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Listas que viram colunas</legend>
                <p className="text-xs text-muted-foreground">Cards nas colunas marcadas entram como concluídos.</p>
                <ul className="grid gap-1">
                  {board.columns.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                      <span className="min-w-0 break-words">{c.name} <span className="text-muted-foreground tabular-nums">({c.cards})</span></span>
                      <label className="flex shrink-0 items-center gap-2 text-xs">
                        <Checkbox checked={done[i]} onCheckedChange={(v) => setDone((d) => d.map((x, j) => (j === i ? v === true : x)))} aria-label={`${c.name} é coluna de concluído`} />
                        Concluída
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              {board.members.length > 0 && (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">Membros do Trello</legend>
                  <p className="text-xs text-muted-foreground">O primeiro membro de cada card fica responsável e os outros participam. Sem pessoa, o card entra sem responsável.</p>
                  <ul className="grid gap-2">
                    {board.members.map((m) => (
                      <li key={m.id} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3">
                        <span className="text-sm break-words">{m.name} <span className="text-muted-foreground tabular-nums">({plural(m.cards, "card", "cards")})</span></span>
                        <Select value={members[m.id] || NONE} onValueChange={(v) => setMembers((s) => ({ ...s, [m.id]: v === NONE ? "" : v }))}>
                          <SelectTrigger className="w-full" aria-label={`Pessoa da equipe para ${m.name}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Ninguém</SelectItem>
                            {team.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!board || pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {board ? `Importar ${plural(board.cards.length, "card", "cards")}` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
