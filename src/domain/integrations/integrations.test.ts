import { describe, expect, it } from "vitest";
import { connectionLabel, googleCustomerId, googleErrorMessage, googleEventBody, metaAccountId, metaErrorMessage, missingEnv, suggestClient } from ".";

describe("integrações", () => {
  it("lista as variáveis que faltam, ignorando espaço e aspas", () => {
    expect(missingEnv("meta", { META_APP_ID: "123", META_APP_SECRET: ' "" ', TOKEN_ENCRYPTION_KEY: "k", SUPABASE_SECRET_KEY: "s" })).toEqual(["META_APP_SECRET"]);
    expect(missingEnv("google", {})).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "SUPABASE_SECRET_KEY"]);
  });

  it("normaliza os identificadores", () => {
    expect(metaAccountId("123456")).toBe("act_123456");
    expect(metaAccountId("act_123456")).toBe("act_123456");
    expect(googleCustomerId("1234567890")).toBe("123-456-7890");
  });

  it("sugere o cliente que já tem a conta cadastrada (só se for um)", () => {
    const accounts = [
      { clientId: "a", kind: "ad_account_meta", value: "act_111" },
      { clientId: "b", kind: "ad_account_google", value: "123-456-7890" },
      { clientId: "c", kind: "ad_account_meta", value: "222" },
      { clientId: "d", kind: "ad_account_meta", value: "act_222" },
    ];
    expect(suggestClient({ provider: "meta", externalId: "act_111" }, accounts)).toBe("a");
    expect(suggestClient({ provider: "google", externalId: "1234567890" }, accounts)).toBe("b");
    expect(suggestClient({ provider: "meta", externalId: "act_222" }, accounts)).toBeNull();
    expect(suggestClient({ provider: "google", externalId: "act_111" }, accounts)).toBeNull();
  });

  it("traduz os erros e marca quando é preciso reconectar", () => {
    expect(metaErrorMessage(190).expired).toBe(true);
    expect(metaErrorMessage(17).message).toMatch(/limitou/);
    expect(googleErrorMessage("invalid_grant").expired).toBe(true);
    expect(googleErrorMessage("CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION").message).toMatch(/Explorer ou Basic/);
  });

  it("mostra a situação da conexão", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(connectionLabel({ status: "active", expiresAt: null }, now)).toBe("Conectada");
    expect(connectionLabel({ status: "active", expiresAt: "2026-11-18T12:00:00Z" }, now)).toBe("Vence em 3 dias");
    expect(connectionLabel({ status: "active", expiresAt: "2026-11-14T12:00:00Z" }, now)).toBe("Expirada");
    expect(connectionLabel({ status: "active", expiresAt: "2026-11-14T12:00:00Z", hasRefresh: true }, now)).toBe("Conectada");
    expect(connectionLabel({ status: "error", expiresAt: null }, now)).toBe("Com erro");
  });
});

describe("evento na Google Agenda", () => {
  it("monta o corpo com cliente, observações, link e o endereço no sistema", () => {
    const body = googleEventBody({
      title: "Gravação: Loja Sol",
      startsAt: "2026-11-20T13:00:00.000Z",
      endsAt: "2026-11-20T15:00:00.000Z",
      location: "Rua A, 10",
      link: null,
      notes: "Levar luz",
      clientName: "Loja Sol",
      url: "https://hub.agenciaextend.com.br/agenda",
    });
    expect(body.summary).toBe("Gravação: Loja Sol");
    expect(body.description).toBe("Cliente: Loja Sol\n\nLevar luz\n\nAberto no Sistema Extend: https://hub.agenciaextend.com.br/agenda");
    expect(body.start).toEqual({ dateTime: "2026-11-20T13:00:00.000Z", timeZone: "America/Sao_Paulo" });
    expect(body.location).toBe("Rua A, 10");
  });
});
