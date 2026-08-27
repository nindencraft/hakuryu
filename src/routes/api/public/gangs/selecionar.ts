import { createFileRoute } from "@tanstack/react-router";

import { currentUser, getDb } from "@/lib/db.server";
import { sessionCookie, signSession } from "@/lib/session.server";

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

        const { fetchCargosAtuais } = await import("@/lib/discord.server");
        const roles = (await fetchCargosAtuais(user.id, gang.guild_id)) ?? [];

        let nomeRp: string | null = null;
        try {
          const db = getDb();
          const { data } = await db
            .from("membros")
            .select("nome_rp, status")
            .eq("gang_id", gang.id)
            .eq("discord_id", user.id)
            .maybeSingle();
          const membro = data as { nome_rp: string | null; status: string | null } | null;
          if (membro?.status === "Banido") return new Response("Usuário banido nesta gang", { status: 403 });
          nomeRp = membro?.nome_rp ?? null;
        } catch {
          nomeRp = null;
        }

        const token = await signSession({
          id: user.id,
          username: user.username,
          globalName: user.globalName,
          avatarUrl: user.avatarUrl,
          roles,
          roleIds: roles,
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
