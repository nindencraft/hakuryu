import type { StatusAtividade } from "./types";

export function normalizarDataEvento(valor: string | null | undefined): string {
  const texto = (valor ?? "").trim();
  if (!texto) return "";
  const iso = texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const brasileiro = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return brasileiro ? `${brasileiro[3]}-${brasileiro[2]}-${brasileiro[1]}` : "";
}

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
