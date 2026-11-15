import "server-only";
import { googleEventBody } from "@/domain/integrations";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { configured } from "./config";
import { GoogleError } from "./google";
import { accessToken, recordFailure, type StoredConnection } from "./store";

// Eventos do sistema → Google Agenda de cada participante conectado (e de quem criou).
// Nunca quebra a ação de quem salvou: falha fica registrada na conexão da pessoa (Meu perfil › Conexões).

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function call(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  // Já apagado na agenda da pessoa: tudo bem.
  if (method === "DELETE" && (res.status === 404 || res.status === 410)) return null;
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { status?: string } };
  if (!res.ok) throw new GoogleError(data.error?.status, res.status);
  return data;
}

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
        if (googleId) await call(token, "PATCH", `${API}/${encodeURIComponent(googleId)}`, body);
        else {
          const created = await call(token, "POST", API, body);
          if (created?.id) await db.from("calendar_event_links").upsert({ event_id: eventId, profile_id: profileId, connection_id: conn.id, google_event_id: created.id });
        }
      } else if (googleId) {
        await call(token, "DELETE", `${API}/${encodeURIComponent(googleId)}`);
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
