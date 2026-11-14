import { describe, expect, it } from "vitest";
import { durationDays, offsetLabel, previewMilestones, stepDue } from ".";

const steps = [
  { title: "Briefing", offsetDays: 0, dayKind: "uteis" as const, milestone: "Planejamento" },
  { title: "Pixel", offsetDays: 2, dayKind: "uteis" as const, milestone: "Planejamento" },
  { title: "Subir", offsetDays: 5, dayKind: "uteis" as const, milestone: "No ar" },
  { title: "Revisar", offsetDays: 10, dayKind: "corridos" as const, milestone: null },
];

describe("playbooks", () => {
  it("rótulo do prazo relativo", () => {
    expect(offsetLabel(0, "uteis")).toBe("D0");
    expect(offsetLabel(2, "uteis")).toBe("D+2 úteis");
    expect(offsetLabel(7, "corridos")).toBe("D+7");
  });

  it("datas iguais às do banco (feriado de 20/11)", () => {
    expect(stepDue("2026-11-13", steps[1])).toBe("2026-11-17");
    expect(stepDue("2026-11-13", steps[2])).toBe("2026-11-23");
    expect(stepDue("2026-11-13", steps[3])).toBe("2026-11-23");
  });

  it("prévia dos marcos e duração", () => {
    expect(previewMilestones("2026-11-13", steps)).toEqual([
      { title: "Planejamento", count: 2, dueOn: "2026-11-17" },
      { title: "No ar", count: 1, dueOn: "2026-11-23" },
      { title: "Outras etapas", count: 1, dueOn: "2026-11-23" },
    ]);
    expect(durationDays("2026-11-13", steps)).toBe(10);
  });
});
