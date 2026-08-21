import { describe, expect, it } from "vitest";

import { contarInscricoesConfirmadas } from "./presenca";

describe("contarInscricoesConfirmadas", () => {
  it("mantém o inscrito na contagem depois de sua presença ser avaliada", () => {
    const contagem = contarInscricoesConfirmadas([
      { treino_id: 10, inscricao: "Confirmado" },
      { treino_id: 10, inscricao: "Confirmado" },
    ]);

    expect(contagem.get(10)).toBe(2);
  });

  it("remove da contagem quem enviou a justificativa de que não irá", () => {
    const contagem = contarInscricoesConfirmadas([
      { treino_id: 10, inscricao: "Confirmado" },
      { treino_id: 10, inscricao: "Confirmado", justificativa: "Estarei trabalhando." },
    ]);

    expect(contagem.get(10)).toBe(1);
  });

  it("ignora registros sem a inscrição confirmada", () => {
    const contagem = contarInscricoesConfirmadas([
      { treino_id: 10, inscricao: null },
      { treino_id: 10, inscricao: "Outro valor" },
    ]);

    expect(contagem.get(10) ?? 0).toBe(0);
  });
});
