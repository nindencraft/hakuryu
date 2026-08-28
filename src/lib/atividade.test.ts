import { describe, expect, it } from "vitest";
import {
  calcularPercentualParticipacao,
  ESTADO_ATIVIDADE,
  normalizarDataEvento,
} from "./atividade";

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

  it("usa somente a data do acontecimento do evento", () => {
    expect(normalizarDataEvento("2026-08-21T20:00:00.000Z")).toBe("2026-08-21");
    expect(normalizarDataEvento("2026-08-21")).toBe("2026-08-21");
    expect(normalizarDataEvento("21/08/2026")).toBe("2026-08-21");
    expect(normalizarDataEvento(null)).toBe("");
  });
});
