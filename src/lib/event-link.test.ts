import { describe, expect, it } from "vitest";
import { normalizarLinkEvento } from "./event-link";

describe("normalizarLinkEvento", () => {
  it("mantém o campo opcional vazio como nulo", () => {
    expect(normalizarLinkEvento("   ")).toBeNull();
  });

  it("aceita URLs HTTP e HTTPS e remove espaços externos", () => {
    expect(normalizarLinkEvento(" https://www.roblox.com/share?code=abc ")).toBe(
      "https://www.roblox.com/share?code=abc",
    );
    expect(normalizarLinkEvento("http://example.test/sala")).toBe("http://example.test/sala");
  });

  it("rejeita texto livre e protocolos não web", () => {
    expect(() => normalizarLinkEvento("servidor-privado")).toThrow("URL válida");
    expect(() => normalizarLinkEvento("javascript:alert(1)")).toThrow("URL válida");
  });
});
