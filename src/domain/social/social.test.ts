import { describe, expect, it } from "vitest";
import { isPermissionError, postFromFacebook, postFromInstagram, profilesFromPage } from "./index";

describe("profilesFromPage", () => {
  it("página com Instagram ligado vira dois perfis", () => {
    const r = profilesFromPage({
      id: "10", name: "Gastrô", followers_count: 1200, picture: { data: { url: "https://x/p.jpg" } },
      instagram_business_account: { id: "17", username: "gastro", followers_count: 4516, media_count: 172 },
    });
    expect(r).toEqual([
      { platform: "facebook", external_id: "10", page_external_id: null, name: "Gastrô", username: null, picture_url: "https://x/p.jpg", followers: 1200, media_count: null },
      { platform: "instagram", external_id: "17", page_external_id: "10", name: "gastro", username: "gastro", picture_url: null, followers: 4516, media_count: 172 },
    ]);
  });
  it("sem Instagram e sem seguidores: usa as curtidas da página", () => {
    const r = profilesFromPage({ id: "11", name: "Loja", fan_count: 80 });
    expect(r).toHaveLength(1);
    expect(r[0].followers).toBe(80);
  });
});

describe("publicações", () => {
  it("Facebook: reações, comentários e compartilhamentos", () => {
    const p = postFromFacebook({ id: "1_2", message: "Oi", created_time: "2026-11-16T12:00:00+0000", full_picture: "https://x/i.jpg", permalink_url: "https://fb/1", reactions: { summary: { total_count: 9 } }, comments: { summary: { total_count: 2 } } });
    expect(p).toMatchObject({ caption: "Oi", likes: 9, comments: 2, shares: 0, image_url: "https://x/i.jpg" });
  });
  it("Instagram: vídeo usa a capa; foto usa a mídia", () => {
    expect(postFromInstagram({ id: "a", media_type: "VIDEO", media_url: "v.mp4", thumbnail_url: "t.jpg", timestamp: "2026-11-16T12:00:00+0000" }).image_url).toBe("t.jpg");
    expect(postFromInstagram({ id: "b", media_type: "IMAGE", media_url: "i.jpg", timestamp: "2026-11-16T12:00:00+0000", like_count: 5 })).toMatchObject({ image_url: "i.jpg", likes: 5, shares: null });
  });
  it("erro de permissão", () => {
    expect(isPermissionError(10)).toBe(true);
    expect(isPermissionError(200)).toBe(true);
    expect(isPermissionError(190)).toBe(false);
    expect(isPermissionError(undefined)).toBe(false);
  });
});
