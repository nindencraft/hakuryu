import { getDb } from "./db.server";
import { getConfig } from "./config.server";
import {
  buscarGangPorId,
  buscarGangPorGuildId,
  type Gang,
} from "./gangs.server";

/** Tabela antiga de configurações globais. */
export const TABELA_CONFIG = "dashboard_config";

/** Configurações específicas de cada gang. */
export const TABELA_GANG_CONFIG = "gang_config";

export const CHAVES_CANAIS_CONFIG = [
  "canal_treinos",
  "canal_aliancas",
  "canal_advertencias",
] as const;

export const CHAVES_CANAIS = CHAVES_CANAIS_CONFIG;

export type ChaveCanal = (typeof CHAVES_CANAIS)[number];

export type Configuracoes = {
  cargos: Record<string, string>;
  canais: Record<string, string>;
  owners: string[];
  guildId: string;
  tabelaAusente: boolean;
  gangId: number | null;
  gang: Gang | null;
};

/**
 * IDs que sempre possuem acesso global ao painel,
 * independentemente da gang.
 */
export const SUPER_OWNER_IDS = ["1454976616735313970"];

export const CHAVE_GUILD = "guild_id";

/**
 * Lê uma configuração antiga/global.
 *
 * Mantida temporariamente para compatibilidade.
 */
export async function lerConfig(chave: string): Promise<string | null> {
  try {
    const db = getDb();

    const { data, error } = await db
      .from(TABELA_CONFIG)
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();

    if (error) return null;

    return (
      ((data as { valor: string | null } | null)?.valor ?? "").trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Lê uma configuração específica de uma gang.
 */
export async function lerConfigGang(
  gangId: number,
  chave: string,
): Promise<string | null> {
  try {
    const db = getDb();

    const { data, error } = await db
      .from(TABELA_GANG_CONFIG)
      .select("valor")
      .eq("gang_id", gangId)
      .eq("chave", chave)
      .maybeSingle();

    if (error) return null;

    return (
      ((data as { valor: string | null } | null)?.valor ?? "").trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Salva uma configuração específica de uma gang.
 */
export async function salvarConfigGang(
  gangId: number,
  chave: string,
  valor: string | null,
): Promise<void> {
  const db = getDb();

  const { error } = await db
    .from(TABELA_GANG_CONFIG)
    .upsert(
      {
        gang_id: gangId,
        chave,
        valor: valor?.trim() || null,
        atualizado_em: new Date().toISOString(),
      },
      {
        onConflict: "gang_id,chave",
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Busca a gang associada a um servidor Discord.
 */
export async function gangPorGuildId(
  guildId: string,
): Promise<Gang | null> {
  return buscarGangPorGuildId(guildId);
}

/**
 * Busca uma gang pelo ID interno.
 */
export async function gangPorId(
  gangId: number,
): Promise<Gang | null> {
  return buscarGangPorId(gangId);
}

/**
 * ID da gang associada ao servidor Discord informado.
 */
export async function gangIdPorGuildId(
  guildId: string,
): Promise<number | null> {
  const gang = await gangPorGuildId(guildId);
  return gang?.id ?? null;
}

/**
 * Retorna a guild atualmente configurada.
 *
 * COMPATIBILIDADE:
 * ainda utiliza dashboard_config / ENV enquanto
 * o restante do projeto está sendo migrado.
 */
export async function guildIdAtivo(): Promise<string> {
  const salvo = (await lerConfig(CHAVE_GUILD))?.replace(/\D/g, "");

  if (salvo) {
    return salvo;
  }

  try {
    return getConfig().discordGuildId.trim();
  } catch {
    return "";
  }
}

/**
 * Retorna a gang atualmente configurada pela configuração antiga.
 *
 * Será substituída pelo contexto da sessão posteriormente.
 */
export async function gangAtivaLegado(): Promise<Gang | null> {
  const guildId = await guildIdAtivo();

  if (!guildId) {
    return null;
  }

  return gangPorGuildId(guildId);
}

/**
 * Lê uma configuração no escopo da gang, com recuo para a configuração global
 * antiga (dashboard_config) enquanto a migração não termina.
 */
export async function lerConfigEscopo(
  gangId: number | null,
  chave: string,
): Promise<string | null> {
  if (gangId != null) {
    const daGang = await lerConfigGang(gangId, chave);
    if (daGang) return daGang;
  }
  return lerConfig(chave);
}

/** Salva várias configurações de uma gang de uma vez. */
export async function salvarConfiguracoesDaGang(
  gangId: number,
  valores: Record<string, string>,
): Promise<void> {
  const db = getDb();

  const linhas = Object.entries(valores).map(([chave, valor]) => ({
    gang_id: gangId,
    chave,
    valor: (valor ?? "").trim() || null,
    atualizado_em: new Date().toISOString(),
  }));

  if (linhas.length === 0) return;

  const { error } = await db
    .from(TABELA_GANG_CONFIG)
    .upsert(linhas, { onConflict: "gang_id,chave" });

  if (error) {
    throw new Error(error.message);
  }
}

/** Guild Discord de uma gang. */
export async function guildIdDaGang(gangId: number): Promise<string> {
  const gang = await gangPorId(gangId);
  return (gang?.guild_id ?? "").replace(/\D/g, "");
}

export function chaveCargo(nome: string): string {
  return `cargo_id:${nome}`;
}

function ausente(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false;

  const msg = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /dashboard_config/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

/**
 * Lê todas as configurações da gang.
 *
 * Por enquanto tenta primeiro gang_config.
 * Se não houver gang, mantém compatibilidade com dashboard_config.
 */
export async function loadConfiguracoes(
  cargosConhecidos: string[],
  gangId?: number | null,
): Promise<Configuracoes> {
  const db = getDb();

  /*
   * Se temos uma gang explícita, usamos a configuração
   * específica dela.
   */
  if (gangId != null) {
    const { data, error } = await db
      .from(TABELA_GANG_CONFIG)
      .select("chave, valor")
      .eq("gang_id", gangId);

    if (!error) {
      const mapa = new Map(
        ((data ?? []) as { chave: string; valor: string | null }[]).map(
          (r) => [r.chave, r.valor ?? ""],
        ),
      );

      const gang = await gangPorId(gangId);

      const cargos: Record<string, string> = {};

      for (const nome of cargosConhecidos) {
        cargos[nome] = mapa.get(chaveCargo(nome)) ?? "";
      }

      const canais: Record<string, string> = {};

      for (const c of CHAVES_CANAIS) {
        canais[c] = mapa.get(c) ?? "";
      }

      const owners = (mapa.get("owner_ids") ?? "")
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean);

      return {
        cargos,
        canais,
        owners,
        guildId: gang?.guild_id ?? "",
        tabelaAusente: false,
        gangId,
        gang,
      };
    }
  }

  /*
   * Compatibilidade com o sistema antigo.
   */
  const { data, error } = await db
    .from(TABELA_CONFIG)
    .select("chave, valor");

  if (error) {
    if (ausente(error)) {
      return {
        cargos: {},
        canais: {},
        owners: [],
        guildId: "",
        tabelaAusente: true,
        gangId: null,
        gang: null,
      };
    }

    throw new Error(error.message);
  }

  const mapa = new Map(
    ((data ?? []) as { chave: string; valor: string | null }[]).map(
      (r) => [r.chave, r.valor ?? ""],
    ),
  );

  const guildId = mapa.get(CHAVE_GUILD) ?? "";

  const gang = guildId
    ? await gangPorGuildId(guildId)
    : null;

  const cargos: Record<string, string> = {};

  for (const nome of cargosConhecidos) {
    cargos[nome] = mapa.get(chaveCargo(nome)) ?? "";
  }

  const canais: Record<string, string> = {};

  for (const c of CHAVES_CANAIS) {
    canais[c] = mapa.get(c) ?? "";
  }

  const owners = (mapa.get("owner_ids") ?? "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    cargos,
    canais,
    owners,
    guildId,
    tabelaAusente: false,
    gangId: gang?.id ?? null,
    gang,
  };
}

/**
 * Salva configurações antigas.
 *
 * Mantida para que as páginas atuais continuem funcionando
 * durante a migração.
 */
export async function salvarConfiguracoes(
  valores: Record<string, string>,
): Promise<void> {
  const db = getDb();

  const linhas = Object.entries(valores).map(([chave, valor]) => ({
    chave,
    valor: (valor ?? "").trim() || null,
  }));

  if (linhas.length === 0) return;

  const { error } = await db
    .from(TABELA_CONFIG)
    .upsert(linhas, { onConflict: "chave" });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * IDs de Super Owner + owners configurados.
 */
export async function ownerIds(gangId?: number | null): Promise<string[]> {
  const ids: string[] = [...SUPER_OWNER_IDS];

  try {
    const envOwner = getConfig().discordOwnerId.trim();

    if (envOwner) {
      ids.push(envOwner);
    }
  } catch {
    // Sem configuração.
  }

  // Donos cadastrados na aba Configurações da gang (gang_config) + legado global.
  const fontes = [await lerConfig("owner_ids")];
  if (gangId != null) fontes.push(await lerConfigGang(gangId, "owner_ids"));

  for (const extras of fontes) {
    if (!extras) continue;
    ids.push(
      ...extras
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }

  return Array.from(new Set(ids));
}

/**
 * Verifica se o Discord ID é dono do painel (global ou da gang informada).
 */
export async function ehDono(discordId: string, gangId?: number | null): Promise<boolean> {
  return (await ownerIds(gangId)).includes(discordId);
}

/**
 * Verifica especificamente o Super Owner.
 *
 * Diferente de ehDono(), este não considera owners
 * cadastrados em uma gang.
 */
export function ehSuperOwner(discordId: string): boolean {
  return SUPER_OWNER_IDS.includes(discordId);
}