"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok } from "@/domain/shared/result";
import { dismissPlaceholderSchema, linkPlaceholderSchema } from "./schemas";

// Pessoas do Trello a cadastrar (20261125000300_pessoas_do_trello.sql): ligar um nome a quem já tem acesso ou tirá-lo da lista.

const USERS = "/configuracoes/usuarios";

export const linkPlaceholder = defineAction({ schema: linkPlaceholderSchema, permission: "users.manage" }, async ({ placeholderId, profileId }) => {
  const supabase = await createClient();
  const n = must(await supabase.rpc("link_team_placeholder", { p_placeholder: placeholderId, p_profile: profileId })) as number;
  revalidatePath(USERS);
  revalidatePath("/tarefas");
  return ok(null, n === 1 ? "Nome ligado: 1 card passou para a pessoa." : `Nome ligado: ${n} cards passaram para a pessoa.`);
});

export const dismissPlaceholder = defineAction({ schema: dismissPlaceholderSchema, permission: "users.manage" }, async ({ placeholderId, dismiss }) => {
  const supabase = await createClient();
  must(await supabase.rpc("dismiss_team_placeholder", { p_placeholder: placeholderId, p_dismiss: dismiss }));
  revalidatePath(USERS);
  return ok(null, dismiss ? "Nome tirado da lista. Os cards continuam sem responsável." : "Nome de volta na lista.");
});
