export type InscricaoParaContagem = {
  treino_id: number;
  inscricao: string | null;
};

/**
 * Uma inscrição é independente do resultado da avaliação de presença.
 * Assim, avaliações como Presente, Ausente ou Justificado nunca reduzem
 * a quantidade de pessoas que se inscreveram no evento.
 */
export function contarInscricoesConfirmadas(
  inscricoes: InscricaoParaContagem[],
): Map<number, number> {
  const contagem = new Map<number, number>();
  for (const inscricao of inscricoes) {
    if (inscricao.inscricao !== "Confirmado") continue;
    contagem.set(
      inscricao.treino_id,
      (contagem.get(inscricao.treino_id) ?? 0) + 1,
    );
  }
  return contagem;
}
