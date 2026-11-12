import { describe, expect, it } from "vitest";
import { dueState, findMentions, formatDuration, positionBetween, totalMs } from "./index";

describe("posição no quadro", () => {
  it("entre vizinhos", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(null, 2000)).toBe(1000);
    expect(positionBetween(1000, null)).toBe(2000);
    expect(positionBetween(null, null)).toBe(1000);
  });
});

describe("tempo", () => {
  it("soma intervalos, inclusive o aberto", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(
      totalMs([{ started_at: "2026-11-10T10:00:00Z", ended_at: "2026-11-10T10:30:00Z" }, { started_at: "2026-11-10T11:00:00Z", ended_at: null }], now),
    ).toBe(90 * 60_000);
  });
  it("formata", () => {
    expect(formatDuration(90 * 60_000)).toBe("1h30");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(27 * 3600_000)).toBe("1 dia 3h");
    expect(formatDuration(10_000)).toBe("menos de 1 min");
  });
});

describe("prazo", () => {
  const now = new Date("2026-11-10T15:00:00Z"); // 12h em São Paulo
  it("classifica", () => {
    expect(dueState("2026-11-10T14:00:00Z", "pendente", now)).toBe("late");
    expect(dueState("2026-11-11T01:00:00Z", "pendente", now)).toBe("today"); // 22h em SP
    expect(dueState("2026-11-13T15:00:00Z", "pendente", now)).toBe("soon");
    expect(dueState("2026-12-30T15:00:00Z", "pendente", now)).toBe("later");
    expect(dueState("2026-11-01T15:00:00Z", "concluido", now)).toBe("done");
    expect(dueState(null, "pendente", now)).toBe("none");
  });
});

describe("menções", () => {
  const team = [
    { id: "j", name: "Jacqueline Souza" },
    { id: "p", name: "Priscila" },
  ];
  it("acha @primeiro nome e @nome completo, ignora e-mail", () => {
    expect(findMentions("@Jacqueline revisar, por favor", team)).toEqual(["j"]);
    expect(findMentions("ok @priscila.", team)).toEqual(["p"]);
    expect(findMentions("mande para joao@priscila.com", team)).toEqual([]);
    expect(findMentions("@Jacqueline Souza e @Priscila", team).sort()).toEqual(["j", "p"]);
  });
});
