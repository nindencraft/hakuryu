import { getConfig } from "./config.server";

export const SESSION_COOKIE = "hakuryu_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type SessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  roles: string[];
  isOwner: boolean;
  nomeRp: string | null;
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
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
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
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export async function signSession(user: Omit<SessionUser, "exp">): Promise<string> {
  const { sessionSecret } = getConfig();
  const payload: SessionUser = { ...user, exp: Date.now() + MAX_AGE * 1000 };
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(body, sessionSecret);
  return `${body}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
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
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const user = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionUser;
    if (!user.exp || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
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

export function clearSessionCookie(secure: boolean): string {
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

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

/* ========== Permissões (espelham o auth.py original) ========== */

export const CARGOS_PERMITIDOS = [
  "Lider",
  "Vice-Lider",
  "Líder de Divisão",
  "Staff",
  "Recrutador",
  "Membro",
  "Em Analise",
] as const;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function temCargo(user: SessionUser | null, cargo: string): boolean {
  if (!user) return false;
  return user.roles.some((r) => normalize(r) === normalize(cargo));
}

export function podeAcessar(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  return CARGOS_PERMITIDOS.some((c) => temCargo(user, c));
}

export function podeGerenciarMembros(user: SessionUser | null): boolean {
  return !!user && (user.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"));
}

export function podeGerenciarTreinos(user: SessionUser | null): boolean {
  return (
    !!user &&
    (user.isOwner ||
      temCargo(user, "Lider") ||
      temCargo(user, "Vice-Lider") ||
      temCargo(user, "Líder de Divisão"))
  );
}

export function podeGerenciarDivisoes(user: SessionUser | null): boolean {
  return podeGerenciarMembros(user);
}

export function podeGerenciarParcerias(user: SessionUser | null): boolean {
  return podeGerenciarMembros(user);
}
