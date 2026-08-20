import { describe, expect, it } from "vitest";

import { podePublicarNoticia } from "./jornal.permissoes";

describe("podePublicarNoticia", () => {
  it("permite o Super Owner mesmo sem cadastro como jornalista", () => {
    expect(podePublicarNoticia({ isSuperOwner: true, jornalistaAtivo: false })).toBe(true);
  });

  it("permite somente jornalistas ativos", () => {
    expect(podePublicarNoticia({ isSuperOwner: false, jornalistaAtivo: true })).toBe(true);
    expect(podePublicarNoticia({ isSuperOwner: false, jornalistaAtivo: false })).toBe(false);
  });
});
