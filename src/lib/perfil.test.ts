import { describe, expect, it } from "vitest";

import { normalizarTotaisAtividade, somarTotaisAtividade } from "./perfil";

describe("totais de atividade do perfil", () => {
  it("remove valores inválidos e negativos", () => {
    expect(normalizarTotaisAtividade({ treinos: -4, amistosos: Number.NaN, guerras: 2.9 })).toEqual({
      treinos: 0,
      amistosos: 0,
      guerras: 2,
    });
  });

  it("soma atividades atuais e históricas", () => {
    expect(somarTotaisAtividade([
      { treinos: 3, amistosos: 1, guerras: 0 },
      { treinos: 2, amistosos: 0, guerras: 4 },
    ])).toEqual({ treinos: 5, amistosos: 1, guerras: 4 });
  });
});
