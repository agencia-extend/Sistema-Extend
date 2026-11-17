"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { syncSocial } from "@/lib/social/meta-social";
import { refreshSocialSchema, socialProfileSchema } from "./schemas";

const INTEGRATIONS = "/configuracoes/integracoes";
const clientPage = (id: string) => `/clientes/${id}/redes`;

/** Liga a página ou o Instagram a um cliente (o banco confere quem pode: admin e gerente de tráfego). */
export const saveSocialProfile = defineAction({ schema: socialProfileSchema, permission: "ads.connect" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_social_profile", { p_id: id, p_client: clientId as string }));
  revalidatePath(INTEGRATIONS);
  if (clientId) revalidatePath(clientPage(clientId));
  return ok(null, clientId ? "Ligado ao cliente. As publicações chegam na próxima atualização." : "Desligado do cliente.");
});

/** Busca de novo páginas, perfis e publicações na Meta. De um cliente: quem vê o cliente; de tudo: quem conecta. */
export const refreshSocial = defineAction({ schema: refreshSocialSchema }, async ({ clientId }, { user }) => {
  const supabase = await createClient();
  if (clientId) {
    const { data } = await supabase.rpc("can_refresh_social", { p_client: clientId });
    if (data !== true) return fail("forbidden", "Você não tem acesso a este cliente.");
  } else if (!user.permissions["ads.connect"]) {
    return fail("forbidden", "Só quem conecta as integrações atualiza todas as páginas.");
  }
  let r;
  try {
    r = await syncSocial({ clientId: clientId ?? undefined, budgetMs: 40_000 });
  } catch (e) {
    console.error("[social-sync]", (e as Error)?.message ?? e);
    return fail("network", "Não foi possível falar com a Meta agora. Tente de novo em instantes.");
  }
  revalidatePath(INTEGRATIONS);
  if (clientId) revalidatePath(clientPage(clientId));
  if (r.errors.length) return fail("network", r.errors[0]);
  return ok(null, clientId ? "Publicações atualizadas." : `Páginas atualizadas: ${r.profiles} ${r.profiles === 1 ? "perfil encontrado" : "perfis encontrados"}.`);
});
