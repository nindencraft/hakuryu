export type TotaisAtividadePerfil = {
  treinos: number;
  amistosos: number;
  guerras: number;
};

export const GENEROS_RPG = ["Masculino", "Feminino"] as const;
export type GeneroRPG = (typeof GENEROS_RPG)[number];

export const ESTILOS_LUTA_RPG = [
  { valor: "Basic", raridade: "Normal" },
  { valor: "Karate", raridade: "Raro" },
  { valor: "Muay Thai", raridade: "Raro" },
  { valor: "Slugger", raridade: "Raro" },
  { valor: "Striker", raridade: "Épico" },
  { valor: "Box", raridade: "Épico" },
  { valor: "Hakari", raridade: "Lendário" },
  { valor: "Wrestling", raridade: "Lendário" },
  { valor: "Kure", raridade: "Lendário" },
  { valor: "Capoeira", raridade: "Lendário" },
  { valor: "Wingchun", raridade: "Mítico" },
  { valor: "Ali", raridade: "Mítico" },
] as const;
export type EstiloLutaRPG = (typeof ESTILOS_LUTA_RPG)[number]["valor"];

export type FichaRPG = {
  nome_roblox: string | null;
  nome_rp: string | null;
  genero: GeneroRPG | null;
  altura_jogo: number | null;
  estilo_luta_principal: EstiloLutaRPG | null;
};

export type FichaRPGInput = {
  nome_roblox: string;
  nome_rp: string;
  genero: string;
  altura_jogo: string;
  estilo_luta_principal: string;
};

export const FICHA_RPG_VAZIA: FichaRPG = {
  nome_roblox: null,
  nome_rp: null,
  genero: null,
  altura_jogo: null,
  estilo_luta_principal: null,
};

function textoRPG(valor: string, limite: number): string | null {
  const limpo = (valor ?? "").trim();
  if (limpo.length > limite) throw new Error(`Este campo pode ter no máximo ${limite} caracteres.`);
  return limpo || null;
}

/** Valida e normaliza a ficha compartilhada por todos os painéis de gang. */
export function normalizarFichaRPG(input: FichaRPGInput): FichaRPG {
  const generoBruto = (input.genero ?? "").trim();
  if (generoBruto && !GENEROS_RPG.includes(generoBruto as GeneroRPG)) {
    throw new Error("Selecione Masculino ou Feminino para o gênero.");
  }
  const estiloBruto = (input.estilo_luta_principal ?? "").trim();
  const estilosValidos = ESTILOS_LUTA_RPG.map((estilo) => estilo.valor);
  if (estiloBruto && !estilosValidos.includes(estiloBruto as EstiloLutaRPG)) {
    throw new Error("Selecione um estilo de luta disponível.");
  }
  const alturaBruta = (input.altura_jogo ?? "").trim();
  const altura = Number(alturaBruta.replace(",", "."));
  if (alturaBruta && (!Number.isFinite(altura) || altura <= 0 || altura > 1000)) {
    throw new Error("Informe uma altura válida entre 0 e 1000.");
  }
  return {
    nome_roblox: textoRPG(input.nome_roblox, 80),
    nome_rp: textoRPG(input.nome_rp, 80),
    genero: (generoBruto || null) as GeneroRPG | null,
    altura_jogo: alturaBruta ? altura : null,
    estilo_luta_principal: (estiloBruto || null) as EstiloLutaRPG | null,
  };
}

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
