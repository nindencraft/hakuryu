import { describe, expect, it } from "vitest";
import { normalizarPermissoesPainel } from "./permissoes-painel";

describe("permissões de cargos personalizados", () => {
  it("mantém somente as permissões oficiais e remove duplicidades", () => {
    expect(normalizarPermissoesPainel(["gerenciar_eventos", "inexistente", "gerenciar_eventos"])).toEqual([
      "gerenciar_eventos",
    ]);
  });

  it("aceita uma lista vazia sem criar permissões implícitas", () => {
    expect(normalizarPermissoesPainel([])).toEqual([]);
  });
});
