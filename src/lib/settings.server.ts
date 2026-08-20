import { getDb } from "./db.server";
import { getConfig } from "./config.server";
import {
  buscarGangPorId,
  buscarGangPorGuildId,
  type Gang,
} from "./gangs.server";

export const TABELA_CONFIG = "dashboard_config";

export const TABELA_GANG_CONFIG = "gang_config";

export const CHAVES_CANAIS_CONFIG = [
  "canal_treinos",
  "canal_aliancas",
  "canal_advertencias",
  "canal_divulgacao",
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

export const SUPER_OWNER_IDS = ["1454976616735313970"];

export const CHAVE_GUILD = "guild_id";
export const CHAVE_BANNER_IMAGEM_URL = "banner_imagem_url";
export const CHAVE_BANNER_DISCORD_URL = "banner_discord_url";

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

export async function gangPorGuildId(
  guildId: string,
): Promise<Gang | null> {
  return buscarGangPorGuildId(guildId);
}

export async function gangPorId(
  gangId: number,
): Promise<Gang | null> {
  return buscarGangPorId(gangId);
}

export async function gangIdPorGuildId(
  guildId: string,
): Promise<number | null> {
  const gang = await gangPorGuildId(guildId);
  return gang?.id ?? null;
}

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

export async function gangAtivaLegado(): Promise<Gang | null> {
  const guildId = await guildIdAtivo();

  if (!guildId) {
    return null;
  }

  return gangPorGuildId(guildId);
}

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

export async function loadConfiguracoes(
  cargosConhecidos: string[],
  gangId?: number | null,
): Promise<Configuracoes> {
  const db = getDb();

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

export async function ownerIds(gangId?: number | null): Promise<string[]> {
  const ids: string[] = [...superOwnerIds()];

  const extras =
    gangId != null
      ? await lerConfigGang(gangId, "owner_ids")
      : await lerConfig("owner_ids");

  if (extras) {
    ids.push(
      ...extras
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }

  return Array.from(new Set(ids));
}

export async function ehDono(discordId: string, gangId?: number | null): Promise<boolean> {
  return (await ownerIds(gangId)).includes(discordId);
}

export function superOwnerIds(): string[] {
  const ids = [...SUPER_OWNER_IDS];
  try {
    const envOwner = getConfig().discordOwnerId.trim();
    if (envOwner) ids.push(envOwner);
  } catch {
  }
  return ids;
}

export function ehSuperOwner(discordId: string): boolean {
  return superOwnerIds().includes(discordId);
}
