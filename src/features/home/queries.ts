import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/dal";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export type Pending = { id: string; kind: "task" | "checklist"; title: string; client: string | null; href: string; dueAt: string | null };

/** O que está na mão da pessoa: demandas abertas e itens de onboarding. */
export async function myPending(user: CurrentUser): Promise<Pending[]> {
  const supabase = await createClient();
  const [tasks, checklist] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, client_id, clients(name)")
      .eq("assignee_id", user.id)
      .not("status", "in", "(concluido,cancelado,aprovado)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("onboarding_checklist_items")
      .select("id, title, due_at, client_id, clients(name)")
      .eq("assignee_id", user.id)
      .is("done_at", null)
      .order("due_at", { ascending: true })
      .limit(30),
  ]);
  const list: Pending[] = [
    ...(tasks.data ?? []).map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      client: one(t.clients)?.name ?? null,
      href: t.client_id ? `/clientes/${t.client_id}/demanda` : "/inicio",
      dueAt: t.due_at,
    })),
    ...(checklist.data ?? []).map((c) => ({
      id: c.id,
      kind: "checklist" as const,
      title: `Onboarding: ${c.title}`,
      client: one(c.clients)?.name ?? null,
      href: `/clientes/${c.client_id}/ficha`,
      dueAt: c.due_at,
    })),
  ];
  return list.sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
}

export async function onboardingsInProgress() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, created_at, onboarding_checklist_items(done_at)")
    .eq("status", "onboarding")
    .is("deleted_at", null)
    .order("created_at");
  return (data ?? []).map((c) => {
    const items = c.onboarding_checklist_items ?? [];
    return { id: c.id, name: c.name, createdAt: c.created_at, done: items.filter((i) => i.done_at).length, total: items.length };
  });
}

export async function promisesDueSoon() {
  const supabase = await createClient();
  const limit = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("handoff_promises")
    .select("id, description, due_at, client_id, clients(name)")
    .is("done_at", null)
    .lte("due_at", limit)
    .order("due_at")
    .limit(20);
  return (data ?? []).map((p) => ({ id: p.id, description: p.description, dueAt: p.due_at, clientId: p.client_id, client: one(p.clients)?.name ?? "" }));
}
