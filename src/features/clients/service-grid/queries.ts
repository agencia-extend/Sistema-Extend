import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/domain/media";

export type GridService = { id: string; name: string; unit: string };
export type GridCell = { current: number | null; next: { qty: number; from: string } | null };
export type GridRow = { clientId: string; name: string; code: number | null; cells: Record<string, GridCell> };

/** Clientes ativos × serviços com quantidade mensal: o que vale hoje e a mudança já agendada. A RLS filtra. */
export async function serviceGrid(): Promise<{ services: GridService[]; rows: GridRow[] }> {
  const supabase = await createClient();
  const today = todayKey(new Date());
  const [{ data: catalog, error: e1 }, { data: clients, error: e2 }] = await Promise.all([
    supabase.from("service_catalog").select("id, name, unit").eq("is_active", true).neq("unit", "nenhuma").order("name"),
    supabase
      .from("clients")
      .select("id, name, code, client_services(service_id, monthly_qty, starts_on, ends_on)")
      .eq("status", "ativo")
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const services = (catalog ?? []).map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
  const rows = (clients ?? []).map((c) => {
    const cells: Record<string, GridCell> = {};
    for (const s of services) {
      const list = (c.client_services ?? []).filter((x) => x.service_id === s.id);
      const cur = list.find((x) => x.starts_on <= today && (!x.ends_on || x.ends_on >= today));
      const nxt = list.filter((x) => x.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
      cells[s.id] = { current: cur ? cur.monthly_qty : null, next: nxt ? { qty: nxt.monthly_qty, from: nxt.starts_on } : null };
    }
    return { clientId: c.id, name: c.name, code: (c as { code?: number | null }).code ?? null, cells };
  });
  return { services, rows };
}
