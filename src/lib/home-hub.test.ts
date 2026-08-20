import { describe, expect, it } from "vitest";

import { acaoPainelHome } from "./home-hub";

describe("acaoPainelHome", () => {
  it("abre o painel somente com uma gang selecionada e acesso autorizado", () => {
    expect(acaoPainelHome({ permitido: true, gangId: 12, quantidadeDeGangs: 1 })).toBe("abrir-painel");
  });

  it("solicita escolha de gang quando a conta possui opções, mas nenhuma está selecionada", () => {
    expect(acaoPainelHome({ permitido: true, gangId: null, quantidadeDeGangs: 2 })).toBe("escolher-gang");
  });

  it("mantém o painel indisponível quando a gang selecionada não confirmou um cargo autorizado", () => {
    expect(acaoPainelHome({ permitido: false, gangId: 12, quantidadeDeGangs: 1 })).toBe("aguardar-acesso");
  });

  it("orienta o usuário sem gangs a explorar o hub sem negar o login", () => {
    expect(acaoPainelHome({ permitido: false, gangId: null, quantidadeDeGangs: 0 })).toBe("sem-gang");
  });
});
