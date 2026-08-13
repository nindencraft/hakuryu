import { createFileRoute } from "@tanstack/react-router";

import { getConfig } from "@/lib/config.server";
import { getDb } from "@/lib/db.server";
import { sessionCookie, signSession } from "@/lib/session.server";

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
};

type GuildMember = { roles: string[]; nick?: string | null };
type GuildRole = { id: string; name: string };

function fail(request: Request, message: string) {
  return Response.redirect(
    new URL(`/?erro=${encodeURIComponent(message)}`, request.url),
    302,
  );
}

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) return fail(request, "Login cancelado ou código ausente.");

        let config;
        try {
          config = getConfig();
        } catch (error) {
          return fail(request, (error as Error).message);
        }

        const redirectUri = `${url.origin}/api/public/auth/discord/callback`;

        // 1. Troca o código pelo token de acesso
        const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.discordClientId,
            client_secret: config.discordClientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });
        if (!tokenRes.ok) {
          const detalhe = (await tokenRes.text()).slice(0, 300);
          return fail(
            request,
            `Não foi possível validar o login com o Discord (${tokenRes.status}). Verifique se a URL de redirecionamento ${redirectUri} está cadastrada no portal do Discord e se DISCORD_CLIENT_ID/SECRET estão corretos. Detalhe: ${detalhe}`,
          );
        }
        const token = (await tokenRes.json()) as { access_token: string };

        // 2. Identidade do usuário
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!userRes.ok) return fail(request, "Não foi possível ler seu perfil do Discord.");
        const discordUser = (await userRes.json()) as DiscordUser;

        // 3. Membro do servidor da gang (via bot, para ler cargos com segurança)
        const { guildIdAtivo, ehDono } = await import("@/lib/settings.server");
        const guildId = await guildIdAtivo();
        if (!guildId) {
          return fail(
            request,
            "Nenhum servidor do Discord configurado. Um dono do painel precisa informar o ID da guild em Configurações.",
          );
        }
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`,
          { headers: { Authorization: `Bot ${config.discordBotToken}` } },
        );
        if (memberRes.status === 404) {
          return fail(request, "Você não está no servidor da gang.");
        }
        if (!memberRes.ok) {
          return fail(request, "Não foi possível verificar sua participação no servidor.");
        }
        const member = (await memberRes.json()) as GuildMember;

        // 4. Nomes dos cargos
        const rolesRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/roles`,
          { headers: { Authorization: `Bot ${config.discordBotToken}` } },
        );
        const allRoles = rolesRes.ok ? ((await rolesRes.json()) as GuildRole[]) : [];
        const roleNames = allRoles
          .filter((r) => member.roles.includes(r.id))
          .map((r) => r.name);

        // 5. Nome RP vindo da tabela membros
        let nomeRp: string | null = null;
        try {
          const db = getDb();
          const { data } = await db
            .from("membros")
            .select("nome_rp")
            .eq("discord_id", discordUser.id)
            .maybeSingle();
          nomeRp = (data as { nome_rp: string | null } | null)?.nome_rp ?? null;

          // Novo integrante entra sempre como "Em Analise".
          if (!data) {
            await db.from("membros").insert({
              discord_id: discordUser.id,
              discord_username: discordUser.username,
              nome_rp: discordUser.global_name ?? discordUser.username,
              cargo: "Em Analise",
              status: "Em Analise",
              avatar_hash: discordUser.avatar,
              data_entrada: new Date().toISOString(),
            });
            const { ajustarCargoDiscord } = await import("@/lib/discord.server");
            await ajustarCargoDiscord(discordUser.id, "Em Analise", "add");
            roleNames.push("Em Analise");
          }
        } catch {
          nomeRp = null;
        }

        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : "https://cdn.discordapp.com/embed/avatars/0.png";

        const sessionToken = await signSession({
          id: discordUser.id,
          username: discordUser.username,
          globalName: discordUser.global_name ?? null,
          avatarUrl,
          roles: roleNames,
          isOwner:
            (!!config.discordOwnerId && config.discordOwnerId === discordUser.id) ||
            (await ehDono(discordUser.id)),
          nomeRp,
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
            "Set-Cookie": sessionCookie(sessionToken, url.protocol === "https:"),
          },
        });
      },
    },
  },
});
