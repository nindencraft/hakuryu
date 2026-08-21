import type { StatusAtividade } from "./types";

export const ESTADO_ATIVIDADE: Record<StatusAtividade, { icone: string; classe: string }> = {
  Presente: { icone: "🟢", classe: "emerald" },
  Ausente: { icone: "🔴", classe: "red" },
  Justificado: { icone: "🟡", classe: "amber" },
  Pendente: { icone: "⚪", classe: "slate" },
};

/** Presença e justificativa aceita contam como participação válida. */
export function calcularPercentualParticipacao(
  presente: number,
  justificado: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.round(((presente + justificado) / total) * 100);
}
