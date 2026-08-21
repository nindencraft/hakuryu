import { describe, expect, it } from "vitest";
import { calcularPercentualParticipacao, ESTADO_ATIVIDADE } from "./atividade";

describe("atividade", () => {
  it("associa cada estado ao indicador visual fixo", () => {
    expect(ESTADO_ATIVIDADE.Presente.icone).toBe("🟢");
    expect(ESTADO_ATIVIDADE.Ausente.icone).toBe("🔴");
    expect(ESTADO_ATIVIDADE.Justificado.icone).toBe("🟡");
  });

  it("considera justificativas aceitas como participação válida", () => {
    expect(calcularPercentualParticipacao(2, 1, 4)).toBe(75);
    expect(calcularPercentualParticipacao(0, 0, 0)).toBe(0);
  });
});
