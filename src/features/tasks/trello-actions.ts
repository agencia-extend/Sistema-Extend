"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { trelloPayloadSchema } from "./trello-schemas";

// Importação do Trello (RF-TAR-11). O navegador lê o JSON e manda o resumo; o banco confere quem pode, cria o quadro
// de uma vez e avisa só uma vez cada pessoa (20261119000600_importar_trello.sql).

const uuid = z.uuid();
const touch = (clientId: string) => {
  revalidatePath(`/clientes/${clientId}/quadros`);
  revalidatePath("/tarefas");
};

export const importTrello = defineAction(
  { schema: z.object({ clientId: uuid, board: trelloPayloadSchema }), permission: ["tasks.assign", "tasks.boards.configure"] },
  async ({ clientId, board }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_trello_board", { p_client: clientId, p_board: board });
    // Quadro já importado: a mensagem do banco diz quando e como refazer.
    if (error?.code === "23505") return fail("conflict", error.message);
    if (error) throw error;
    touch(clientId);
    const n = board.cards.length;
    return ok({ boardId: data as string }, `Quadro importado: ${n} ${n === 1 ? "card" : "cards"}. Quem recebeu cards foi avisado.`);
  },
);

export const undoTrelloImport = defineAction(
  { schema: z.object({ id: uuid, clientId: uuid }), permission: ["tasks.assign", "tasks.boards.configure"] },
  async ({ id, clientId }) => {
    const supabase = await createClient();
    must(await supabase.rpc("undo_trello_import", { p_id: id }));
    touch(clientId);
    return ok(null, "Importação desfeita. Os cards saíram e o quadro foi arquivado.");
  },
);
