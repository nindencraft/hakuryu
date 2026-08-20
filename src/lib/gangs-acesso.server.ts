import { listarGangsAtivas, buscarGangPorId, type Gang } from "./gangs.server";
import { getConfig } from "./config.server";
import type { SessionUser } from "./session.server";

export type GangDisponivelServer = {
  id: number;
  nome: string;
  guildId: string;
  iconHash: string | null;
};

async function ehMembroDoServidor(discordId: string, guildId: string): Promise<boolean> {
  try {
    const config = getConfig();
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${config.discordBotToken}` } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function iconeDoServidor(guildId: string): Promise<string | null> {
  const { fetchGuildInfo } = await import("./discord.server");
  return (await fetchGuildInfo(guildId))?.iconHash ?? null;
}

export async function gangsDoUsuario(user: SessionUser): Promise<GangDisponivelServer[]> {
  const ativas = await listarGangsAtivas();

  const permitidas: Gang[] = user.isSuperOwner
    ? ativas
    : (
        await Promise.all(
          ativas.map(async (g) =>
            (await ehMembroDoServidor(user.id, g.guild_id)) ? g : null,
          ),
        )
      ).filter((g): g is Gang => g !== null);

  return Promise.all(
    permitidas.map(async (g) => ({
      id: g.id,
      nome: g.nome,
      guildId: g.guild_id,
      iconHash: await iconeDoServidor(g.guild_id),
    })),
  );
}

export async function podeAcessarGang(user: SessionUser, gangId: number): Promise<Gang | null> {
  const gang = await buscarGangPorId(gangId);
  if (!gang || !gang.ativo) return null;
  if (user.isSuperOwner) return gang;
  return (await ehMembroDoServidor(user.id, gang.guild_id)) ? gang : null;
}
