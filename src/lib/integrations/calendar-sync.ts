import "server-only";
import { googleEventBody } from "@/domain/integrations";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { configured } from "./config";
import { appCalendarEvent, ensureAppCalendar } from "./google";
import { accessToken, recordFailure, type StoredConnection } from "./store";

// Eventos do sistema → agenda "Sistema Extend" (criada pelo app) de cada participante conectado e de quem criou.
// Escopo calendar.app.created: o app não enxerga nenhuma outra agenda da pessoa.
// Nunca quebra a ação de quem salvou: a falha fica registrada na conexão da pessoa (Meu perfil › Conexões).

async function calendarConnections(profileIds: string[]): Promise<Map<string, StoredConnection>> {
  if (!profileIds.length) return new Map();
  const { data } = await createAdminClient()
    .from("integration_connections")
    .select("*")
    .eq("provider", "google")
    .eq("purpose", "calendar")
    .eq("owner_kind", "user")
    .in("profile_id", profileIds);
  return new Map(((data ?? []) as StoredConnection[]).map((c) => [c.profile_id!, c]));
}

/** Agenda do app da pessoa; se ela apagou a agenda no Google, cria outra e guarda o novo id. */
async function calendarOf(conn: StoredConnection, token: string, forceNew = false): Promise<string> {
  const id = await ensureAppCalendar(token, forceNew ? null : conn.resource_id);
  if (id !== conn.resource_id) {
    await createAdminClient().from("integration_connections").update({ resource_id: id }).eq("id", conn.id);
    conn.resource_id = id;
  }
  return id;
}

/** Cria, atualiza ou tira o evento das agendas conforme os participantes atuais. */
export async function syncEventToGoogle(eventId: string) {
  if (!configured("google")) return;
  const db = createAdminClient();
  const { data: ev } = await db
    .from("calendar_events")
    .select("id, title, starts_at, ends_at, location, link, notes, created_by, clients(name), calendar_attendees(profile_id)")
    .eq("id", eventId)
    .maybeSingle();
  const { data: links } = await db.from("calendar_event_links").select("profile_id, google_event_id").eq("event_id", eventId);
  const linked = new Map((links ?? []).map((l) => [l.profile_id, l.google_event_id]));
  const people = ev ? new Set([...(ev.calendar_attendees ?? []).map((a) => a.profile_id), ...(ev.created_by ? [ev.created_by] : [])]) : new Set<string>();
  const conns = await calendarConnections([...new Set([...people, ...linked.keys()])]);
  const client = ev ? (Array.isArray(ev.clients) ? ev.clients[0] : ev.clients) : null;
  const body = ev
    ? googleEventBody({
        title: ev.title,
        startsAt: ev.starts_at,
        endsAt: ev.ends_at,
        location: ev.location,
        link: ev.link,
        notes: ev.notes,
        clientName: (client as { name: string } | null)?.name ?? null,
        url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/agenda?data=${ev.starts_at.slice(0, 10)}`,
      })
    : null;

  for (const [profileId, conn] of conns) {
    if (conn.status !== "active") continue;
    const googleId = linked.get(profileId);
    try {
      const token = await accessToken(conn);
      if (body && people.has(profileId)) {
        let cal = await calendarOf(conn, token);
        let saved = googleId ? await appCalendarEvent(token, cal, "PATCH", googleId, body) : null;
        // Sem vínculo, ou o evento/agenda foi apagado no Google: cria de novo (recriando a agenda se preciso).
        if (!saved || saved.status >= 400) {
          let created = await appCalendarEvent(token, cal, "POST", undefined, body);
          if (created.status >= 400) {
            cal = await calendarOf(conn, token, true);
            created = await appCalendarEvent(token, cal, "POST", undefined, body);
          }
          saved = created;
        }
        if (saved.data.id && saved.data.id !== googleId)
          await db.from("calendar_event_links").upsert({ event_id: eventId, profile_id: profileId, connection_id: conn.id, google_event_id: saved.data.id, synced_at: new Date().toISOString() });
      } else if (googleId) {
        if (conn.resource_id) await appCalendarEvent(token, conn.resource_id, "DELETE", googleId);
        await db.from("calendar_event_links").delete().eq("event_id", eventId).eq("profile_id", profileId);
      }
    } catch (e) {
      await recordFailure(conn, e);
    }
  }
  // Vínculos de quem desconectou a agenda: só limpa.
  const gone = [...linked.keys()].filter((p) => !conns.has(p) && !people.has(p));
  if (gone.length) await db.from("calendar_event_links").delete().eq("event_id", eventId).in("profile_id", gone);
}
