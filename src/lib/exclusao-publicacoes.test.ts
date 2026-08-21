import { describe, expect, it } from "vitest";

import {
  podeExcluirRecrutamentoPublico,
  podeExcluirServidorExploradorPublico,
} from "./exclusao-publicacoes";

describe("permissões de exclusão de publicações públicas", () => {
  it("permite que a liderança da gang apague somente seu recrutamento", () => {
    expect(podeExcluirRecrutamentoPublico({ gangId: 8, isSuperOwner: false, podeGerenciarRecrutamento: true }, 8)).toBe(true);
    expect(podeExcluirRecrutamentoPublico({ gangId: 8, isSuperOwner: false, podeGerenciarRecrutamento: true }, 9)).toBe(false);
  });

  it("permite que o Super Owner remova qualquer recrutamento", () => {
    expect(podeExcluirRecrutamentoPublico({ gangId: 8, isSuperOwner: true, podeGerenciarRecrutamento: false }, 9)).toBe(true);
  });

  it("permite excluir servidor do Explorador apenas ao autor ou Super Owner", () => {
    expect(podeExcluirServidorExploradorPublico({ discordId: "autor", isSuperOwner: false }, "autor")).toBe(true);
    expect(podeExcluirServidorExploradorPublico({ discordId: "visitante", isSuperOwner: false }, "autor")).toBe(false);
    expect(podeExcluirServidorExploradorPublico({ discordId: "visitante", isSuperOwner: true }, "autor")).toBe(true);
  });
});
