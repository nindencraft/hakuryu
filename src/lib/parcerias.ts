export type ParceriaParaComparacao = {
  id: number;
  nome: string | null;
  tag: string | null;
  link_servidor: string | null;
};

export type CandidataParceria = Omit<ParceriaParaComparacao, "id"> & {
  id: number | null;
};

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\/+$/, "")
    .replace(/\s+/g, " ");
}

/** Retorna uma parceria equivalente, ignorando o próprio registro em edição. */
export function encontrarParceriaDuplicada(
  existentes: ParceriaParaComparacao[],
  candidata: CandidataParceria,
): ParceriaParaComparacao | null {
  const tag = normalizar(candidata.tag);
  const link = normalizar(candidata.link_servidor);
  const nome = normalizar(candidata.nome);

  return (
    existentes.find((existente) => {
      if (candidata.id != null && existente.id === candidata.id) return false;

      const mesmaTag = !!tag && tag === normalizar(existente.tag);
      const mesmoLink = !!link && link === normalizar(existente.link_servidor);
      const mesmoNome = !!nome && nome === normalizar(existente.nome);

      // Tag e convite identificam o servidor. Sem nenhum dos dois, o nome é a
      // melhor proteção disponível contra salvar duas vezes a mesma aliança.
      return tag || link ? mesmaTag || mesmoLink : mesmoNome;
    }) ?? null
  );
}
