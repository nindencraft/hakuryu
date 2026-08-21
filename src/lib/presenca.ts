export type InscricaoParaContagem = {
  treino_id: number;
  inscricao: string | null;
  justificativa?: string | null;
  presenca?: string | null;
  avaliado_por?: string | null;
};

/**
 * A inscrição efetiva é independente do resultado da avaliação de presença.
 * Presente, Ausente ou Justificado avaliados pela liderança não reduzem a
 * contagem, mas a pessoa que escolheu “Não vou” deixa de ser inscrita. A
 * ausência automática do encerramento também não representa inscrição.
 */
export function contarInscricoesConfirmadas(
  inscricoes: InscricaoParaContagem[],
): Map<number, number> {
  const contagem = new Map<number, number>();
  for (const inscricao of inscricoes) {
    const ausenciaAutomatica =
      inscricao.presenca === "Ausente" &&
      !inscricao.justificativa?.trim() &&
      !inscricao.avaliado_por;
    if (inscricao.inscricao !== "Confirmado" || inscricao.justificativa?.trim() || ausenciaAutomatica) continue;
    contagem.set(
      inscricao.treino_id,
      (contagem.get(inscricao.treino_id) ?? 0) + 1,
    );
  }
  return contagem;
}
