import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as svc from "./dashboard.server";
import { exigirSessaoPublica } from "./acesso-publico";
import { ConfigError, isConfigured } from "./config.server";
import { currentUser } from "./db.server";
import { acessoGangPermitido } from "./acesso-gang";
import type { SessionUserView } from "./permissions";
import type {
  ConfiguracoesPainel,
  ConfigInatividade,
  Divisao,
  GuildAtual,
  HistoricoAtributosMembro,
  LogPartida,
  Membro,
  AtributosMembroValores,
  Parceria,
  PresencaTreino,
  Punicao,
  Treino,
} from "./types";

export type GangDisponivel = {
  id: number;
  nome: string;
  guildId: string;
  iconHash: string | null;
};

export type SessionPayload = {
  configurado: boolean;
  faltando: string[];
  user: SessionUserView | null;
  permitido: boolean;
  gangId: number | null;
  gangNome: string | null;
};

export type BannerGlobal = {
  imagemUrl: string;
  discordUrl: string;
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
      return {
        configurado: false,
        faltando,
        user: null,
        permitido: false,
        gangId: null,
        gangNome: null,
      };
    }

    const request = getRequest();
    const user = await currentUser(request);
    if (!user)
      return {
        configurado: true,
        faltando: [],
        user: null,
        permitido: false,
        gangId: null,
        gangNome: null,
      };

    // O Super Owner não pode perder o painel por uma falha transitória na
    // consulta ao Discord. Os demais continuam sendo validados por IDs de cargo.
    const { ehDono, ehSuperOwner } = await import("./settings.server");
    user.isSuperOwner = ehSuperOwner(user.id);
    user.isOwner = user.isSuperOwner || (await ehDono(user.id, user.gangId));

    let temCargoDeAcessoConfigurado = false;
    if (!user.isSuperOwner && user.gangId != null) {
      // Cargos são revalidados e canonizados pelos IDs salvos em gang_config.
      const { fetchRolesAtuais } = await import("./discord.server");
      const { mapaCargos, canonizarCargos, temCargoConfiguradoComAcesso } =
        await import("./cargos.server");
      const cargosAtuais = await fetchRolesAtuais(user.id, user.guildId);
      if (cargosAtuais && user.gangId != null) {
        const mapa = await mapaCargos(user.gangId);
        user.roles = canonizarCargos(mapa, cargosAtuais.ids, cargosAtuais.nomes);
        user.roleIds = cargosAtuais.ids;
        temCargoDeAcessoConfigurado = temCargoConfiguradoComAcesso(mapa, cargosAtuais.ids);
      } else if (user.gangId != null) {
        // O token é assinado e os IDs foram confirmados no login/troca de gang.
        // Ele só é usado se a consulta transitória ao Discord estiver indisponível.
        const mapa = await mapaCargos(user.gangId);
        user.roles = canonizarCargos(mapa, user.roleIds);
        temCargoDeAcessoConfigurado = temCargoConfiguradoComAcesso(mapa, user.roleIds);
      }
    }

    let gangNome: string | null = null;
    if (user.gangId != null) {
      const { buscarGangPorId } = await import("./gangs.server");
      const gang = await buscarGangPorId(user.gangId);
      gangNome = gang?.nome ?? null;
      // Líder registrado da gang recebe o cargo "Lider" no painel.
      const { temCargo } = await import("./session.server");
      if (gang?.lider_id === user.id && !temCargo(user, "Lider")) {
        user.roles = [...user.roles, "Lider"];
      }
    }

    const { permissoesDoUsuario } = await import("./cargos-painel.server");
    user.permissoes = await permissoesDoUsuario(user.gangId, user.roleIds, user.isOwner);

    return {
      configurado: true,
      faltando: [],
      gangId: user.gangId,
      gangNome,
      // Sem gang escolhida, o painel envia para /selecionar-gang em vez de negar acesso.
      // Com gang ativa, somente Membro ou cargo superior configurado por ID libera a sessão.
      permitido: acessoGangPermitido(user.gangId, user.isSuperOwner, temCargoDeAcessoConfigurado),
      user: {
        id: user.id,
        username: user.username,
        globalName: user.globalName,
        avatarUrl: user.avatarUrl,
        roles: user.roles,
        isOwner: user.isOwner,
        isSuperOwner: user.isSuperOwner,
        nomeRp: user.nomeRp,
        permissoes: user.permissoes,
      },
    };
  },
);

/** Gangs que o usuário da sessão pode acessar (Super Owner vê todas). */
export const fetchGangsDisponiveis = createServerFn({ method: "GET" }).handler(
  async (): Promise<GangDisponivel[]> => {
    const user = await svc.requireUserSemGang(getRequest());
    const { gangsDoUsuario } = await import("./gangs-acesso.server");
    return gangsDoUsuario(user);
  },
);

export const fetchMembros = createServerFn({ method: "GET" }).handler(
  async (): Promise<Membro[]> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadMembros(user);
  },
);

export const buscarMembrosDiscord = createServerFn({ method: "POST" })
  .inputValidator((data: { busca: string }) => data)
  .handler(async ({ data }) => svc.buscarMembrosDiscord(await svc.requireUser(getRequest()), data.busca));

export const cadastrarMembroDiscord = createServerFn({ method: "POST" })
  .inputValidator((data: { discordId: string }) => data)
  .handler(async ({ data }) => svc.cadastrarMembroDiscord(await svc.requireUser(getRequest()), data));

export const fetchTreinos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Treino[]> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadTreinos(user);
  },
);

/** Anúncio único e global, exibido a todas as gangs autorizadas. */
export const fetchBannerGlobal = createServerFn({ method: "GET" }).handler(
  async (): Promise<BannerGlobal | null> => {
    await svc.requireUserSemGang(getRequest());
    const { CHAVE_BANNER_DISCORD_URL, CHAVE_BANNER_IMAGEM_URL, lerConfig } =
      await import("./settings.server");
    const [imagemUrl, discordUrl] = await Promise.all([
      lerConfig(CHAVE_BANNER_IMAGEM_URL),
      lerConfig(CHAVE_BANNER_DISCORD_URL),
    ]);
    if (!imagemUrl || !discordUrl) return null;
    return { imagemUrl, discordUrl };
  },
);

/** Anúncios ativos da Página Inicial, disponíveis a qualquer usuário autenticado. */
export const fetchAnunciosPublicos = createServerFn({ method: "GET" }).handler(async () => {
  exigirSessaoPublica(await currentUser(getRequest()));
  const { listarAnunciosPublicos } = await import("./anuncios.server");
  return listarAnunciosPublicos();
});

export const fetchDivisoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<Divisao[]> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadDivisoes(user);
  },
);

export const fetchParcerias = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ parcerias: Parceria[]; tabelaAusente: boolean }> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadParcerias(user);
  },
);

export const fetchPresencas = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }): Promise<PresencaTreino[]> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadPresencas(user, data.treinoId);
  });

export const fetchHistorico = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }): Promise<Punicao[]> => {
    const user = await svc.requireUser(getRequest());
    const { podeAdvertir } = await import("./session.server");
    if (!podeAdvertir(user)) throw new Error("Você não pode ver o registro de punições.");
    return svc.loadHistorico(user, data.membroId);
  });

export const fetchHistoricoAtributos = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }): Promise<HistoricoAtributosMembro[]> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadHistoricoAtributos(user, data.membroId);
  });

export const salvarAtributosMembro = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string; valores: AtributosMembroValores }) => data)
  .handler(async ({ data }) =>
    svc.salvarAtributosMembro(await svc.requireUser(getRequest()), data),
  );

export const fetchMinhaInscricao = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }): Promise<svc.MinhaRespostaEvento> => {
    const user = await svc.requireUser(getRequest());
    return svc.minhaInscricao(user, data);
  });

export const fetchAtividade = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId?: string | null; inicio?: string | null; fim?: string | null; tipoEvento?: string | null }) => data)
  .handler(async ({ data }) => svc.loadAtividade(await svc.requireUser(getRequest()), data));

export const fetchConfigInatividade = createServerFn({ method: "GET" }).handler(async () =>
  svc.loadConfigInatividade(await svc.requireUser(getRequest())),
);

export const salvarConfigInatividade = createServerFn({ method: "POST" })
  .inputValidator((data: ConfigInatividade) => data)
  .handler(async ({ data }) => svc.salvarConfigInatividade(await svc.requireUser(getRequest()), data));

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
  .handler(async ({ data }) => svc.alterarStatusMembro(await svc.requireUser(getRequest()), data));

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
      link_servidor_privado: string;
      divisao_responsavel: string;
      aliado?: string;
    }) => data,
  )
  .handler(async ({ data }) => svc.criarTreino(await svc.requireUser(getRequest()), data));

export const deletarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.deletarTreino(await svc.requireUser(getRequest()), data));

export const encerrarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.encerrarTreino(await svc.requireUser(getRequest()), data));

export const reabrirTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.reabrirTreino(await svc.requireUser(getRequest()), data));

export const adiarTreino = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number; data_treino: string; horario: string }) => data)
  .handler(async ({ data }) => svc.adiarTreino(await svc.requireUser(getRequest()), data));

export const inscreverSe = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number }) => data)
  .handler(async ({ data }) => svc.inscreverSe(await svc.requireUser(getRequest()), data));

export const ausentarSe = createServerFn({ method: "POST" })
  .inputValidator((data: { treinoId: number; justificativa: string }) => data)
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
      logoUrl?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => svc.atualizarDivisao(await svc.requireUser(getRequest()), data));

export const removerMembroDivisao = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string }) => data)
  .handler(async ({ data }) => svc.removerMembroDivisao(await svc.requireUser(getRequest()), data));

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

export const fetchCargosPainelPersonalizados = createServerFn({ method: "GET" }).handler(
  async () => svc.loadCargosPainelPersonalizados(await svc.requireUser(getRequest())),
);

export const salvarCargoPainelPersonalizado = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id?: number | null; nome: string; discordRoleId: string; permissoes: string[] }) => data,
  )
  .handler(async ({ data }) =>
    svc.salvarCargoPainelPersonalizado(await svc.requireUser(getRequest()), data),
  );

export const excluirCargoPainelPersonalizado = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) =>
    svc.excluirCargoPainelPersonalizado(await svc.requireUser(getRequest()), data.id),
  );

export const alterarCargoPainelMembro = createServerFn({ method: "POST" })
  .inputValidator((data: { membroId: string; cargoPainelId: number; ativo: boolean }) => data)
  .handler(async ({ data }) =>
    svc.alterarCargoPainelMembro(await svc.requireUser(getRequest()), data),
  );

export const fetchLogs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ logs: LogPartida[]; tabelaAusente: boolean }> => {
    const user = await svc.requireUser(getRequest());
    return svc.loadLogs(user);
  },
);

export const fetchGuildAtual = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuildAtual> => {
    const user = await svc.requireUser(getRequest());
    return svc.guildAtualInfo(user);
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
      link_servidor_privado: string;
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

/* ========== Diplomacia entre gangs ========== */

export const fetchGangsRegistradas = createServerFn({ method: "GET" }).handler(async () => {
  const user = await svc.requireUser(getRequest());
  const { listarGangsRegistradas } = await import("./diplomacia.server");
  return listarGangsRegistradas(user);
});

export const fetchSolicitacoes = createServerFn({ method: "GET" }).handler(async () => {
  const user = await svc.requireUser(getRequest());
  const { listarSolicitacoes } = await import("./diplomacia.server");
  return listarSolicitacoes(user);
});

export const fetchGuerras = createServerFn({ method: "GET" }).handler(async () => {
  const user = await svc.requireUser(getRequest());
  const { listarGuerrasAtivas } = await import("./diplomacia.server");
  return listarGuerrasAtivas(user);
});

export const criarSolicitacao = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      gangId: number;
      tipo: string;
      motivo: string;
      data_evento: string;
      horario: string;
      local: string;
      link_servidor_privado: string;
      membros_origem: string;
      membros_destino: string;
      representante_id?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { criarSolicitacao: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });

export const responderSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; aceitar: boolean }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { responderSolicitacao: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });

export const cancelarSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { cancelarSolicitacao: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });

export const excluirSolicitacao = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { excluirSolicitacao: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });

export const encerrarGuerra = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { encerrarGuerra: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });

export const removerRelacaoGang = createServerFn({ method: "POST" })
  .inputValidator((data: { gangId: number }) => data)
  .handler(async ({ data }) => {
    const user = await svc.requireUser(getRequest());
    const { removerRelacaoGang: fn } = await import("./diplomacia.server");
    return fn(user, data);
  });
