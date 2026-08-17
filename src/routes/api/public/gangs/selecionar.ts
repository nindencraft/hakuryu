import { createFileRoute } from "@tanstack/react-router";

import { currentUser, getDb } from "@/lib/db.server";
import { sessionCookie, signSession } from "@/lib/session.server";

/**
 * Troca a gang ativa da sessão.
 * A validação de acesso acontece aqui — o cliente só envia o id desejado.
 */
export const Route = createFileRoute("/api/public/gangs/selecionar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return new Response("Não autenticado", { status: 401 });

        const { ehSuperOwner } = await import("@/lib/settings.server");
        user.isSuperOwner = ehSuperOwner(user.id);

        let gangId: number;
        try {
          const body = (await request.json()) as { gangId?: unknown };
          gangId = Number(body.gangId);
        } catch {
          return new Response("Corpo inválido", { status: 400 });
        }
        if (!Number.isFinite(gangId)) return new Response("Gang inválida", { status: 400 });

        const { podeAcessarGang } = await import("@/lib/gangs-acesso.server");
        const gang = await podeAcessarGang(user, gangId);
        if (!gang) return new Response("Sem acesso a esta gang", { status: 403 });

        // Cargos e nome de RP passam a valer no contexto da nova gang.
        const { fetchCargosAtuais } = await import("@/lib/discord.server");
        const roles = (await fetchCargosAtuais(user.id, gang.guild_id)) ?? [];

        let nomeRp: string | null = null;
        try {
          const db = getDb();
          const { data } = await db
            .from("membros")
            .select("nome_rp")
            .eq("gang_id", gang.id)
            .eq("discord_id", user.id)
            .maybeSingle();
          nomeRp = (data as { nome_rp: string | null } | null)?.nome_rp ?? null;
        } catch {
          nomeRp = null;
        }

        const token = await signSession({
          id: user.id,
          username: user.username,
          globalName: user.globalName,
          avatarUrl: user.avatarUrl,
          roles,
          isOwner: user.isSuperOwner,
          isSuperOwner: user.isSuperOwner,
          nomeRp,
          guildId: gang.guild_id,
          gangId: gang.id,
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"),
          },
        });
      },
    },
  },
});
