import { describe, expect, it } from "vitest";
import { canAny, canDelegate, effectivePermission, isPermissionKey, scopeAtLeast } from "./index";

describe("effectivePermission", () => {
  it("negar anula o papel", () => {
    expect(effectivePermission("all", { effect: "deny", scope: "all" })).toEqual({ scope: null, origin: "bloqueio" });
  });
  it("conceder amplia quando o escopo é maior", () => {
    expect(effectivePermission("own", { effect: "grant", scope: "clients" })).toEqual({ scope: "clients", origin: "excecao" });
  });
  it("conceder menor que o papel mantém o papel", () => {
    expect(effectivePermission("all", { effect: "grant", scope: "own" })).toEqual({ scope: "all", origin: "papel" });
  });
  it("sem papel e sem exceção não tem permissão", () => {
    expect(effectivePermission(undefined, undefined)).toEqual({ scope: null, origin: null });
  });
  it("só a exceção concede", () => {
    expect(effectivePermission(undefined, { effect: "grant", scope: "sector" })).toEqual({ scope: "sector", origin: "excecao" });
  });
});

describe("escopos", () => {
  it("ordem own < clients < sector < all", () => {
    expect(scopeAtLeast("all", "sector")).toBe(true);
    expect(scopeAtLeast("sector", "clients")).toBe(true);
    expect(scopeAtLeast("clients", "sector")).toBe(false);
    expect(scopeAtLeast(undefined, "own")).toBe(false);
  });
  it("delegação limitada ao próprio escopo", () => {
    expect(canDelegate({ "tasks.read": "clients" }, false, "tasks.read", "own")).toBe(true);
    expect(canDelegate({ "tasks.read": "clients" }, false, "tasks.read", "all")).toBe(false);
    expect(canDelegate({}, false, "users.manage", "all")).toBe(false);
    expect(canDelegate({}, true, "users.manage", "all")).toBe(true);
  });
  it("canAny e isPermissionKey", () => {
    expect(canAny({ "ads.read": "all" }, ["tasks.read", "ads.read"])).toBe(true);
    expect(canAny({}, ["ads.read"])).toBe(false);
    expect(isPermissionKey("ads.read")).toBe(true);
    expect(isPermissionKey("ads.qualquer")).toBe(false);
  });
});
