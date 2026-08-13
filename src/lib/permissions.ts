/** Espelho client-safe das permissões (a verificação real acontece no servidor). */

export type SessionUserView = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  roles: string[];
  isOwner: boolean;
  nomeRp: string | null;
};

export const CARGOS_PERMITIDOS = [
  "Lider",
  "Vice-Lider",
  "Líder de Divisão",
  "Staff",
  "Recrutador",
  "Membro",
  "Em Analise",
];

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
      temCargo(user, "Líder de Divisão"))
  );
}

export function podeGerenciarDivisoes(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
}

export function podeGerenciarParcerias(user: SessionUserView | null): boolean {
  return podeGerenciarMembros(user);
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
