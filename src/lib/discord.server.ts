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
