import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsapp, wahaConn } from "./store";
import { wahaGroupName, wahaProfilePicture } from "./waha";

// Fotos de perfil e nomes de grupo (como no HubSystem, src/lib/inbox-avatars.ts): buscados no WhatsApp depois que a
// tela abriu e guardados na conversa. O link da foto expira; cada conversa é conferida de novo depois de 3 dias.

const STALE_MS = 3 * 24 * 3600 * 1000;
const MAX_PER_RUN = 30;

export async function refreshAvatars(organizationId: string, conversationIds: string[]) {
  if (!conversationIds.length) return;
  const c = await getWhatsapp(organizationId);
  if (!c || c.status !== "WORKING") return;
  const db = createAdminClient();
  const since = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await db
    .from("wa_conversations")
    .select("id, kind, chat_id, contact_name")
    .eq("connection_id", c.id)
    .in("id", conversationIds.slice(0, 200))
    .or(`avatar_checked_at.is.null,avatar_checked_at.lt.${since}`)
    .limit(MAX_PER_RUN);
  if (!data?.length) return;
  const conn = wahaConn(c);
  const now = new Date().toISOString();
  const work = data.map((r) => async () => {
    const [avatar, groupName] = await Promise.all([
      wahaProfilePicture(conn, r.chat_id).catch(() => undefined),
      r.kind === "grupo" ? wahaGroupName(conn, r.chat_id).catch(() => null) : Promise.resolve(null),
    ]);
    const patch: { avatar_checked_at: string; avatar_url?: string | null; contact_name?: string } = { avatar_checked_at: now };
    if (avatar !== undefined) patch.avatar_url = avatar;
    if (groupName && groupName.trim() && groupName !== r.contact_name) patch.contact_name = groupName.trim().slice(0, 200);
    await db.from("wa_conversations").update(patch).eq("id", r.id);
  });
  // 5 por vez: rápido sem sobrecarregar o servidor do WhatsApp.
  for (let i = 0; i < work.length; i += 5) await Promise.all(work.slice(i, i + 5).map((w) => w()));
}
