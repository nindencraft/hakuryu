import { describe, expect, it } from "vitest";

import { descricaoRecrutamentoValida, linkPublicoRecrutamento } from "./recrutamento";

describe("recrutamento de gangs", () => {
  it("prioriza o link manual quando a liderança o informa", () => {
    expect(linkPublicoRecrutamento("https://discord.gg/manual", "https://discord.gg/automatico")).toBe(
      "https://discord.gg/manual",
    );
  });

  it("usa o convite automático quando não existe substituição manual", () => {
    expect(linkPublicoRecrutamento("", "https://discord.gg/automatico")).toBe(
      "https://discord.gg/automatico",
    );
  });

  it("valida o tamanho da descrição pública", () => {
    expect(descricaoRecrutamentoValida("Gang ativa em busca de novos membros.")).toBe(true);
    expect(descricaoRecrutamentoValida("curta")).toBe(false);
  });
});
