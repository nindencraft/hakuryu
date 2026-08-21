import { describe, expect, it } from "vitest";

import { exigirSessaoPublica } from "./acesso-publico";

describe("exigirSessaoPublica", () => {
  it("permite uma sessão autenticada sem avaliar gang ou cargos", () => {
    const usuario = { id: "discord-123", gangId: null, roles: [] };
    expect(exigirSessaoPublica(usuario)).toBe(usuario);
  });

  it("rejeita apenas quando não existe uma sessão autenticada", () => {
    expect(() => exigirSessaoPublica(null)).toThrow("NAO_AUTENTICADO");
  });
});
