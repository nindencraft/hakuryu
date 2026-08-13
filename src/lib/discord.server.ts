import { getConfig } from "./config.server";

type GuildMember = { roles: string[]; nick?: string | null };
type GuildRole = { id: string; name: string };

/**
 * Busca os cargos atuais do usuário no servidor do Discord.
 * Retorna null quando não foi possível consultar (mantém os cargos da sessão).
 */
export async function fetchCargosAtuais(discordId: string): Promise<string[] | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${config.discordGuildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${config.discordBotToken}` } },
    );
    if (memberRes.status === 404) return [];
    if (!memberRes.ok) return null;
    const member = (await memberRes.json()) as GuildMember;

    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${config.discordGuildId}/roles`,
      { headers: { Authorization: `Bot ${config.discordBotToken}` } },
    );
    if (!rolesRes.ok) return null;
    const allRoles = (await rolesRes.json()) as GuildRole[];

    return allRoles.filter((r) => member.roles.includes(r.id)).map((r) => r.name);
  } catch {
    return null;
  }
}

async function buscarRoleId(nome: string): Promise<string | null> {
  const config = getConfig();
  const res = await fetch(`https://discord.com/api/v10/guilds/${config.discordGuildId}/roles`, {
    headers: { Authorization: `Bot ${config.discordBotToken}` },
  });
  if (!res.ok) return null;
  const roles = (await res.json()) as GuildRole[];
  const alvo = normalizar(nome);
  return roles.find((r) => normalizar(r.name) === alvo)?.id ?? null;
}

function normalizar(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Adiciona ou remove um cargo do Discord. Falhas são silenciosas (best-effort). */
export async function ajustarCargoDiscord(
  discordId: string,
  nomeCargo: string,
  acao: "add" | "remove",
): Promise<void> {
  try {
    const config = getConfig();
    const roleId = await buscarRoleId(nomeCargo);
    if (!roleId) return;
    await fetch(
      `https://discord.com/api/v10/guilds/${config.discordGuildId}/members/${discordId}/roles/${roleId}`,
      {
        method: acao === "add" ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${config.discordBotToken}` },
      },
    );
  } catch {
    /* best-effort */
  }
}

/**
 * Cargos de todos os membros do servidor (1 chamada), para usar o Discord
 * como fonte da verdade na listagem de membros.
 */
export async function fetchCargosDeTodos(): Promise<Map<string, string[]> | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const headers = { Authorization: `Bot ${config.discordBotToken}` };
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${config.discordGuildId}/members?limit=1000`, {
        headers,
      }),
      fetch(`https://discord.com/api/v10/guilds/${config.discordGuildId}/roles`, { headers }),
    ]);
    if (!membersRes.ok || !rolesRes.ok) return null;
    const members = (await membersRes.json()) as { user?: { id: string }; roles: string[] }[];
    const allRoles = (await rolesRes.json()) as GuildRole[];
    const nomePorId = new Map(allRoles.map((r) => [r.id, r.name]));

    const mapa = new Map<string, string[]>();
    for (const m of members) {
      if (!m.user?.id) continue;
      mapa.set(
        m.user.id,
        m.roles.map((id) => nomePorId.get(id)).filter((n): n is string => !!n),
      );
    }
    return mapa;
  } catch {
    return null;
  }
}
