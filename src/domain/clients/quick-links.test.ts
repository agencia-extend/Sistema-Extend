import { describe, expect, it } from "vitest";
import { quickLinks, toQuickLink } from "./quick-links";

describe("links rápidos do cliente", () => {
  it("monta Instagram e TikTok a partir do @", () => {
    expect(toQuickLink("instagram", "@loja.exemplo")).toBe("https://instagram.com/loja.exemplo");
    expect(toQuickLink("tiktok", "loja_ex")).toBe("https://www.tiktok.com/@loja_ex");
    expect(toQuickLink("instagram", "https://instagram.com/loja")).toBe("https://instagram.com/loja");
    expect(toQuickLink("instagram", "não é perfil")).toBeNull();
  });

  it("aceita site sem https e recusa o que não é endereço", () => {
    expect(toQuickLink("site", "loja.com.br")).toBe("https://loja.com.br/");
    expect(toQuickLink("drive_folder", "https://drive.google.com/drive/folders/abc")).toBe("https://drive.google.com/drive/folders/abc");
    expect(toQuickLink("site", "javascript:alert(1)")).toBeNull();
    expect(toQuickLink("page", "Página da loja")).toBeNull();
  });

  it("WhatsApp com DDD vira wa.me com 55", () => {
    expect(toQuickLink("whatsapp", "(41) 99999-0000")).toBe("https://wa.me/5541999990000");
    expect(toQuickLink("whatsapp", "+55 41 99999-0000")).toBe("https://wa.me/5541999990000");
    expect(toQuickLink("whatsapp", "9999")).toBeNull();
  });

  it("ordena, ignora contas sem link e diferencia repetidas pelo rótulo", () => {
    const links = quickLinks([
      { kind: "bm", value: "123", label: null },
      { kind: "site", value: "loja.com.br", label: null },
      { kind: "instagram", value: "@a", label: "Matriz" },
      { kind: "instagram", value: "@b", label: "Filial" },
    ]);
    expect(links.map((l) => l.label)).toEqual(["Instagram (Matriz)", "Instagram (Filial)", "Site"]);
  });
});
