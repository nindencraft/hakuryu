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

export type BannerGlobalAdmin = {
  imagemUrl: string;
  discordUrl: string;
};

async function requireSuperOwner() {
  const user = await svc.requireUserSemGang(getRequest());
  if (!user.isSuperOwner) throw new Error("Apenas o Super Owner acessa esta área.");
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

/** Exclusão definitiva de gang, disponível exclusivamente ao Super Owner. */
export const excluirGangAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const { excluirGang } = await import("./gangs.server");
    return excluirGang(data.id);
  });

/** Publica uma divulgação nos canais configurados de todas as gangs. */
export const publicarDivulgacaoAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { imagemUrl: string }) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const { publicarDivulgacaoGlobal } = await import("./divulgacao.server");
    return publicarDivulgacaoGlobal(data.imagemUrl);
  });

/** Cria ou atualiza o anúncio único exibido na Visão Geral de todas as gangs. */
export const salvarBannerAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: BannerGlobalAdmin) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const [
      { normalizarLinkEvento },
      {
        CHAVE_BANNER_DISCORD_URL,
        CHAVE_BANNER_IMAGEM_URL,
        salvarConfiguracoes,
      },
    ] = await Promise.all([import("./event-link"), import("./settings.server")]);

    const imagemUrl = normalizarLinkEvento(data.imagemUrl, "A URL da imagem do anúncio");
    const discordUrl = normalizarLinkEvento(data.discordUrl, "O link do servidor Discord");
    if (!imagemUrl || !discordUrl) {
      throw new Error("Informe a URL da imagem e o link do servidor Discord.");
    }

    await salvarConfiguracoes({
      [CHAVE_BANNER_IMAGEM_URL]: imagemUrl,
      [CHAVE_BANNER_DISCORD_URL]: discordUrl,
    });
    return { ok: true };
  });

/** Remove o anúncio global sem alterar outras configurações do painel. */
export const removerBannerAdmin = createServerFn({ method: "POST" }).handler(async () => {
  await requireSuperOwner();
  const { CHAVE_BANNER_DISCORD_URL, CHAVE_BANNER_IMAGEM_URL, salvarConfiguracoes } = await import(
    "./settings.server"
  );
  await salvarConfiguracoes({
    [CHAVE_BANNER_IMAGEM_URL]: "",
    [CHAVE_BANNER_DISCORD_URL]: "",
  });
  return { ok: true };
});
