import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRIVACY_VERSION, type RequestKind, type RequestStatus } from "@/domain/privacy";

export type Controller = { legalName: string | null; cnpj: string | null; address: string | null; dpoName: string | null; dpoEmail: string | null };

const EMPTY: Controller = { legalName: null, cnpj: null, address: null, dpoName: null, dpoEmail: null };

/**
 * Dados do controlador para as páginas públicas (/privacidade, /termos), que abrem sem login.
 * Só lê estes campos públicos por natureza (quem responde pelos dados e como falar com ele).
 */
export const publicController = cache(async (): Promise<Controller> => {
  if (!process.env.SUPABASE_SECRET_KEY) return EMPTY;
  const { data } = await createAdminClient().from("privacy_settings").select("legal_name, cnpj, address, dpo_name, dpo_email").limit(1).maybeSingle();
  if (!data) return EMPTY;
  return { legalName: data.legal_name, cnpj: data.cnpj, address: data.address, dpoName: data.dpo_name, dpoEmail: data.dpo_email };
});

export type PrivacyRequestRow = {
  id: string;
  kind: RequestKind;
  details: string | null;
  status: RequestStatus;
  response: string | null;
  dueOn: string;
  createdAt: string;
  resolvedAt: string | null;
  person: { id: string; name: string; email: string } | null;
};

type Raw = {
  id: string;
  kind: string;
  details: string | null;
  status: string;
  response: string | null;
  due_on: string;
  created_at: string;
  resolved_at: string | null;
  profiles?: { id: string; full_name: string; email: string } | { id: string; full_name: string; email: string }[] | null;
};

function toRow(r: Raw): PrivacyRequestRow {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id: r.id,
    kind: r.kind as RequestKind,
    details: r.details,
    status: r.status as RequestStatus,
    response: r.response,
    dueOn: r.due_on,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    person: p ? { id: p.id, name: p.full_name || p.email, email: p.email } : null,
  };
}

export async function myRequests(userId: string): Promise<PrivacyRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_requests")
    .select("id, kind, details, status, response, due_on, created_at, resolved_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toRow(r as Raw));
}

/** Para quem atende (privacy.manage): todos os pedidos, abertos primeiro. A RLS filtra. */
export async function allRequests(): Promise<PrivacyRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_requests")
    .select("id, kind, details, status, response, due_on, created_at, resolved_at, profiles!privacy_requests_profile_id_fkey(id, full_name, email)")
    .order("due_on", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((r) => toRow(r as Raw));
  const open = (s: RequestStatus) => (s === "aberto" || s === "em_andamento" ? 0 : 1);
  return rows.sort((a, b) => open(a.status) - open(b.status) || (open(a.status) === 0 ? a.dueOn.localeCompare(b.dueOn) : b.createdAt.localeCompare(a.createdAt)));
}

export async function controllerForEdit(): Promise<Controller> {
  const supabase = await createClient();
  const { data } = await supabase.from("privacy_settings").select("legal_name, cnpj, address, dpo_name, dpo_email").maybeSingle();
  if (!data) return EMPTY;
  return { legalName: data.legal_name, cnpj: data.cnpj, address: data.address, dpoName: data.dpo_name, dpoEmail: data.dpo_email };
}

/** Quantas pessoas ativas já registraram ciência da versão atual da política. */
export async function consentCoverage(): Promise<{ aware: number; total: number }> {
  const supabase = await createClient();
  const [{ count: total }, { count: aware }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("privacy_consents").select("profile_id, profiles!inner(is_active)", { count: "exact", head: true }).eq("version", PRIVACY_VERSION).eq("profiles.is_active", true),
  ]);
  return { aware: aware ?? 0, total: total ?? 0 };
}
