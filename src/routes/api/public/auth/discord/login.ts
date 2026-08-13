import { createFileRoute } from "@tanstack/react-router";

import { getConfig, ConfigError } from "@/lib/config.server";

export const Route = createFileRoute("/api/public/auth/discord/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let config;
        try {
          config = getConfig();
        } catch (error) {
          const message =
            error instanceof ConfigError ? error.message : "Configuração inválida";
          return Response.redirect(
            new URL(`/auth?erro=${encodeURIComponent(message)}`, request.url),
            302,
          );
        }

        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/api/public/auth/discord/callback`;

        const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
        authorizeUrl.searchParams.set("client_id", config.discordClientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("scope", "identify guilds guilds.members.read");
        authorizeUrl.searchParams.set("prompt", "none");

        return Response.redirect(authorizeUrl.toString(), 302);
      },
    },
  },
});
