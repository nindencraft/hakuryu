import { getDb } from "./db.server";
import { getConfig } from "./config.server";

/** Tabela chave/valor com as configurações editáveis pelo painel. */
export const TABELA_CONFIG = "dashboard_config";

export const CHAVES_CANAIS = ["canal_treinos", "canal_aliancas", "canal_advertencias"] as const;
export type ChaveCanal = (typeof CHAVES_CANAIS)[number];

export type Configuracoes = {
  cargos: Record<string, string>;
  canais: Record<string, string>;
  owners: string[];
  tabelaAusente: boolean;
};

export function chaveCargo(nome: string): string {
  return `cargo_id:${nome}`;
}

function ausente(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /dashboard_config/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

/** Lê todas as configurações. Nunca lança: se a tabela não existir devolve vazio. */
export async function loadConfiguracoes(cargosConhecidos: string[]): Promise<Configuracoes> {
  const db = getDb();
  const { data, error } = await db.from(TABELA_CONFIG).select("chave, valor");
  if (error) {
    if (ausente(error)) {
      return { cargos: {}, canais: {}, owners: [], tabelaAusente: true };
    }
    throw new Error(error.message);
  }

  const mapa = new Map(
    ((data ?? []) as { chave: string; valor: string | null }[]).map((r) => [r.chave, r.valor ?? ""]),
  );

  const cargos: Record<string, string> = {};
  for (const nome of cargosConhecidos) cargos[nome] = mapa.get(chaveCargo(nome)) ?? "";
  const canais: Record<string, string> = {};
  for (const c of CHAVES_CANAIS) canais[c] = mapa.get(c) ?? "";

  const owners = (mapa.get("owner_ids") ?? "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  return { cargos, canais, owners, tabelaAusente: false };
}

/** Valor único, tolerante a erros (usado em caminhos best-effort). */
export async function lerConfig(chave: string): Promise<string | null> {
  try {
    const db = getDb();
    const { data, error } = await db
      .from(TABELA_CONFIG)
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    if (error) return null;
    return ((data as { valor: string | null } | null)?.valor ?? "").trim() || null;
  } catch {
    return null;
  }
}

export async function salvarConfiguracoes(valores: Record<string, string>): Promise<void> {
  const db = getDb();
  const linhas = Object.entries(valores).map(([chave, valor]) => ({
    chave,
    valor: (valor ?? "").trim() || null,
  }));
  if (linhas.length === 0) return;
  const { error } = await db.from(TABELA_CONFIG).upsert(linhas, { onConflict: "chave" });
  if (error) throw new Error(error.message);
}

/** IDs de dono: variável de ambiente + os cadastrados nas configurações. */
export async function ownerIds(): Promise<string[]> {
  const ids: string[] = [];
  try {
    const envOwner = getConfig().discordOwnerId.trim();
    if (envOwner) ids.push(envOwner);
  } catch {
    /* sem config */
  }
  const extras = await lerConfig("owner_ids");
  if (extras) ids.push(...extras.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean));
  return Array.from(new Set(ids));
}

export async function ehDono(discordId: string): Promise<boolean> {
  return (await ownerIds()).includes(discordId);
}
