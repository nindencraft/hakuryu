import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as svc from "./dashboard.server";
import { ConfigError, isConfigured } from "./config.server";
import { currentUser } from "./db.server";
import type { SessionUserView } from "./permissions";
import type {
  ConfiguracoesPainel,
  Divisao,
  Membro,
  Parceria,
  PresencaTreino,
  Punicao,
  Treino,
} from "./types";

export type SessionPayload = {
  configurado: boolean;
  faltando: string[];
  user: SessionUserView | null;
  permitido: boolean;
};

export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionPayload> => {
    if (!isConfigured()) {
      let faltando: string[] = [];
      try {
        const { getConfig } = await import("./config.server");
        getConfig();
      } catch (error) {
        if (error instanceof ConfigError) faltando = error.missing;
      }
      return { configurado: false, faltando, user: null, permitido: false };
    }

    const request = getRequest();
    const user = await currentUser(request);
    if (!user) return { configurado: true, faltando: [], user: null, permitido: false };

    const { podeAcessar } = await import("./session.server");

    // Cargos são revalidados no Discord a cada carregamento para nunca ficarem defasados.
    const { fetchCargosAtuais } = await import("./discord.server");
    const cargosAtuais = await fetchCargosAtuais(user.id);
    if (cargosAtuais) user.roles = cargosAtuais;

    if (!user.isOwner) {
      const { ehDono } = await import("./settings.server");
      if (await ehDono(user.id)) user.isOwner = true;
    }

    return {
      configurado: true,
      faltando: [],
      permitido: podeAcessar(user),
      user: {
        id: user.id,
        username: user.username,
        globalName: user.globalName,
        avatarUrl: user.avatarUrl,
        roles: user.roles,
        isOwner: user.isOwner,
        nomeRp: user.nomeRp,
      },
    };
  },
);

export const fetchMembros = createServerFn({ method: "GET" }).handler(
  async (): Promise<Membro[]> => {
    await svc.requireUser(getRequest());
    return svc.loadMembros();
  },
);

export const fetchTreinos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Treino[]> => {
    await svc.requireUser(getRequest());
    return svc.loadTreinos();
  },
);

export const fetchDivisoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<Divisao[]> => {
    await svc.requireUser(getRequest());
    return svc.loadDivisoes();
  },
);

export const fetchParcerias = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ parcerias: Parceria[]; tabelaAusente: boolean }> => {
    await svc.requireUser(getRequest());
    return svc.loadParcerias();
  },
);

export const fetchPresencas = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }): Promise<PresencaTreino[]> => {
    await svc.requireUser(getRequest());
    return svc.loadPresencas(data.treinoId);
  });

export const fetchHistorico = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }): Promise<Punicao[]> => {
    const user = await svc.requireUser(getRequest());
    const { podeAdvertir } = await import("./session.server");
    if (!podeAdvertir(user)) throw new Error("Você não pode ver o registro de punições.");
    return svc.loadHistorico(data.membroId);
  });

export const fetchMinhaInscricao = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }): Promise<{ inscricao: string | null }> => {
    const user = await svc.requireUser(getRequest());
    return { inscricao: await svc.minhaInscricao(user, data) };
  });

export const revogarPunicao = createServerFn({ method: "POST" })
  .inputValidator((data: { punicaoId: number }) => data)
  .handler(async ({ data }) => svc.revogarPunicao(await svc.requireUser(getRequest()), data));

export const advertirMembro = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string; tipo: string; motivo: string }) => data)
  .handler(async ({ data }) => svc.advertirMembro(await svc.requireUser(getRequest()), data));

export const trocarCargo = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string; cargos: string[] }) => data)
  .handler(async ({ data }) => svc.trocarCargo(await svc.requireUser(getRequest()), data));

export const alterarStatusMembro = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string; status: string }) => data)
  .handler(async ({ data }) =>
    svc.alterarStatusMembro(await svc.requireUser(getRequest()), data),
  );

export const removerMembro = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }) => svc.removerMembro(await svc.requireUser(getRequest()), data));

export const criarTreino = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      titulo: string;
      descricao: string;
      data_treino: string;
      horario: string;
      tipo: string;
      local: string;
      divisao_responsavel: string;
      aliado: string;
    }) => data,
  )
  .handler(async ({ data }) => svc.criarTreino(await svc.requireUser(getRequest()), data));


export const deletarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.deletarTreino(await svc.requireUser(getRequest()), data));

export const encerrarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.encerrarTreino(await svc.requireUser(getRequest()), data));

export const adiarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number; data_treino: string; horario: string }) => data)
  .handler(async ({ data }) => svc.adiarTreino(await svc.requireUser(getRequest()), data));

export const inscreverSe = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.inscreverSe(await svc.requireUser(getRequest()), data));

export const ausentarSe = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.ausentarSe(await svc.requireUser(getRequest()), data));

export const atualizarPresenca = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number; membroId: string; presenca: string }) => data)
  .handler(async ({ data }) => svc.atualizarPresenca(await svc.requireUser(getRequest()), data));

export const criarDivisao = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      nome_divisao: string;
      logo_url: string;
      discord_role_id: string;
      funcao_principal: string;
    }) => data,
  )
  .handler(async ({ data }) => svc.criarDivisao(await svc.requireUser(getRequest()), data));

export const atualizarDivisao = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      divisaoId: number;
      liderId: string | null;
      viceLiderId: string | null;
      novosMembros: string[];
    }) => data,
  )
  .handler(async ({ data }) => svc.atualizarDivisao(await svc.requireUser(getRequest()), data));

export const removerMembroDivisao = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }) =>
    svc.removerMembroDivisao(await svc.requireUser(getRequest()), data),
  );

export const deletarDivisao = createServerFn({ method: "POST" })
  .inputValidator((data: { divisaoId: number }) => data)
  .handler(async ({ data }) => svc.deletarDivisao(await svc.requireUser(getRequest()), data));

export const resolverAliado = createServerFn({ method: "POST" })
  .inputValidator((data: { convite: string; representanteId: string }) => data)
  .handler(async ({ data }) => svc.resolverAliado(await svc.requireUser(getRequest()), data));

export const salvarParceria = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: number | null;
      nome: string;
      tag: string;
      contato: string;
      status: string;
      link_servidor: string;
      observacoes: string;
      data_inicio: string;
      icon_hash: string;
      representante_id: string;
      representante_nome: string;
      representante_avatar: string;
    }) => data,
  )
  .handler(async ({ data }) => svc.salvarParceria(await svc.requireUser(getRequest()), data));

export const deletarParceria = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => svc.deletarParceria(await svc.requireUser(getRequest()), data));


export const atualizarMeusDados = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      membroId: string;
      nome_rp: string;
      nome_roblox: string;
      genero: string;
      altura: string;
      estilo_luta_principal: string;
    }) => data,
  )
  .handler(async ({ data }) => svc.atualizarDadosMembro(await svc.requireUser(getRequest()), data));

export const fetchConfiguracoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConfiguracoesPainel> =>
    svc.loadConfiguracoesPainel(await svc.requireUser(getRequest())),
);

export const salvarConfiguracoes = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      cargos: Record<string, string>;
      canais: Record<string, string>;
      owners: string;
      guildId: string;
    }) => data,
  )
  .handler(async ({ data }) =>
    svc.salvarConfiguracoesPainel(await svc.requireUser(getRequest()), data),
  );

export const fetchLogs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ logs: LogPartida[]; tabelaAusente: boolean }> => {
    await svc.requireUser(getRequest());
    return svc.loadLogs();
  },
);

export const fetchGuildAtual = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuildAtual> => {
    await svc.requireUser(getRequest());
    return svc.guildAtualInfo();
  },
);

export const salvarLog = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      tipo: string;
      adversario_id: number | null;
      adversario_nome: string;
      adversario_guild_id: string | null;
      adversario_icon_hash: string | null;
      pontos_nos: number;
      pontos_eles: number;
      data_partida: string;
      observacoes: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    await svc.salvarLog(user, data);
    return { ok: true };
  });

export const deletarLog = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    await svc.deletarLog(user, data.id);
    return { ok: true };
  });
