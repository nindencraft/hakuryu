import { getConfig } from "./config.server";
import { guildIdAtivo, lerConfigEscopo, chaveCargo } from "./settings.server";

type GuildMember = { roles: string[]; nick?: string | null };
type GuildRole = { id: string; name: string };
const TEMPO_LIMITE_DISCORD_MS = 8_000;

/** Impede que indisponibilidade externa mantenha uma rota autenticada carregando indefinidamente. */
export function requisitarDiscord(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(TEMPO_LIMITE_DISCORD_MS),
  });
}

/** Contexto da gang usada na chamada (servidor Discord + configurações). */
export type CtxDiscord = {
  guildId?: string | null | undefined;
  gangId?: number | null | undefined;
};

/** Servidor alvo: o da sessão quando informado, senão o legado das configurações. */
async function resolverGuild(guildId?: string | null): Promise<string> {
  const limpo = (guildId ?? "").replace(/\D/g, "");
  if (limpo) return limpo;
  return (await guildIdAtivo()).replace(/\D/g, "");
}

/**
 * Busca os cargos atuais do usuário no servidor do Discord.
 * Retorna null quando não foi possível consultar (mantém os cargos da sessão).
 */
export async function fetchCargosAtuais(discordId: string, guildIdSessao?: string | null): Promise<string[] | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }

  try {
    const guildId = await resolverGuild(guildIdSessao);
    if (!guildId) return null;
    const memberRes = await requisitarDiscord(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (memberRes.status === 404) return [];
    if (!memberRes.ok) return null;
    const member = (await memberRes.json()) as GuildMember;

    const rolesRes = await requisitarDiscord(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (!rolesRes.ok) return null;
    const allRoles = (await rolesRes.json()) as GuildRole[];

    return allRoles.filter((r) => member.roles.includes(r.id)).map((r) => r.name);
  } catch {
    return null;
  }
}

/** IDs e nomes dos cargos atuais do usuário no servidor (null quando indisponível). */
export async function fetchRolesAtuais(
  discordId: string,
  guildIdSessao?: string | null,
): Promise<{ ids: string[]; nomes: string[] } | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const guildId = await resolverGuild(guildIdSessao);
    if (!guildId) return null;
    const headers = { Authorization: `Bot ${config.discordBotToken}` };
    const memberRes = await requisitarDiscord(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers },
    );
    if (memberRes.status === 404) return { ids: [], nomes: [] };
    if (!memberRes.ok) return null;
    const member = (await memberRes.json()) as GuildMember;

    const rolesRes = await requisitarDiscord(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers,
    });
    const allRoles = rolesRes.ok ? ((await rolesRes.json()) as GuildRole[]) : [];
    return {
      ids: member.roles,
      nomes: allRoles.filter((r) => member.roles.includes(r.id)).map((r) => r.name),
    };
  } catch {
    return null;
  }
}

/** Cargos (IDs + nomes) de todos os membros do servidor, em uma chamada. */
export async function fetchRolesDeTodos(
  guildIdSessao?: string | null,
): Promise<Map<string, { ids: string[]; nomes: string[] }> | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const guildId = await resolverGuild(guildIdSessao);
    if (!guildId) return null;
    const headers = { Authorization: `Bot ${config.discordBotToken}` };
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, { headers }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
    ]);
    if (!membersRes.ok || !rolesRes.ok) return null;
    const members = (await membersRes.json()) as { user?: { id: string }; roles: string[] }[];
    const allRoles = (await rolesRes.json()) as GuildRole[];
    const nomePorId = new Map(allRoles.map((r) => [r.id, r.name]));

    const mapa = new Map<string, { ids: string[]; nomes: string[] }>();
    for (const m of members) {
      if (!m.user?.id) continue;
      mapa.set(m.user.id, {
        ids: m.roles,
        nomes: m.roles.map((id) => nomePorId.get(id)).filter((n): n is string => !!n),
      });
    }
    return mapa;
  } catch {
    return null;
  }
}

async function buscarRoleId(nome: string, guildIdSessao?: string | null): Promise<string | null> {
  const config = getConfig();
  const guildId = await resolverGuild(guildIdSessao);
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
  guildIdSessao?: string | null,
): Promise<void> {
  try {
    const config = getConfig();
    const id = roleId.trim().replace(/\D/g, "");
    const guildId = await resolverGuild(guildIdSessao);
    if (!id || !guildId) return;
    await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${id}`, {
      method: acao === "add" ? "PUT" : "DELETE",
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Adiciona ou remove um cargo do Discord pelo nome.
 * Usa o ID cadastrado nas Configurações da gang quando existir; senão procura pelo nome.
 */
export async function ajustarCargoDiscord(
  discordId: string,
  nomeCargo: string,
  acao: "add" | "remove",
  ctx: CtxDiscord = {},
): Promise<void> {
  try {
    const configurado = await lerConfigEscopo(ctx.gangId ?? null, chaveCargo(nomeCargo));
    const roleId = configurado ?? (await buscarRoleId(nomeCargo, ctx.guildId));
    if (!roleId) return;
    await ajustarCargoPorId(discordId, roleId, acao, ctx.guildId);
  } catch {
    /* best-effort */
  }
}

export type EmbedDiscord = {
  content?: string | undefined;
  allowedRoleIds?: string[] | undefined;
  title: string;
  description?: string | undefined;
  color?: number | undefined;
  fields?: { name: string; value: string; inline?: boolean }[] | undefined;
  thumbnail?: { url: string } | undefined;
  image?: { url: string } | undefined;
  timestamp?: string | undefined;
};

export type ResultadoEnvioDiscord = { ok: true } | { ok: false; motivo: string };

/** Publica em um canal conhecido e informa a causa quando o Discord recusar a mensagem. */
export async function enviarMensagemParaCanal(
  canalIdBruto: string,
  mensagem: EmbedDiscord,
): Promise<ResultadoEnvioDiscord> {
  const canalId = canalIdBruto.replace(/\D/g, "");
  if (!canalId) return { ok: false, motivo: "ID de canal inválido." };

  try {
    const config = getConfig();
    const { content, allowedRoleIds, ...embed } = mensagem;
    const resposta = await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(content ? { content } : {}),
        ...(allowedRoleIds?.length
          ? { allowed_mentions: { parse: [], roles: allowedRoleIds } }
          : {}),
        embeds: [{ color: 0xd4af37, ...embed }],
      }),
    });
    if (resposta.ok) return { ok: true };
    const detalhe = (await resposta.text()).replace(/\s+/g, " ").slice(0, 180);
    return {
      ok: false,
      motivo: `Discord respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : "."}`,
    };
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : "Falha de conexão." };
  }
}

/** Publica um embed no canal configurado para a gang. Best-effort. */
export async function enviarMensagemCanal(chaveCanal: string, ctx: CtxDiscord, mensagem: EmbedDiscord): Promise<void> {
  try {
    const canalId = (await lerConfigEscopo(ctx.gangId ?? null, chaveCanal))?.replace(/\D/g, "");
    if (!canalId) return;
    await enviarMensagemParaCanal(canalId, mensagem);
  } catch {
    /* best-effort */
  }
}

/**
 * Cargos de todos os membros do servidor (1 chamada), para usar o Discord
 * como fonte da verdade na listagem de membros.
 */
export async function fetchCargosDeTodos(guildIdSessao?: string | null): Promise<Map<string, string[]> | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const guildId = await resolverGuild(guildIdSessao);
    if (!guildId) return null;
    const headers = { Authorization: `Bot ${config.discordBotToken}` };
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, { headers }),
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

export type MembroDiscordServidor = UsuarioDiscord & { nick: string | null };

type GuildMemberDiscordApi = {
  nick?: string | null;
  avatar?: string | null;
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
};

function mapearMembroDiscordServidor(membro: GuildMemberDiscordApi): MembroDiscordServidor | null {
  const usuario = membro.user;
  if (!usuario?.id || usuario.bot) return null;
  return {
    id: usuario.id,
    username: usuario.username,
    globalName: usuario.global_name ?? null,
    avatarHash: membro.avatar ?? usuario.avatar ?? null,
    nick: membro.nick ?? null,
  };
}

/** Busca integrantes reais da guild por nome, apelido ou ID usando o bot Discord. */
export async function buscarMembrosServidor(
  guildIdSessao: string | null | undefined,
  busca: string,
): Promise<MembroDiscordServidor[]> {
  const termo = (busca ?? "").trim();
  if (termo.length < 2) return [];
  let config;
  try {
    config = getConfig();
  } catch {
    return [];
  }
  try {
    const guildId = await resolverGuild(guildIdSessao);
    if (!guildId) return [];
    const idDiscord = /^\d{17,20}$/.test(termo) ? termo : null;
    const url = idDiscord
      ? `https://discord.com/api/v10/guilds/${guildId}/members/${idDiscord}`
      : `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(termo)}&limit=25`;
    const resposta = await fetch(url, { headers: { Authorization: `Bot ${config.discordBotToken}` } });
    if (resposta.status === 404 || !resposta.ok) return [];
    const bruto = idDiscord
      ? [await resposta.json() as GuildMemberDiscordApi]
      : await resposta.json() as GuildMemberDiscordApi[];
    return bruto
      .map(mapearMembroDiscordServidor)
      .filter((membro): membro is MembroDiscordServidor => membro !== null);
  } catch {
    return [];
  }
}

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

export type GuildInfo = { id: string; nome: string; iconHash: string | null };

/** Informações de um servidor (nome + ícone), usando o token do bot. */
export async function fetchGuildInfo(guildId?: string): Promise<GuildInfo | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  try {
    const id = await resolverGuild(guildId);
    if (!id) return null;
    const res = await requisitarDiscord(`https://discord.com/api/v10/guilds/${id}`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (!res.ok) return null;
    const g = (await res.json()) as { id: string; name: string; icon?: string | null };
    return { id: g.id, nome: g.name, iconHash: g.icon ?? null };
  } catch {
    return null;
  }
}

/** Servidores em que o bot está instalado (para o painel do Super Owner). */
export async function fetchGuildsDoBot(): Promise<GuildInfo[]> {
  let config;
  try {
    config = getConfig();
  } catch {
    return [];
  }
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (!res.ok) return [];
    const guilds = (await res.json()) as { id: string; name: string; icon?: string | null }[];
    return guilds.map((g) => ({ id: g.id, nome: g.name, iconHash: g.icon ?? null }));
  } catch {
    return [];
  }
}

/**
 * Devolve (ou cria) um convite permanente do servidor usando o token do bot.
 * Reaproveita um convite infinito já existente antes de criar outro.
 */
export async function garantirConviteInfinito(guildId: string): Promise<string | null> {
  let config;
  try {
    config = getConfig();
  } catch {
    return null;
  }
  const id = (guildId ?? "").replace(/\D/g, "");
  if (!id) return null;
  const auth = { Authorization: `Bot ${config.discordBotToken}` };
  try {
    const atuais = await fetch(`https://discord.com/api/v10/guilds/${id}/invites`, {
      headers: auth,
    });
    if (atuais.ok) {
      const lista = (await atuais.json()) as {
        code: string;
        max_age?: number;
        max_uses?: number;
      }[];
      const eterno = lista.find((i) => !i.max_age && !i.max_uses);
      if (eterno) return `https://discord.gg/${eterno.code}`;
    }

    const canais = await fetch(`https://discord.com/api/v10/guilds/${id}/channels`, {
      headers: auth,
    });
    if (!canais.ok) return null;
    const lista = (await canais.json()) as { id: string; type: number; position?: number }[];
    const alvo = lista
      .filter((c) => c.type === 0 || c.type === 5)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    if (!alvo) return null;

    const criado = await fetch(`https://discord.com/api/v10/channels/${alvo.id}/invites`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false }),
    });
    if (!criado.ok) return null;
    const invite = (await criado.json()) as { code?: string };
    return invite.code ? `https://discord.gg/${invite.code}` : null;
  } catch {
    return null;
  }
}
