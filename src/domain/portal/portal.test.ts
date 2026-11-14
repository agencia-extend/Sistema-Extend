import { describe, expect, it } from "vitest";
import { activePortalHref, fileSize, milestoneState, monthProgress, monthlyQty, shortDay } from "./index";

describe("área do cliente", () => {
  it("marca a seção certa no menu", () => {
    expect(activePortalHref("/portal")).toBe("/portal");
    expect(activePortalHref("/portal/aprovacoes")).toBe("/portal/aprovacoes");
    expect(activePortalHref("/portal/cronograma/2026-11")).toBe("/portal/cronograma");
    expect(activePortalHref("/portal/qualquer")).toBe("/portal");
  });

  it("soma o progresso do mês sem passar de 100%", () => {
    expect(monthProgress([])).toEqual({ total: 0, done: 0, percent: null });
    expect(monthProgress([{ name: "Vídeos", total: 8, done: 3 }, { name: "Artes", total: 4, done: 4 }])).toEqual({ total: 12, done: 7, percent: 58 });
    expect(monthProgress([{ name: "X", total: 2, done: 5 }]).percent).toBe(100);
  });

  it("situação dos marcos em relação a hoje", () => {
    expect(milestoneState({ due_on: "2026-11-10", done_at: "2026-11-09T12:00:00Z" }, "2026-11-14")).toBe("feito");
    expect(milestoneState({ due_on: "2026-11-10", done_at: null }, "2026-11-14")).toBe("atrasado");
    expect(milestoneState({ due_on: "2026-11-20", done_at: null }, "2026-11-14")).toBe("previsto");
    expect(milestoneState({ due_on: null, done_at: null }, "2026-11-14")).toBe("sem_data");
  });

  it("formata datas, tamanhos e quantidades", () => {
    expect(shortDay("2026-03-07")).toBe("07/03");
    expect(fileSize(null)).toBe("");
    expect(fileSize(300)).toBe("1 KB");
    expect(fileSize(2.4 * 1024 * 1024)).toBe("2,4 MB");
    expect(monthlyQty(8)).toBe("8 por mês");
    expect(monthlyQty(0)).toBeNull();
  });
});
