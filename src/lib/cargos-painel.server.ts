import { getDb } from "./db.server";
import {
  CHAVES_PERMISSOES_PAINEL,
  normalizarPermissoesPainel,
  type PermissaoPainel,
} from "./permissoes-painel";
import { CARGOS_PERMITIDOS, CARGOS_DIVISAO } from "./session.server";

export const TABELA_CARGOS_PAINEL = "cargos_painel_personalizados";

export type CargoPainelPersonalizado = {
  id: number;
  nome: string;
  discordRoleId: string;
  permissoes: PermissaoPainel[];
  cargosAtribuiveis: string[];
  criadoEm: string;
};

export type SalvarCargoPainelInput = {
  id?: number | null;
  nome: string;
  discordRoleId: string;
  permissoes: string[];
  cargosAtribuiveis?: string[];
};

function idDiscord(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

function mapearLinha(linha: Record<string, unknown>): CargoPainelPersonalizado {
  return {
    id: Number(linha["id"]),
    nome: String(linha["nome"] ?? ""),
    discordRoleId: String(linha["discord_role_id"] ?? ""),
    permissoes: normalizarPermissoesPainel(
      Array.isArray(linha["permissoes"]) ? linha["permissoes"].map(String) : [],
    ),
    cargosAtribuiveis: normalizarCargosAtribuiveis(
      Array.isArray(linha["cargos_atribuiveis"]) ? linha["cargos_atribuiveis"].map(String) : [],
    ),
    criadoEm: String(linha["criado_em"] ?? ""),
  };
}

function normalizarCargosAtribuiveis(valores: readonly string[] | null | undefined): string[] {
  const recebidas = new Set((valores ?? []).map((valor) => String(valor).trim()));
  return CARGOS_PERMITIDOS.filter(
    (cargo) => !CARGOS_DIVISAO.includes(cargo) && recebidas.has(cargo),
  );
}

export async function listarCargosPainel(gangId: number): Promise<CargoPainelPersonalizado[]> {
  const { data, error } = await getDb()
    .from(TABELA_CARGOS_PAINEL)
    .select("id, nome, discord_role_id, permissoes, cargos_atribuiveis, criado_em")
    .eq("gang_id", gangId)
    .order("nome", { ascending: true });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(mapearLinha);
}

export async function permissoesDoUsuario(
  gangId: number | null,
  roleIds: string[],
  acessoTotal: boolean,
): Promise<PermissaoPainel[]> {
  if (acessoTotal) return normalizarPermissoesPainel(CHAVES_PERMISSOES_PAINEL);
  if (gangId == null) return [];

  const ids = new Set(roleIds.map(idDiscord).filter(Boolean));
  if (!ids.size) return [];

  const cargos = await listarCargosPainel(gangId);
  return normalizarPermissoesPainel(
    cargos.filter((cargo) => ids.has(cargo.discordRoleId)).flatMap((cargo) => cargo.permissoes),
  );
}

export async function cargosAtribuiveisDoUsuario(
  gangId: number | null,
  roleIds: string[],
  acessoTotal: boolean,
): Promise<string[]> {
  if (acessoTotal) return CARGOS_PERMITIDOS.filter((cargo) => !CARGOS_DIVISAO.includes(cargo));
  if (gangId == null) return [];
  const ids = new Set(roleIds.map(idDiscord).filter(Boolean));
  if (!ids.size) return [];
  const cargos = await listarCargosPainel(gangId);
  return Array.from(new Set(
    cargos.filter((cargo) => ids.has(cargo.discordRoleId)).flatMap((cargo) => cargo.cargosAtribuiveis),
  ));
}

export async function salvarCargoPainel(
  gangId: number,
  input: SalvarCargoPainelInput,
): Promise<CargoPainelPersonalizado> {
  const nome = (input.nome ?? "").trim().replace(/\s+/g, " ");
  const discordRoleId = idDiscord(input.discordRoleId);
  const permissoes = normalizarPermissoesPainel(input.permissoes);
  const cargosAtribuiveis = normalizarCargosAtribuiveis(input.cargosAtribuiveis);

  if (nome.length < 2 || nome.length > 60) {
    throw new Error("O nome do cargo deve ter entre 2 e 60 caracteres.");
  }
  if (discordRoleId.length < 16) {
    throw new Error("Informe um ID de cargo Discord válido.");
  }
  if (!permissoes.length) {
    throw new Error("Selecione ao menos uma permissão para o cargo.");
  }

  const db = getDb();
  const valores = {
    gang_id: gangId,
    nome,
    discord_role_id: discordRoleId,
    permissoes,
    cargos_atribuiveis: cargosAtribuiveis,
    atualizado_em: new Date().toISOString(),
  };

  const query = input.id != null
    ? db.from(TABELA_CARGOS_PAINEL).update(valores).eq("id", input.id).eq("gang_id", gangId)
    : db.from(TABELA_CARGOS_PAINEL).insert(valores);
  const { data, error } = await query.select("id, nome, discord_role_id, permissoes, cargos_atribuiveis, criado_em").single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este cargo do Discord já está vinculado a outro cargo interno desta gang.");
    }
    throw new Error(error.message);
  }

  return mapearLinha(data as Record<string, unknown>);
}

export async function excluirCargoPainel(gangId: number, id: number): Promise<void> {
  const { error } = await getDb()
    .from(TABELA_CARGOS_PAINEL)
    .delete()
    .eq("gang_id", gangId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
