import { describe, expect, it } from "vitest";

import { categoriaExploradorOuErro, normalizarEtiquetas, statusExploradorOuErro } from "./explorador";

describe("Explorador", () => {
  it("aceita somente as categorias públicas planejadas", () => {
    expect(categoriaExploradorOuErro("roleplay")).toBe("roleplay");
    expect(() => categoriaExploradorOuErro("gang")).toThrow("Roleplay ou Comunidade");
  });

  it("remove etiquetas repetidas sem perder a forma original", () => {
    expect(normalizarEtiquetas(["Escolar", " escolar ", "RP sério"])).toEqual(["Escolar", "RP sério"]);
  });

  it("rejeita status fora do fluxo de moderação", () => {
    expect(statusExploradorOuErro("pendente")).toBe("pendente");
    expect(() => statusExploradorOuErro("publicado")).toThrow("Status de moderação inválido");
  });
});
