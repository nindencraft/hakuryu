import { getDb } from "./db.server";
import { CARGOS_PERMITIDOS } from "./session.server";
import { TABELA_CONFIG, TABELA_GANG_CONFIG, chaveCargo } from "./settings.server";

/** Cargos que dão acesso ao painel (quem está "Em Analise" ainda não entra). */
export const CARGOS_COM_ACESSO = CARGOS_PERMITIDOS.filter((c) => c !== "Em Analise");

export function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type MapaCargos = {
  /** ID do cargo no Discord -> cargo canônico do painel. */
  porRoleId: Map<string, string>;
  /** Cargo canônico -> ID configurado no Discord. */
  porCargo: Map<string, string>;
};

/**
 * Lê a configuração de IDs de cargos da gang.
 * É por esse mapa que traduzimos nomes livres do servidor
 * (ex.: "Membro RGK", "Visitante") para os cargos do painel.
 */
export async function mapaCargos(gangId: number | null): Promise<MapaCargos> {
  const porRoleId = new Map<string, string>();
  const porCargo = new Map<string, string>();

  const aplicar = (linhas: { chave: string; valor: string | null }[]) => {
    for (const cargo of CARGOS_PERMITIDOS) {
      if (porCargo.has(cargo)) continue;
      const linha = linhas.find((l) => l.chave === chaveCargo(cargo));
      const id = (linha?.valor ?? "").replace(/\D/g, "");
      if (!id) continue;
      porCargo.set(cargo, id);
      porRoleId.set(id, cargo);
    }
  };

  try {
    const db = getDb();
    if (gangId != null) {
      const { data } = await db
        .from(TABELA_GANG_CONFIG)
        .select("chave, valor")
        .eq("gang_id", gangId);
      aplicar((data ?? []) as { chave: string; valor: string | null }[]);
    }
    const { data: globais } = await db.from(TABELA_CONFIG).select("chave, valor");
    aplicar((globais ?? []) as { chave: string; valor: string | null }[]);
  } catch {
    /* configuração indisponível: sobra o casamento por nome */
  }

  return { porRoleId, porCargo };
}

/**
 * Traduz os cargos do Discord (IDs + nomes) para os cargos canônicos do painel.
 * O ID configurado tem prioridade; o nome é apenas o recuo.
 */
export function canonizarCargos(
  mapa: MapaCargos,
  roleIds: string[],
  roleNames: string[] = [],
): string[] {
  const encontrados = new Set<string>();

  for (const id of roleIds) {
    const cargo = mapa.porRoleId.get(id.replace(/\D/g, ""));
    if (cargo) encontrados.add(cargo);
  }

  const nomes = new Set(roleNames.map(normalizarNome));
  for (const cargo of CARGOS_PERMITIDOS) {
    // Se o cargo tem ID configurado, só o ID vale (evita falso positivo por nome).
    if (mapa.porCargo.has(cargo)) continue;
    if (nomes.has(normalizarNome(cargo))) encontrados.add(cargo);
  }

  return CARGOS_PERMITIDOS.filter((c) => encontrados.has(c));
}
