import { describe, expect, it } from "vitest";

import { podeEditarNoticia, podePublicarNoticia } from "./jornal.permissoes";

describe("podePublicarNoticia", () => {
  it("permite o Super Owner mesmo sem cadastro como jornalista", () => {
    expect(podePublicarNoticia({ isSuperOwner: true, jornalistaAtivo: false })).toBe(true);
  });

  it("permite somente jornalistas ativos", () => {
    expect(podePublicarNoticia({ isSuperOwner: false, jornalistaAtivo: true })).toBe(true);
    expect(podePublicarNoticia({ isSuperOwner: false, jornalistaAtivo: false })).toBe(false);
  });

  it("permite edição somente ao autor jornalista ativo ou ao Super Owner", () => {
    expect(
      podeEditarNoticia({
        isSuperOwner: false,
        jornalistaAtivo: true,
        autorDiscordId: "10",
        usuarioDiscordId: "10",
      }),
    ).toBe(true);
    expect(
      podeEditarNoticia({
        isSuperOwner: false,
        jornalistaAtivo: true,
        autorDiscordId: "10",
        usuarioDiscordId: "20",
      }),
    ).toBe(false);
    expect(
      podeEditarNoticia({
        isSuperOwner: false,
        jornalistaAtivo: false,
        autorDiscordId: "10",
        usuarioDiscordId: "10",
      }),
    ).toBe(false);
    expect(
      podeEditarNoticia({
        isSuperOwner: true,
        jornalistaAtivo: false,
        autorDiscordId: "10",
        usuarioDiscordId: "20",
      }),
    ).toBe(true);
  });
});
