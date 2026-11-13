import { describe, expect, it } from "vitest";
import { assignmentState, durationLabel, progressOf, videoEmbed } from ".";

describe("videoEmbed", () => {
  it("YouTube (watch, youtu.be, shorts)", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ?t=10")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.provider).toBe("YouTube");
  });
  it("Loom, Drive e Vimeo", () => {
    expect(videoEmbed("https://www.loom.com/share/abc123def456")?.src).toBe("https://www.loom.com/embed/abc123def456");
    expect(videoEmbed("https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing")?.src).toBe("https://drive.google.com/file/d/1AbCdEfGhIjK/preview");
    expect(videoEmbed("https://vimeo.com/123456789")?.src).toBe("https://player.vimeo.com/video/123456789");
  });
  it("outros sites e http não viram iframe", () => {
    expect(videoEmbed("https://exemplo.com/video.mp4")).toBeNull();
    expect(videoEmbed("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbed("não é link")).toBeNull();
    expect(videoEmbed("https://www.youtube.com/watch?v=<script>")).toBeNull();
  });
});

describe("progressOf", () => {
  it("conta só as aulas que existem", () => {
    expect(progressOf(["a", "b", "c", "d"], new Set(["a", "c", "x"]))).toEqual({ done: 2, total: 4, pct: 50, complete: false });
    expect(progressOf(["a"], new Set(["a"])).complete).toBe(true);
    expect(progressOf([], new Set()).complete).toBe(false);
  });
});

describe("assignmentState", () => {
  it("prazo em São Paulo", () => {
    expect(assignmentState("2026-11-10", false, "2026-11-13")).toBe("atrasado");
    expect(assignmentState("2026-11-13", false, "2026-11-13")).toBe("no_prazo");
    expect(assignmentState(null, false, "2026-11-13")).toBe("sem_prazo");
    expect(assignmentState("2026-11-10", true, "2026-11-13")).toBe("concluido");
  });
});

it("durationLabel", () => {
  expect(durationLabel(12)).toBe("12 min");
  expect(durationLabel(90)).toBe("1 h 30 min");
  expect(durationLabel(120)).toBe("2 h");
});
