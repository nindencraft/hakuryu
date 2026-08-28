import { getConfig } from "./config.server";
import {
  CHAVES_PERMISSOES_PAINEL,
  type PermissaoPainel,
} from "./permissoes-painel";

export const SESSION_COOKIE = "hakuryu_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type SessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  roles: string[];
  /** Últimos IDs de cargos confirmados pelo Discord para a gang ativa. */
  roleIds: string[];
  isOwner: boolean;
  /** Super Owner global (lista fixa + .env). Só ele administra gangs registradas. */
  isSuperOwner: boolean;
  nomeRp: string | null;
  /** Permissões adicionais resolvidas pelos cargos internos da gang ativa. */
  permissoes: PermissaoPainel[];
  /** Cargos-base que os cargos personalizados da sessão podem atribuir. */
  cargosAtribuiveis: string[];

  /** Servidor Discord ao qual a sessão está vinculada. */
  guildId: string | null;

  /** Gang vinculada ao servidor Discord. */
  gangId: number | null;

  exp: number;
};

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }

  return out;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payload),
  );

  return toBase64Url(new Uint8Array(sig));
}

export async function signSession(
  user: Omit<SessionUser, "exp" | "permissoes" | "cargosAtribuiveis"> & {
    permissoes?: PermissaoPainel[];
    cargosAtribuiveis?: string[];
  },
): Promise<string> {
  const { sessionSecret } = getConfig();

  const payload: SessionUser = {
    ...user,
    permissoes: user.permissoes ?? [],
    cargosAtribuiveis: user.cargosAtribuiveis ?? [],
    exp: Date.now() + MAX_AGE * 1000,
  };

  const body = toBase64Url(
    enc.encode(JSON.stringify(payload)),
  );

  const sig = await hmac(body, sessionSecret);

  return `${body}.${sig}`;
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;

  const [body, sig] = token.split(".");

  if (!body || !sig) return null;

  let sessionSecret: string;

  try {
    ({ sessionSecret } = getConfig());
  } catch {
    return null;
  }

  const expected = await hmac(body, sessionSecret);

  if (expected.length !== sig.length) return null;

  let diff = 0;

  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }

  if (diff !== 0) return null;

  try {
    const user = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as Partial<SessionUser>;

    if (!user.exp || user.exp < Date.now()) {
      return null;
    }

    return {
      id: user.id ?? "",
      username: user.username ?? "",
      globalName: user.globalName ?? null,
      avatarUrl: user.avatarUrl ?? "",
      roles: Array.isArray(user.roles) ? user.roles : [],
      roleIds: Array.isArray(user.roleIds) ? user.roleIds.map(String) : [],
      isOwner: user.isOwner === true,
      isSuperOwner: user.isSuperOwner === true,
      nomeRp: user.nomeRp ?? null,
      permissoes: Array.isArray(user.permissoes) ? (user.permissoes as PermissaoPainel[]) : [],
      cargosAtribuiveis: Array.isArray(user.cargosAtribuiveis)
        ? user.cargosAtribuiveis.map(String)
        : [],

      // Compatibilidade com sessões antigas.
      guildId: user.guildId ?? null,
      gangId:
        typeof user.gangId === "number"
          ? user.gangId
          : user.gangId
            ? Number(user.gangId)
            : null,

      exp: user.exp,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(
  token: string,
  secure: boolean,
): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(
  secure: boolean,
): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function readCookie(
  header: string | null,
  name: string,
): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");

    if (k === name) {
      return rest.join("=");
    }
  }

  return undefined;
}

/* ========== Permissões ========== */

export const CARGOS_PERMITIDOS = [
  "Lider",
  "Vice-Lider",
  "Líder de Divisão",
  "Vice-Líder de Divisão",
  "Staff",
  "Recrutador",
  "Membro",
  "Em Analise",
] as const;

export const CARGOS_DIVISAO = ["Líder de Divisão", "Vice-Líder de Divisão"];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function temCargo(user: SessionUser | null, cargo: string): boolean {
  return !!user && user.roles.some((role) => normalize(role) === normalize(cargo));
}

export function temPermissao(user: SessionUser | null, ...chaves: string[]): boolean {
  return !!user && (user.isOwner || chaves.some((chave) => user.permissoes.includes(chave as PermissaoPainel)));
}

export function podeAcessar(user: SessionUser | null): boolean {
  return !!user && (user.isOwner || user.permissoes.includes("acessar_painel") || CARGOS_PERMITIDOS.some((c) => temCargo(user, c)));
}

export function podeGerenciarMembros(user: SessionUser | null): boolean {
  return temPermissao(user, "adicionar_membro", "alterar_cargo") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_membros");
}

export function podeAdicionarMembro(user: SessionUser | null): boolean {
  return temPermissao(user, "adicionar_membro") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_membros");
}

export function podeAlterarCargo(user: SessionUser | null): boolean {
  return temPermissao(user, "alterar_cargo") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_membros");
}

export function podeGerenciarTreinos(user: SessionUser | null): boolean {
  return temPermissao(user, "treino_agendar", "treino_deletar", "treino_gerenciar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeAgendarTreino(user: SessionUser | null): boolean {
  return temPermissao(user, "treino_agendar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeGerenciarTreino(user: SessionUser | null): boolean {
  return temPermissao(user, "treino_gerenciar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeDeletarTreino(user: SessionUser | null): boolean {
  return temPermissao(user, "treino_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeAdvertir(user: SessionUser | null): boolean {
  return temPermissao(user, "advertencia_dar", "advertencia_warn", "advertencia_ban") || temCargo(user, "Staff") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeAplicarWarn(user: SessionUser | null): boolean {
  return temPermissao(user, "advertencia_warn") || temCargo(user, "Staff") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeAplicarBan(user: SessionUser | null): boolean {
  return temPermissao(user, "advertencia_ban") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeRevogarPunicao(user: SessionUser | null): boolean {
  return temPermissao(user, "advertencia_remover") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function cargosAtribuiveis(user: SessionUser | null): string[] {
  if (!user) return [];
  if (user.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || user.permissoes.includes("gerenciar_membros")) {
    return CARGOS_PERMITIDOS.filter((cargo) => !CARGOS_DIVISAO.includes(cargo));
  }
  if (user.permissoes.includes("alterar_cargo")) return user.cargosAtribuiveis.length ? user.cargosAtribuiveis : ["Membro", "Em Analise"];
  if (temCargo(user, "Recrutador")) return ["Membro", "Em Analise"];
  return [];
}

export function podeCriarDivisao(user: SessionUser | null): boolean {
  return temPermissao(user, "divisao_criar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_divisoes");
}

export function podeGerenciarDivisoes(user: SessionUser | null): boolean {
  return podeCriarDivisao(user) || temPermissao(user, "divisao_gerenciar_lider", "divisao_gerenciar_vice", "divisao_gerenciar_membro", "divisao_definir_vice", "divisao_definir_membros");
}

export function podeGerenciarParcerias(user: SessionUser | null): boolean {
  return temPermissao(user, "alianca_criar", "alianca_editar", "alianca_deletar", "alianca_solicitar_amistoso", "alianca_solicitar_guerra") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeVerSolicitacoes(user: SessionUser | null): boolean {
  return temPermissao(user, "solicitacoes_ver") || podeGerenciarParcerias(user);
}

export function podeResponderSolicitacoes(user: SessionUser | null): boolean {
  return temPermissao(user, "solicitacoes_responder") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeDeletarSolicitacoes(user: SessionUser | null): boolean {
  return temPermissao(user, "solicitacoes_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeCriarLog(user: SessionUser | null): boolean {
  return temPermissao(user, "logs_criar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeDeletarLog(user: SessionUser | null): boolean {
  return temPermissao(user, "logs_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeConfigurarCargos(user: SessionUser | null): boolean {
  return temPermissao(user, "configuracoes_criar_cargos") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeConfigurarInatividade(user: SessionUser | null): boolean {
  return temPermissao(user, "configuracoes_inatividade") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeConfigurarCanais(user: SessionUser | null): boolean {
  return temPermissao(user, "configuracoes_canais") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeEditarFichaRPG(user: SessionUser | null): boolean {
  return !!user && (
    user.isSuperOwner ||
    temPermissao(user, "editar_ficha_rpg") ||
    temCargo(user, "Lider") ||
    temCargo(user, "Vice-Lider") ||
    temCargo(user, "Líder de Divisão")
  );
}

export function podeAvaliarAtributos(user: SessionUser | null, alvoDivisaoId: number | null, minhaDivisaoId: number | null): boolean {
  if (!user) return false;
  if (temPermissao(user, "avaliar_estatisticas", "avaliar_atributos") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider")) return true;
  const lidera = temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lidera && alvoDivisaoId != null && alvoDivisaoId === minhaDivisaoId;
}

export function podeGerenciarRecrutamento(user: SessionUser | null): boolean {
  return !!user && (user.isOwner || user.permissoes.includes("gerenciar_recrutamento"));
}

export function permissoesConhecidas(): string[] {
  return [...CHAVES_PERMISSOES_PAINEL];
}
