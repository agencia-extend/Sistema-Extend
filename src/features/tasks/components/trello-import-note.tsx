"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { undoTrelloImport } from "@/features/tasks/trello-actions";
import { handleResult } from "@/lib/action-feedback";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** Origem do quadro importado do Trello, com "Desfazer importação" para quem edita os quadros do cliente. */
export function TrelloImportNote({ imp, clientId, canUndo }: {
  imp: { id: string; sourceName: string; cards: number; createdAt: string; importer: string | null };
  clientId: string;
  canUndo: boolean;
}) {
  const router = useRouter();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        Importado do Trello ({imp.sourceName}) em {fmt.format(new Date(imp.createdAt))}
        {imp.importer ? ` por ${imp.importer}` : ""}: {imp.cards.toLocaleString("pt-BR")} {imp.cards === 1 ? "card" : "cards"}.
      </span>
      {canUndo && (
        <ConfirmDialog
          trigger={<Button variant="link" size="sm" className="h-auto p-0 text-xs text-danger">Desfazer importação</Button>}
          title="Desfazer a importação do Trello?"
          description="Os cards importados saem (inclusive os que já foram mexidos aqui) e o quadro é arquivado. Depois dá para importar de novo."
          confirmLabel="Desfazer importação"
          onConfirm={async () => {
            const res = await undoTrelloImport({ id: imp.id, clientId });
            if (handleResult(res)) router.refresh();
          }}
        />
      )}
    </p>
  );
}
