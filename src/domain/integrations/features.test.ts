import { describe, expect, it } from "vitest";
import { metaFeatureStatus } from "./index";

describe("metaFeatureStatus", () => {
  it("conexão só de leitura: falta ajustar, Instagram e publicar", () => {
    const r = metaFeatureStatus(["pages_show_list", "ads_read", "business_management", "pages_read_engagement", "public_profile"]);
    expect(r.filter((f) => f.missing.length === 0).map((f) => f.label)).toEqual(["Ler contas, campanhas e números", "Páginas do Facebook e publicações"]);
    expect(r.find((f) => f.label.startsWith("Programar publicações no Instagram"))!.missing).toEqual(["instagram_basic", "instagram_content_publish"]);
  });
  it("com tudo, nada falta", () => {
    const all = ["ads_read", "business_management", "ads_management", "pages_show_list", "pages_read_engagement", "instagram_basic", "pages_manage_posts", "instagram_content_publish"];
    expect(metaFeatureStatus(all).every((f) => f.missing.length === 0)).toBe(true);
  });
});
