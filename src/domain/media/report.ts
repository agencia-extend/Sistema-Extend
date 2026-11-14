// Controle Geral: produção por pessoa, entregue × contratado, gargalos e atrasos.
import { periodLabel } from "./index";

export type ReportTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  dueAt: string | null;
  clientId: string | null;
  clientName: string | null;
  stepName: string | null;
  stepColor: string;
  stepPosition: number;
  editorId: string | null;
  editorName: string | null;
  recorderId: string | null;
  recorderName: string | null;
  recordingOn: string | null;
  reworkCount: number;
};
export type ReportMonth = { clientId: string; number: number; startsOn: string; endsOn: string };
export type ReportSlot = { clientId: string; clientName: string; slotMonth: string; status: string; dueAt: string | null };

export type PersonRow = { id: string; name: string; finished: number; video: number; design: number; open: number; late: number; rework: number; recorded: number };
export type ClientRow = { id: string; name: string; period: string; number: number; contracted: number; delivered: number; late: number };
export type ProductionReport = {
  people: PersonRow[];
  clients: ClientRow[];
  steps: { name: string; color: string; count: number }[];
  totals: { finished: number; open: number; late: number; rework: number };
};

const DELIVERED = new Set(["concluido", "aprovado"]);

/**
 * @param finished conteúdos finalizados no período
 * @param open conteúdos em aberto agora
 * @param months mês atual de cada cliente
 * @param slots demandas dos meses atuais (para contratado × entregue)
 * @param range período escolhido (AAAA-MM-DD), para contar as gravações feitas nele
 */
export function buildReport(finished: ReportTask[], open: ReportTask[], months: ReportMonth[], slots: ReportSlot[], range: { from: string; to: string }, now: Date = new Date()): ProductionReport {
  const nowIso = now.toISOString();
  const people = new Map<string, PersonRow>();
  const person = (id: string, name: string | null) => {
    let p = people.get(id);
    if (!p) people.set(id, (p = { id, name: name ?? "Sem nome", finished: 0, video: 0, design: 0, open: 0, late: 0, rework: 0, recorded: 0 }));
    return p;
  };
  const isLate = (t: { dueAt: string | null }) => Boolean(t.dueAt && t.dueAt < nowIso);

  for (const t of finished) {
    if (t.editorId) {
      const p = person(t.editorId, t.editorName);
      p.finished++;
      if (t.type === "video") p.video++;
      else p.design++;
      p.rework += t.reworkCount;
    }
  }
  for (const t of open) {
    if (t.editorId) {
      const p = person(t.editorId, t.editorName);
      p.open++;
      if (isLate(t)) p.late++;
      p.rework += t.reworkCount;
    }
  }
  for (const t of [...finished, ...open]) {
    if (t.recorderId && t.recordingOn && t.recordingOn >= range.from && t.recordingOn <= range.to) person(t.recorderId, t.recorderName).recorded++;
  }

  const stepAgg = new Map<string, { name: string; color: string; count: number; position: number }>();
  for (const t of open) {
    if (!t.stepName) continue;
    const s = stepAgg.get(t.stepName) ?? { name: t.stepName, color: t.stepColor, count: 0, position: t.stepPosition };
    s.count++;
    stepAgg.set(t.stepName, s);
  }

  const monthOf = new Map(months.map((m) => [m.clientId, m]));
  const clients = new Map<string, ClientRow>();
  for (const s of slots) {
    const m = monthOf.get(s.clientId);
    if (!m || m.startsOn !== s.slotMonth || s.status === "cancelado") continue;
    const c = clients.get(s.clientId) ?? { id: s.clientId, name: s.clientName, period: periodLabel(m.startsOn, m.endsOn), number: m.number, contracted: 0, delivered: 0, late: 0 };
    c.contracted++;
    if (DELIVERED.has(s.status)) c.delivered++;
    else if (isLate(s)) c.late++;
    clients.set(s.clientId, c);
  }

  return {
    people: [...people.values()].sort((a, b) => b.finished - a.finished || b.open - a.open || a.name.localeCompare(b.name)),
    clients: [...clients.values()].sort((a, b) => a.delivered / a.contracted - b.delivered / b.contracted || a.name.localeCompare(b.name)),
    steps: [...stepAgg.values()].sort((a, b) => b.count - a.count || a.position - b.position).map(({ name, color, count }) => ({ name, color, count })),
    totals: {
      finished: finished.length,
      open: open.length,
      late: open.filter(isLate).length,
      rework: [...finished, ...open].reduce((n, t) => n + t.reworkCount, 0),
    },
  };
}

/** Linhas do relatório por pessoa em CSV (separador ; e BOM, para abrir no Excel em português). */
export function peopleCsv(rows: PersonRow[]): string {
  const head = ["Pessoa", "Finalizados", "Vídeos", "Artes", "Em aberto", "Atrasados", "Alterações", "Gravações"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((p) => [p.name, p.finished, p.video, p.design, p.open, p.late, p.rework, p.recorded].map(esc).join(";"));
  return `﻿${head.map(esc).join(";")}\r\n${lines.join("\r\n")}`;
}

/** O que está por trás de cada número do Controle geral (parâmetro "ver" da página). */
export type DrillKind = "finalizados" | "abertos" | "atrasados" | "alteracoes" | "videos" | "artes" | "gravacoes";
export const DRILL_LABEL: Record<DrillKind, string> = {
  finalizados: "Finalizados no período",
  abertos: "Em produção agora",
  atrasados: "Atrasados",
  alteracoes: "Com alterações pedidas",
  videos: "Vídeos finalizados",
  artes: "Artes finalizadas",
  gravacoes: "Gravações no período",
};

export type Drill = { kind: DrillKind; personId?: string } | { kind: "etapa"; step: string };

/** "atrasados", "pessoa:<id>:videos" ou "etapa:<nome>". Inválido = null. */
export function parseDrill(v: string | undefined): Drill | null {
  if (!v) return null;
  if (v.startsWith("etapa:")) return v.length > 6 ? { kind: "etapa", step: v.slice(6) } : null;
  const parts = v.split(":");
  const kind = (parts.length === 3 && parts[0] === "pessoa" ? parts[2] : parts[0]) as DrillKind;
  if (!(kind in DRILL_LABEL)) return null;
  if (parts.length === 3) return /^[0-9a-f-]{36}$/.test(parts[1]) ? { kind, personId: parts[1] } : null;
  return parts.length === 1 ? { kind } : null;
}

/** Demandas que compõem o número escolhido, com as mesmas regras de buildReport. */
export function drillTasks(d: Drill, finished: ReportTask[], open: ReportTask[], range: { from: string; to: string }, now: Date = new Date()): ReportTask[] {
  const nowIso = now.toISOString();
  const late = (t: ReportTask) => Boolean(t.dueAt && t.dueAt < nowIso);
  if (d.kind === "etapa") return open.filter((t) => t.stepName === d.step);
  const mine = (t: ReportTask) => !d.personId || t.editorId === d.personId;
  switch (d.kind) {
    case "finalizados":
      return finished.filter(mine);
    case "videos":
      return finished.filter((t) => mine(t) && t.type === "video");
    case "artes":
      return finished.filter((t) => mine(t) && t.type !== "video");
    case "abertos":
      return open.filter(mine);
    case "atrasados":
      return open.filter((t) => mine(t) && late(t));
    case "alteracoes":
      return [...finished, ...open].filter((t) => mine(t) && t.reworkCount > 0);
    case "gravacoes":
      return [...finished, ...open].filter(
        (t) => (!d.personId || t.recorderId === d.personId) && t.recorderId && t.recordingOn && t.recordingOn >= range.from && t.recordingOn <= range.to,
      );
  }
}
