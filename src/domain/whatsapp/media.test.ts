import { describe, expect, it } from "vitest";
import { baseMime, checkOutgoingMedia, extensionOf, incomingPath, isOutgoingPath, mediaView, outgoingPath, safeFileName, SERVABLE_MIME } from "./media";

const MB = 1024 * 1024;
const ORG = "0b9c3c2e-6f1e-4a37-9d1a-1a2b3c4d5e6f";

describe("checkOutgoingMedia", () => {
  it("aceita foto, vídeo, áudio gravado e documento", () => {
    expect(checkOutgoingMedia({ mime: "image/jpeg", size: MB })).toEqual({ ok: true, kind: "image" });
    expect(checkOutgoingMedia({ mime: "video/mp4", size: 10 * MB })).toEqual({ ok: true, kind: "video" });
    expect(checkOutgoingMedia({ mime: "audio/webm;codecs=opus", size: 200_000 })).toEqual({ ok: true, kind: "audio" });
    expect(checkOutgoingMedia({ mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: MB })).toEqual({ ok: true, kind: "document" });
  });
  it("recusa tipo estranho, vazio e grande demais, dizendo o que fazer", () => {
    expect(checkOutgoingMedia({ mime: "application/x-msdownload", size: MB })).toMatchObject({ ok: false });
    expect(checkOutgoingMedia({ mime: "image/png", size: 0 })).toEqual({ ok: false, message: "O arquivo está vazio." });
    expect(checkOutgoingMedia({ mime: "image/png", size: 6 * MB })).toEqual({ ok: false, message: "O arquivo passa do limite de 5 MB para este tipo. Envie um arquivo menor." });
  });
});

describe("como mostrar", () => {
  it("imagem, áudio, vídeo ou arquivo", () => {
    expect(mediaView("image/jpeg")).toBe("image");
    expect(mediaView("audio/ogg; codecs=opus")).toBe("audio");
    expect(mediaView("video/mp4")).toBe("video");
    expect(mediaView("application/pdf")).toBe("file");
    expect(mediaView(null)).toBe("file");
  });
  it("só serve tipos conhecidos", () => {
    expect(SERVABLE_MIME.test("image/png")).toBe(true);
    expect(SERVABLE_MIME.test("text/html")).toBe(false);
    expect(SERVABLE_MIME.test("image/svg+xml")).toBe(false);
  });
  it("nome e extensão seguros", () => {
    expect(safeFileName('relatório "final".pdf')).toBe("relatório _final_.pdf");
    expect(safeFileName(null)).toBe("arquivo");
    expect(extensionOf("audio/ogg; codecs=opus")).toBe("ogg");
    expect(baseMime("Audio/OGG; codecs=opus")).toBe("audio/ogg");
  });
});

describe("caminhos", () => {
  it("enviado: só o formato do sistema e da própria organização", () => {
    const p = outgoingPath(ORG, "11111111-2222-4333-8444-555555555555");
    expect(isOutgoingPath(p, ORG)).toBe(true);
    expect(isOutgoingPath(p.replace(ORG, "outra"), ORG)).toBe(false);
    expect(isOutgoingPath(`${ORG}/enviados/../segredo`, ORG)).toBe(false);
  });
  it("recebido: id da mensagem sem caracteres especiais", () => {
    expect(incomingPath(ORG, "c1", "false_5511@c.us_3EB0")).toBe(`${ORG}/c1/false_5511_c_us_3EB0`);
  });
});
