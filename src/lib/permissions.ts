
export type SessionUserView = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  roles: string[];
  isOwner: boolean;
  isSuperOwner: boolean;
  nomeRp: string | null;
};

export const CARGOS_PERMITIDOS = [
  "Lider",
  "Vice-Lider",
  "Líder de Divisão",
  "Vice-Líder de Divisão",
  "Staff",
  "Recrutador",
  "Membro",
  "Em Analise",
];

export const CARGOS_DIVISAO = ["Líder de Divisão", "Vice-Líder de Divisão"];

const ROTULOS: Record<string, string> = {
  "Líder de Divisão": "Capitão de Divisão",
  "Vice-Líder de Divisão": "Vice-Capitão",
};

export function rotuloCargo(cargo: string): string {
  return ROTULOS[cargo] ?? cargo;
}

export function parseCargos(valor: string | null | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function temCargo(user: SessionUserView | null, cargo: string): boolean {
  if (!user) return false;
  return user.roles.some((r) => normalize(r) === normalize(cargo));
}

export function podeAcessar(user: SessionUserView | null): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  return CARGOS_PERMITIDOS.some((c) => temCargo(user, c));
}

export function podeGerenciarMembros(user: SessionUserView | null): boolean {
  return !!user && (user.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"));
}

export function podeGerenciarTreinos(user: SessionUserView | null): boolean {
  return (
    !!user &&
    (user.isOwner ||
      temCargo(user, "Lider") ||
      temCargo(user, "Vice-Lider") ||
      temCargo(user, "Líder de Divisão") ||
      temCargo(user, "Vice-Líder de Divisão"))
  );
}

export function podeAdvertir(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user) || temCargo(user, "Staff");
}

export function podeVerRegistroPunicoes(user: SessionUserView | null): boolean {
  return podeAdvertir(user);
}

export function podeRevogarPunicao(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
}

export function cargosAtribuiveis(user: SessionUserView | null): string[] {
  if (podeGerenciarMembros(user))
    return CARGOS_PERMITIDOS.filter((c) => !CARGOS_DIVISAO.includes(c));
  if (temCargo(user, "Recrutador")) return ["Membro"];
  return [];
}

export function podeCriarDivisao(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
}

type DivisaoLideranca = { id?: number; lider_id: string | null; vice_lider_id: string | null };

export function podeGerenciarDivisao(
  user: SessionUserView | null,
  divisao: DivisaoLideranca,
  minhaDivisaoId?: number | null,
): boolean {
  if (!user) return false;
  if (podeCriarDivisao(user)) return true;
  if (user.id === divisao.lider_id || user.id === divisao.vice_lider_id) return true;
  const lideraDivisao =
    temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lideraDivisao && minhaDivisaoId != null && minhaDivisaoId === divisao.id;
}

export function podeDefinirLiderancaDivisao(
  user: SessionUserView | null,
  divisao: DivisaoLideranca,
  minhaDivisaoId?: number | null,
): boolean {
  if (!user) return false;
  if (podeCriarDivisao(user) || user.id === divisao.lider_id) return true;
  return (
    temCargo(user, "Líder de Divisão") && minhaDivisaoId != null && minhaDivisaoId === divisao.id
  );
}

export function podeGerenciarDivisoes(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
}

export function podeGerenciarParcerias(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
}

export function podeAvaliarAtributos(
  user: SessionUserView | null,
  alvoDivisaoId: number | null,
  minhaDivisaoId: number | null,
): boolean {
  if (!user) return false;
  if (podeGerenciarMembros(user)) return true;
  const lideraDivisao =
    temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lideraDivisao && alvoDivisaoId != null && alvoDivisaoId === minhaDivisaoId;
}

export function nomeExibicao(user: SessionUserView): string {
  return user.nomeRp || user.globalName || user.username;
}

export function discordAvatarUrl(
  discordId: string,
  avatarHash: string | null | undefined,
  size = 128,
): string {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}`;
  }
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

export function cargoPrincipal(user: SessionUserView | null): string | null {
  if (!user) return null;
  return CARGOS_PERMITIDOS.find((c) => temCargo(user, c)) ?? null;
}

export function cargoPrimario(cargos: string[]): string {
  return CARGOS_PERMITIDOS.find((c) => cargos.includes(c)) ?? cargos[0] ?? "Em Analise";
}
