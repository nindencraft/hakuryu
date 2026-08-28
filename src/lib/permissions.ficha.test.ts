import { describe, expect, it } from "vitest";

import { podeEditarFichaRPG, type SessionUserView } from "./permissions";
import { normalizarPermissoesPainel } from "./permissoes-painel";

function usuario(roles: string[] = [], permissoes: string[] = []): SessionUserView {
  return {
    id: "123456789012345678",
    username: "jogador",
    globalName: "Jogador",
    avatarUrl: "",
    roles,
    isOwner: false,
    isSuperOwner: false,
    nomeRp: null,
    permissoes,
    cargosAtribuiveis: [],
  };
}

describe("permissão de edição da ficha RPG", () => {
  it("é normalizada como uma permissão oficial de cargo personalizado", () => {
    expect(normalizarPermissoesPainel(["editar_ficha_rpg"])).toEqual(["editar_ficha_rpg"]);
  });

  it.each(["Lider", "Vice-Lider", "Líder de Divisão"])(
    "autoriza o cargo padrão %s",
    (cargo) => {
      expect(podeEditarFichaRPG(usuario([cargo]))).toBe(true);
    },
  );

  it("autoriza a permissão personalizada e o Super Owner", () => {
    expect(podeEditarFichaRPG(usuario([], ["editar_ficha_rpg"]))).toBe(true);
    expect(podeEditarFichaRPG({ ...usuario(), isSuperOwner: true })).toBe(true);
  });

  it("não autoriza membro sem cargo ou permissão", () => {
    expect(podeEditarFichaRPG(usuario(["Membro"]))).toBe(false);
  });
});
