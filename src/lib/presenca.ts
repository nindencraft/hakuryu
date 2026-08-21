export type InscricaoParaContagem = {
  treino_id: number;
  inscricao: string | null;
  justificativa?: string | null;
};

/**
 * A inscrição efetiva é independente do resultado da avaliação de presença.
 * Presente, Ausente ou Justificado não reduzem a contagem, mas a pessoa que
 * escolheu “Não vou” tem uma justificativa pendente e deixa de ser inscrita.
 */
export function contarInscricoesConfirmadas(
  inscricoes: InscricaoParaContagem[],
): Map<number, number> {
  const contagem = new Map<number, number>();
  for (const inscricao of inscricoes) {
    if (inscricao.inscricao !== "Confirmado" || inscricao.justificativa?.trim()) continue;
    contagem.set(
      inscricao.treino_id,
      (contagem.get(inscricao.treino_id) ?? 0) + 1,
    );
  }
  return contagem;
}
