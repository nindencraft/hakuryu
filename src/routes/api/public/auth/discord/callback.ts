import { createFileRoute } from "@tanstack/react-router";

import { getConfig } from "@/lib/config.server";
import { getDb } from "@/lib/db.server";
import {
  sessionCookie,
  signSession,
} from "@/lib/session.server";
import {
  listarGangsDoUsuario,
  type Gang,
} from "@/lib/gangs.server";

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
};

type DiscordGuild = {
  id: string;
  name: string;
  owner: boolean;
  permissions?: string;
};

type GuildMember = {
  roles: string[];
  nick?: string | null;
};

type GuildRole = {
  id: string;
  name: string;
};

function fail(request: Request, message: string) {
  return Response.redirect(
    new URL(
      `/?erro=${encodeURIComponent(message)}`,
      request.url,
    ),
    302,
  );
}

export const Route = createFileRoute(
  "/api/public/auth/discord/callback",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        const code = url.searchParams.get("code");

        if (!code) {
          return fail(
            request,
            "Login cancelado ou código ausente.",
          );
        }

        /* =====================================================
         * 1. CONFIGURAÇÃO
         * ===================================================== */

        let config;

        try {
          config = getConfig();
        } catch (error) {
          return fail(
            request,
            (error as Error).message,
          );
        }

        const redirectUri =
          config.discordRedirectUri ||
          `${url.origin}/api/public/auth/discord/callback`;

        /* =====================================================
         * 2. TROCA O CODE PELO TOKEN DO DISCORD
         * ===================================================== */

        const tokenRes = await fetch(
          "https://discord.com/api/v10/oauth2/token",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: config.discordClientId,
              client_secret: config.discordClientSecret,
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
            }),
          },
        );

        if (!tokenRes.ok) {
          const detalhe = (
            await tokenRes.text()
          ).slice(0, 300);

          return fail(
            request,
            `Não foi possível validar o login com o Discord (${tokenRes.status}). Verifique a URL de redirecionamento ${redirectUri} e as credenciais do Discord. Detalhe: ${detalhe}`,
          );
        }

        const token = (await tokenRes.json()) as {
          access_token: string;
        };

        /* =====================================================
         * 3. IDENTIDADE DO USUÁRIO
         * ===================================================== */

        const userRes = await fetch(
          "https://discord.com/api/v10/users/@me",
          {
            headers: {
              Authorization:
                `Bearer ${token.access_token}`,
            },
          },
        );

        if (!userRes.ok) {
          return fail(
            request,
            "Não foi possível ler seu perfil do Discord.",
          );
        }

        const discordUser =
          (await userRes.json()) as DiscordUser;

        /* =====================================================
         * 4. VERIFICA SE É SUPER OWNER
         * ===================================================== */

        const { ehDono, ehSuperOwner } =
          await import("@/lib/settings.server");

        let isOwner =
          (!!config.discordOwnerId &&
            config.discordOwnerId === discordUser.id) ||
          (await ehDono(discordUser.id));

        /* =====================================================
         * 5. LISTA AS GUILDS DO USUÁRIO
         *
         * O OAuth precisa possuir o scope:
         *
         * guilds
         *
         * ===================================================== */

        const userGuildsRes = await fetch(
          "https://discord.com/api/v10/users/@me/guilds",
          {
            headers: {
              Authorization:
                `Bearer ${token.access_token}`,
            },
          },
        );

        let userGuilds: DiscordGuild[] = [];

        if (userGuildsRes.ok) {
          userGuilds =
            (await userGuildsRes.json()) as DiscordGuild[];
        }

        /* =====================================================
        * 6. BUSCA AS GANGS DOS SERVIDORES DO USUÁRIO
        * ===================================================== */

      let gangs: Gang[] = [];

      try {
      gangs = await listarGangsDoUsuario(
      userGuilds.map((guild) => guild.id),
      );
      } catch (error) {
      return fail(
        request,
        `Não foi possível carregar suas gangs: ${(error as Error).message}`,
        );
      }
        /* =====================================================
         * 7. ENCONTRA A GANG DO USUÁRIO
         *
         * Compara:
         *
         * Discord Guild
         *       ↓
         * gangs.guild_id
         * ===================================================== */

        let gang: Gang | null = null;
        let guildId: string | null = null;

        if (gangs.length === 1) {
          const unicaGang = gangs[0];

        if (unicaGang) {
          gang = unicaGang;
          guildId = unicaGang.guild_id;
          }
        }
        /* =====================================================
         * 8. SUPER OWNER
         *
         * O Super Owner pode entrar sem possuir uma gang
         * selecionada.
         *
         * Isso permitirá que futuramente ele escolha a gang
         * pelo próprio painel.
         * ===================================================== */

        if (gangs.length === 0 && !isOwner) {
          return fail(
          request,
        "Você não pertence a nenhum servidor Discord associado a uma gang.",
        );
      }

        /* =====================================================
         * 9. VERIFICA O MEMBRO E CARGOS NO SERVIDOR
         *
         * Para usuário normal, usamos a guild encontrada.
         *
         * Para Super Owner sem gang selecionada, não há
         * necessidade de verificar cargos.
         * ===================================================== */

        let roleNames: string[] = [];

        if (guildId) {
          const memberRes = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`,
            {
              headers: {
                Authorization:
                  `Bot ${config.discordBotToken}`,
              },
            },
          );

          if (memberRes.status === 404) {
            if (!isOwner) {
              return fail(
                request,
                "Você não está no servidor da gang.",
              );
            }
          } else if (!memberRes.ok) {
            return fail(
              request,
              "Não foi possível verificar sua participação no servidor.",
            );
          } else {
            const member =
              (await memberRes.json()) as GuildMember;

            /* =================================================
             * 10. BUSCA OS NOMES DOS CARGOS
             * ================================================= */

            const rolesRes = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/roles`,
              {
                headers: {
                  Authorization:
                    `Bot ${config.discordBotToken}`,
                },
              },
            );

            const allRoles = rolesRes.ok
              ? ((await rolesRes.json()) as GuildRole[])
              : [];

            roleNames = allRoles
              .filter((role) =>
                member.roles.includes(role.id),
              )
              .map((role) => role.name);
          }
        }

        /* =====================================================
         * 11. BUSCA O MEMBRO NO BANCO
         *
         * IMPORTANTE:
         *
         * Agora usamos Discord ID + gang_id.
         *
         * Isso permite:
         *
         * Discord A + Gang A
         * Discord A + Gang B
         *
         * serem registros independentes.
         * ===================================================== */

        let nomeRp: string | null = null;

        if (gang) {
          // Donos e líder cadastrados na gang escolhida.
          if (!isOwner && (await ehDono(discordUser.id, gang.id))) isOwner = true;
          if (gang.lider_id === discordUser.id && !roleNames.includes("Lider")) {
            roleNames.push("Lider");
          }
          try {
            const db = getDb();

            const { data } = await db
              .from("membros")
              .select("nome_rp")
              .eq("discord_id", discordUser.id)
              .eq("gang_id", gang.id)
              .maybeSingle();

            nomeRp =
              (
                data as
                  | { nome_rp: string | null }
                  | null
              )?.nome_rp ?? null;

            /* ===============================================
             * NOVO MEMBRO
             * =============================================== */

            if (!data) {
              await db.from("membros").insert({
                discord_id: discordUser.id,
                discord_username:
                  discordUser.username,
                nome_rp:
                  discordUser.global_name ??
                  discordUser.username,

                gang_id: gang.id,

                cargo: "Em Analise",
                status: "Em Analise",

                avatar_hash: discordUser.avatar,

                data_entrada:
                  new Date().toISOString(),
              });

              const {
                ajustarCargoDiscord,
              } = await import(
                "@/lib/discord.server"
              );

              await ajustarCargoDiscord(
                discordUser.id,
                "Em Analise",
                "add",
                { guildId: gang.guild_id, gangId: gang.id },
              );

              roleNames.push("Em Analise");

              nomeRp =
                discordUser.global_name ??
                discordUser.username;
            }
          } catch {
            nomeRp = null;
          }
        }

        /* =====================================================
         * 12. AVATAR
         * ===================================================== */

        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : "https://cdn.discordapp.com/embed/avatars/0.png";

        /* =====================================================
         * 13. CRIA A SESSÃO
         *
         * Aqui finalmente guardamos:
         *
         * guildId
         * gangId
         * ===================================================== */

        const sessionToken = await signSession({
          id: discordUser.id,

          username:
            discordUser.username,

          globalName:
            discordUser.global_name ?? null,

          avatarUrl,

          roles: roleNames,

          isOwner,

          isSuperOwner: ehSuperOwner(discordUser.id),

          nomeRp,

          guildId,

          gangId: gang?.id ?? null,
        });

        /* =====================================================
         * 14. FINALIZA LOGIN
         * ===================================================== */

        return new Response(null, {
          status: 302,

          headers: {
            Location: gang ? "/" : "/selecionar-gang",

            "Set-Cookie": sessionCookie(
              sessionToken,
              url.protocol === "https:",
            ),
          },
        });
      },
    },
  },
});