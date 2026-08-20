export type TotaisAtividadePerfil = {
  treinos: number;
  amistosos: number;
  guerras: number;
};

export const TOTAIS_ATIVIDADE_VAZIOS: TotaisAtividadePerfil = {
  treinos: 0,
  amistosos: 0,
  guerras: 0,
};

export function normalizarTotaisAtividade(input: Partial<TotaisAtividadePerfil> | null | undefined): TotaisAtividadePerfil {
  return {
    treinos: Math.max(0, Math.floor(Number(input?.treinos) || 0)),
    amistosos: Math.max(0, Math.floor(Number(input?.amistosos) || 0)),
    guerras: Math.max(0, Math.floor(Number(input?.guerras) || 0)),
  };
}

export function somarTotaisAtividade(itens: ReadonlyArray<Partial<TotaisAtividadePerfil> | null | undefined>): TotaisAtividadePerfil {
  return itens.reduce<TotaisAtividadePerfil>((acumulado, item) => {
    const total = normalizarTotaisAtividade(item);
    return {
      treinos: acumulado.treinos + total.treinos,
      amistosos: acumulado.amistosos + total.amistosos,
      guerras: acumulado.guerras + total.guerras,
    };
  }, { ...TOTAIS_ATIVIDADE_VAZIOS });
}
