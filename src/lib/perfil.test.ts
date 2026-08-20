import { describe, expect, it } from "vitest";

import { normalizarFichaRPG, normalizarTotaisAtividade, somarTotaisAtividade } from "./perfil";

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

describe("ficha RPG global", () => {
  it("normaliza a ficha usando as opções oficiais", () => {
    expect(normalizarFichaRPG({
      nome_roblox: "  HakuryuPlayer  ",
      nome_rp: "  Ren Hakuryu  ",
      genero: "Masculino",
      altura_jogo: "1,82",
      estilo_luta_principal: "Kure",
    })).toEqual({
      nome_roblox: "HakuryuPlayer",
      nome_rp: "Ren Hakuryu",
      genero: "Masculino",
      altura_jogo: 1.82,
      estilo_luta_principal: "Kure",
    });
  });

  it("recusa gênero e estilo fora das opções permitidas", () => {
    expect(() => normalizarFichaRPG({
      nome_roblox: "",
      nome_rp: "",
      genero: "Outro",
      altura_jogo: "",
      estilo_luta_principal: "Basic",
    })).toThrow("Masculino ou Feminino");
    expect(() => normalizarFichaRPG({
      nome_roblox: "",
      nome_rp: "",
      genero: "Feminino",
      altura_jogo: "",
      estilo_luta_principal: "Inventado",
    })).toThrow("estilo de luta disponível");
  });
});
