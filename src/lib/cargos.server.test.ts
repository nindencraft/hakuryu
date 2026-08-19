import { describe, expect, it } from "vitest";

import {
  canonizarCargos,
  temCargoConfiguradoComAcesso,
  type MapaCargos,
} from "./cargos.server";

function criarMapa(configuracao: Record<string, string>): MapaCargos {
  return {
    porCargo: new Map(Object.entries(configuracao)),
    porRoleId: new Map(Object.entries(configuracao).map(([cargo, id]) => [id, cargo])),
  };
}

describe("acesso por cargo configurado da gang", () => {
  it("libera somente o ID configurado para Membro ou superior", () => {
    const mapa = criarMapa({ Membro: "100", Lider: "200" });

    expect(temCargoConfiguradoComAcesso(mapa, ["100"])).toBe(true);
    expect(temCargoConfiguradoComAcesso(mapa, ["200"])).toBe(true);
  });

  it("bloqueia nome coincidente quando o ID do cargo não foi configurado", () => {
    const mapa = criarMapa({ Membro: "100" });

    expect(temCargoConfiguradoComAcesso(mapa, ["999"])).toBe(false);
    expect(canonizarCargos(mapa, ["999"], ["Membro"])).toEqual([]);
  });

  it("não considera Em Analise como cargo de acesso", () => {
    const mapa = criarMapa({ "Em Analise": "300", Membro: "100" });

    expect(temCargoConfiguradoComAcesso(mapa, ["300"])).toBe(false);
  });
});
