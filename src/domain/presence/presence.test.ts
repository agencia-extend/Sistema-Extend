import { describe, expect, it } from "vitest";
import { onlineLabel, onlinePeople } from ".";

describe("presença", () => {
  it("uma pessoa por chave, você primeiro e o resto por nome", () => {
    const list = onlinePeople(
      {
        b: [{ id: "b", name: "Bruna", role: "Designer", at: "2026-11-16T10:05:00Z" }],
        me: [
          { id: "me", name: "Henrique", role: "Administrador", at: "2026-11-16T10:10:00Z" },
          { id: "me", name: "Henrique", role: "Administrador", at: "2026-11-16T09:00:00Z" },
        ],
        a: [{ id: "a", name: "Ágata", role: "Social media", at: "2026-11-16T10:00:00Z" }],
        vazio: [],
      },
      "me",
    );
    expect(list.map((p) => p.name)).toEqual(["Henrique", "Ágata", "Bruna"]);
    expect(list[0]).toMatchObject({ me: true, since: "2026-11-16T09:00:00Z" });
  });

  it("rótulo", () => {
    expect(onlineLabel(1)).toBe("Só você online");
    expect(onlineLabel(4)).toBe("4 online");
  });
});
