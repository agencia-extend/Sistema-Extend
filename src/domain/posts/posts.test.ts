import { describe, expect, it } from "vitest";
import { driveFileId, formatFromContent, formatProblem, instagramCaptionProblem, isoToSp, publishErrorMessage, spToIso } from "./index";

describe("formatProblem", () => {
  it("feed: 1 a 10 imagens, sem vídeo", () => {
    expect(formatProblem("feed", { images: 3, videos: 0, caption: "" })).toBeNull();
    expect(formatProblem("feed", { images: 0, videos: 1, caption: "" })).toContain("Feed leva");
    expect(formatProblem("feed", { images: 11, videos: 0, caption: "" })).toContain("Até 10");
  });
  it("reels e vídeo: um vídeo; stories: uma mídia", () => {
    expect(formatProblem("reels", { images: 0, videos: 1, caption: "" })).toBeNull();
    expect(formatProblem("video", { images: 1, videos: 1, caption: "" })).toContain("Reels e Vídeo");
    expect(formatProblem("stories", { images: 1, videos: 0, caption: "" })).toBeNull();
    expect(formatProblem("stories", { images: 2, videos: 0, caption: "" })).toContain("Stories");
    expect(formatProblem("reels", { images: 0, videos: 2, caption: "" })).toContain("um vídeo só");
  });
});

describe("legenda do Instagram", () => {
  it("limite de caracteres e hashtags", () => {
    expect(instagramCaptionProblem("Oi #a #b")).toBeNull();
    expect(instagramCaptionProblem("x".repeat(2201))).toContain("2.200");
    expect(instagramCaptionProblem(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toContain("30 hashtags");
  });
});

describe("Drive, horário e erros", () => {
  it("link do Drive", () => {
    expect(driveFileId("https://drive.google.com/file/d/1AbCdEfGhIjK_lm-no/view?usp=sharing")).toBe("1AbCdEfGhIjK_lm-no");
    expect(driveFileId("https://drive.google.com/open?id=1AbCdEfGhIjKlmno")).toBe("1AbCdEfGhIjKlmno");
    expect(driveFileId("https://example.com/file/d/1AbCdEfGhIjKlmno")).toBeNull();
    expect(driveFileId("não é link")).toBeNull();
  });
  it("São Paulo ↔ ISO", () => {
    expect(spToIso("2026-11-20", "09:30")).toBe("2026-11-20T12:30:00.000Z");
    expect(isoToSp("2026-11-20T12:30:00.000Z")).toEqual({ date: "2026-11-20", time: "09:30" });
    expect(spToIso("20/11/2026", "9:30")).toBeNull();
  });
  it("erros da Meta e formato do cronograma", () => {
    expect(publishErrorMessage(190, undefined)).toContain("expirou");
    expect(publishErrorMessage(200, undefined)).toContain("permissão");
    expect(publishErrorMessage(100, "Imagem muito pequena")).toBe("A Meta recusou a publicação: Imagem muito pequena");
    expect(formatFromContent("video_curto")).toBe("reels");
    expect(formatFromContent("carrossel")).toBe("feed");
    expect(formatFromContent("stories")).toBe("stories");
  });
});
