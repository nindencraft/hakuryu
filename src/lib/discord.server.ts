import { getConfig } from "./config.server";
import { guildIdAtivo } from "./settings.server";

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
    const guildId = await guildIdAtivo();
    if (!guildId) return null;
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${config.discordBotToken}` } },
    );
    if (memberRes.status === 404) return [];
    if (!memberRes.ok) return null;
    const member = (await memberRes.json()) as GuildMember;

    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
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
  const guildId = await guildIdAtivo();
  if (!guildId) return null;
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
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

/** Adiciona ou remove um cargo pelo ID. Falhas são silenciosas (best-effort). */
export async function ajustarCargoPorId(
  discordId: string,
  roleId: string,
  acao: "add" | "remove",
): Promise<void> {
  try {
    const config = getConfig();
    const id = roleId.trim().replace(/\D/g, "");
    const guildId = await guildIdAtivo();
    if (!id || !guildId) return;
    await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${id}`,
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
 * Adiciona ou remove um cargo do Discord pelo nome.
 * Usa o ID cadastrado nas Configurações quando existir; senão procura pelo nome.
 */
export async function ajustarCargoDiscord(
  discordId: string,
  nomeCargo: string,
  acao: "add" | "remove",
): Promise<void> {
  try {
    const { lerConfig, chaveCargo } = await import("./settings.server");
    const configurado = await lerConfig(chaveCargo(nomeCargo));
    const roleId = configurado ?? (await buscarRoleId(nomeCargo));
    if (!roleId) return;
    await ajustarCargoPorId(discordId, roleId, acao);
  } catch {
    /* best-effort */
  }
}

export type EmbedDiscord = {
  title: string;
  description?: string | undefined;
  color?: number | undefined;
  fields?: { name: string; value: string; inline?: boolean }[] | undefined;
  thumbnail?: { url: string } | undefined;
  timestamp?: string | undefined;
};

/** Publica um embed em um canal do servidor. Best-effort. */
export async function enviarMensagemCanal(
  chaveCanal: string,
  embed: EmbedDiscord,
): Promise<void> {
  try {
    const { lerConfig } = await import("./settings.server");
    const canalId = (await lerConfig(chaveCanal))?.replace(/\D/g, "");
    if (!canalId) return;
    const config = getConfig();
    await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [{ color: 0xd4af37, ...embed }] }),
    });
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
    const guildId = await guildIdAtivo();
    if (!guildId) return null;
    const headers = { Authorization: `Bot ${config.discordBotToken}` };
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
        headers,
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
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

export type ConviteInfo = {
  guildId: string | null;
  nome: string | null;
  iconHash: string | null;
  code: string;
};

/** Resolve um convite do Discord (endpoint público) para nome/ícone do servidor. */
export async function resolverConvite(url: string): Promise<ConviteInfo | null> {
  const code = (url.trim().match(/(?:discord\.gg\/|discord\.com\/invite\/)([A-Za-z0-9-]+)/)?.[1] ??
    url.trim().replace(/^\/+|\/+$/g, "")) as string;
  if (!code || /\s|\//.test(code)) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      guild?: { id: string; name: string; icon: string | null };
    };
    if (!data.guild) return null;
    return {
      guildId: data.guild.id,
      nome: data.guild.name,
      iconHash: data.guild.icon ?? null,
      code,
    };
  } catch {
    return null;
  }
}

export type UsuarioDiscord = {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
};

/** Busca qualquer usuário do Discord pelo ID (usa o token do bot). */
export async function fetchUsuarioDiscord(id: string): Promise<UsuarioDiscord | null> {
  const limpo = id.trim().replace(/\D/g, "");
  if (!limpo) return null;
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${limpo}`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (!res.ok) return null;
    const u = (await res.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    return {
      id: u.id,
      username: u.username,
      globalName: u.global_name ?? null,
      avatarHash: u.avatar ?? null,
    };
  } catch {
    return null;
  }
}
