import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as svc from "./dashboard.server";

export type GangAdmin = {
  id: number;
  nome: string;
  guildId: string;
  ativo: boolean;
  liderId: string | null;
  criadoEm: string;
};

export type GuildBot = { id: string; nome: string; iconHash: string | null; registrada: boolean };

async function requireSuperOwner() {
  const user = await svc.requireUserSemGang(getRequest());
  if (!user.isOwner) throw new Error("Apenas o Super Owner acessa esta área.");
  return user;
}

export const fetchGangsAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<GangAdmin[]> => {
    await requireSuperOwner();
    const { listarGangs } = await import("./gangs.server");
    return (await listarGangs()).map((g) => ({
      id: g.id,
      nome: g.nome,
      guildId: g.guild_id,
      ativo: g.ativo,
      liderId: g.lider_id,
      criadoEm: g.criado_em,
    }));
  },
);

export const fetchGuildsDoBotAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuildBot[]> => {
    await requireSuperOwner();
    const [{ fetchGuildsDoBot }, { listarGangs }] = await Promise.all([
      import("./discord.server"),
      import("./gangs.server"),
    ]);
    const [guilds, gangs] = await Promise.all([fetchGuildsDoBot(), listarGangs()]);
    const registradas = new Set(gangs.map((g) => g.guild_id));
    return guilds.map((g) => ({
      id: g.id,
      nome: g.nome,
      iconHash: g.iconHash,
      registrada: registradas.has(g.id),
    }));
  },
);

export const salvarGangAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id?: number | null;
      nome: string;
      guildId: string;
      liderId?: string | null;
      ativo?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const user = await requireSuperOwner();
    const { criarGang, atualizarGang } = await import("./gangs.server");
    if (data.id == null) {
      const gang = await criarGang({
        nome: data.nome,
        guildId: data.guildId,
        liderId: data.liderId ?? null,
        criadoPor: user.id,
      });
      return { ok: true, id: gang.id };
    }
    await atualizarGang(data.id, {
      nome: data.nome,
      guildId: data.guildId,
      liderId: data.liderId ?? null,
      ...(data.ativo === undefined ? {} : { ativo: data.ativo }),
    });
    return { ok: true, id: data.id };
  });

export const alternarGangAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; ativo: boolean }) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const { atualizarGang } = await import("./gangs.server");
    await atualizarGang(data.id, { ativo: data.ativo });
    return { ok: true };
  });
