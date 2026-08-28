import { getDb, currentUser } from "./db.server";
import {
  cargosAtribuiveis,
  podeAdvertir,
  podeAplicarBan,
  podeAplicarWarn,
  podeAdicionarMembro,
  podeAgendarTreino,
  podeAlterarCargo,
  podeCriarDivisao,
  podeDeletarLog,
  podeDeletarTreino,
  podeGerenciarMembros,
  podeGerenciarTreino,
  podeRevogarPunicao,
  podeGerenciarParcerias,
  podeGerenciarTreinos,
  podeCriarLog,
  podeConfigurarCanais,
  podeConfigurarCargos,
  podeConfigurarInatividade,
  podeEditarFichaRPG,
  temCargo,
  temPermissao,
  CARGOS_PERMITIDOS,
  CARGOS_DIVISAO,
  type SessionUser,
} from "./session.server";
import { cargoPrimario } from "./permissions";
import { normalizarLinkEvento } from "./event-link";
import { acessoGangPermitido } from "./acesso-gang";
import { buscarFichaRPG, encerrarHistoricoDeMembro } from "./perfil.server";
import { normalizarFichaRPG, type FichaRPGInput } from "./perfil";
import { encontrarParceriaDuplicada } from "./parcerias";
import { contarInscricoesConfirmadas } from "./presenca";
import { normalizarDataEvento } from "./atividade";
import {
  TIPO_TREINO_OPCOES,
  normalizarTiposTreino,
  type AliadoResolvido,
  type Divisao,
  type GuildAtual,
  type LogPartida,
  type Membro,
  type MembroAtributos,
  type HistoricoAtributosMembro,
  type AtributosMembroValores,
  type ConfigInatividade,
  type RegistroAtividade,
  type ResumoAtividade,
  type Parceria,
  type PresencaTreino,
  type Punicao,
  type Treino,
} from "./types";


/* ========== Sessão / guardas ========== */

export async function requireUserSemGang(request: Request): Promise<SessionUser> {
  const user = await currentUser(request);
  if (!user) throw new Error("NAO_AUTENTICADO");

  // Recalcula o Super Owner antes de consultar o Discord. Assim, uma consulta
  // momentaneamente indisponível não derruba o acesso administrativo global.
  const { ehDono, ehSuperOwner } = await import("./settings.server");
  user.isSuperOwner = ehSuperOwner(user.id);
  user.isOwner = user.isSuperOwner || (await ehDono(user.id, user.gangId));

  let temCargoDeAcessoConfigurado = false;
  let liderRegistrado = false;
  if (!user.isSuperOwner && user.gangId != null) {
    // Revalida os cargos direto no Discord (a sessão pode estar defasada) e
    // traduz os cargos do servidor para os cargos do painel usando os IDs configurados.
    const { fetchRolesAtuais } = await import("./discord.server");
    const { mapaCargos, canonizarCargos, temCargoConfiguradoComAcesso } = await import(
      "./cargos.server"
    );
    const atuais = await fetchRolesAtuais(user.id, user.guildId);
    if (atuais) {
      const mapa = await mapaCargos(user.gangId);
      user.roles = canonizarCargos(mapa, atuais.ids, atuais.nomes);
      user.roleIds = atuais.ids;
      temCargoDeAcessoConfigurado = temCargoConfiguradoComAcesso(mapa, atuais.ids);
    } else if (user.gangId != null) {
      // O token é assinado e os IDs foram confirmados no login/troca de gang.
      // Ele só é usado quando o Discord está indisponível na revalidação atual.
      const mapa = await mapaCargos(user.gangId);
      user.roles = canonizarCargos(mapa, user.roleIds);
      temCargoDeAcessoConfigurado = temCargoConfiguradoComAcesso(mapa, user.roleIds);
    }
  }
  // Líder registrado da gang sempre tem o cargo "Lider" no painel.
  if (user.gangId != null && !temCargo(user, "Lider")) {
    const { buscarGangPorId } = await import("./gangs.server");
    const gang = await buscarGangPorId(user.gangId);
    liderRegistrado = gang?.lider_id === user.id;
    if (liderRegistrado) user.roles = [...user.roles, "Lider"];
  } else if (user.gangId != null) {
    const { buscarGangPorId } = await import("./gangs.server");
    liderRegistrado = (await buscarGangPorId(user.gangId))?.lider_id === user.id;
  }
  const { permissoesDoUsuario, cargosAtribuiveisDoUsuario } = await import("./cargos-painel.server");
  user.permissoes = await permissoesDoUsuario(user.gangId, user.roleIds, user.isOwner);
  user.cargosAtribuiveis = await cargosAtribuiveisDoUsuario(user.gangId, user.roleIds, user.isOwner);
  // Sem gang escolhida o painel manda o usuário para /selecionar-gang.
  if (user.gangId == null) return user;

  const { data: statusAtual, error: erroStatus } = await getDb()
    .from("membros")
    .select("status")
    .eq("gang_id", user.gangId)
    .eq("discord_id", user.id)
    .maybeSingle();
  if (erroStatus) throw new Error(erroStatus.message);
  if ((statusAtual as { status?: string | null } | null)?.status === "Banido") {
    throw new Error("USUARIO_BANIDO");
  }

  // O acesso pode vir do cargo Membro/superior configurado ou da permissão
  // explícita Acessar Painel. O Super Owner é a exceção administrativa global.
  if (!acessoGangPermitido(
    user.gangId,
    user.isSuperOwner,
    temCargoDeAcessoConfigurado || user.permissoes.includes("acessar_painel"),
    liderRegistrado,
  )) {
    throw new Error("SEM_PERMISSAO");
  }
  return user;
}

/**
 * Sessão válida COM gang resolvida. Toda rota de dados usa esta guarda:
 * sem gang na sessão o front manda o usuário escolher uma.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await requireUserSemGang(request);
  if (user.gangId == null) throw new Error("SEM_GANG");
  return user;
}

/** Gang da sessão — nunca vem do cliente. */
export function gid(user: SessionUser): number {
  if (user.gangId == null) throw new Error("SEM_GANG");
  return user.gangId;
}

/** Contexto do Discord da gang da sessão (servidor + configurações). */
export function ctxDiscord(user: SessionUser) {
  return { guildId: user.guildId, gangId: user.gangId };
}

function assert(condition: boolean, message = "Você não tem permissão para esta ação.") {
  if (!condition) throw new Error(message);
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

type LinhaAvatar = { discord_id: string; avatar_hash: string | null };

/**
 * Sincroniza somente o hash do avatar; a imagem nunca é baixada nem armazenada.
 * Se o Discord estiver indisponível, a listagem continua usando o hash salvo.
 */
async function sincronizarAvatarHashes(
  user: SessionUser,
  membros: LinhaAvatar[],
  avataresDiscord?: Map<string, string | null> | null,
): Promise<Map<string, string | null>> {
  const { fetchAvataresDeTodos, fetchUsuarioDiscord } = await import("./discord.server");
  const atuais = avataresDiscord ?? (await fetchAvataresDeTodos(user.guildId));
  const resultado = new Map(membros.map((membro) => [membro.discord_id, membro.avatar_hash]));
  if (!atuais) return resultado;

  const db = getDb();
  await Promise.all(
    membros
      .filter((membro) => atuais.has(membro.discord_id))
      .filter((membro) => membro.avatar_hash !== atuais.get(membro.discord_id))
      .map(async (membro) => {
        const avatarHash = atuais.get(membro.discord_id) ?? null;
        const { error } = await db
          .from("membros")
          .update({ avatar_hash: avatarHash })
          .eq("gang_id", gid(user))
          .eq("discord_id", membro.discord_id);
        if (!error) resultado.set(membro.discord_id, avatarHash);
      }),
  );

  // Para quem já saiu, consulta o usuário global uma vez para migrar hashes antigos
  // que eventualmente tenham sido salvos como avatar específico da guild.
  const foraDaGuild = membros.filter((membro) => !atuais.has(membro.discord_id));
  for (let inicio = 0; inicio < foraDaGuild.length; inicio += 8) {
    const lote = foraDaGuild.slice(inicio, inicio + 8);
    const respostas = await Promise.all(
      lote.map(async (membro) => ({ membro, perfil: await fetchUsuarioDiscord(membro.discord_id) })),
    );
    await Promise.all(
      respostas
        .filter((resposta): resposta is { membro: LinhaAvatar; perfil: NonNullable<typeof resposta.perfil> } => resposta.perfil !== null)
        .filter((resposta) => resposta.membro.avatar_hash !== resposta.perfil.avatarHash)
        .map(async ({ membro, perfil }) => {
          const { error } = await db
            .from("membros")
            .update({ avatar_hash: perfil.avatarHash })
            .eq("gang_id", gid(user))
            .eq("discord_id", membro.discord_id);
          if (!error) resultado.set(membro.discord_id, perfil.avatarHash);
        }),
    );
    for (const { membro, perfil } of respostas) {
      if (perfil !== null) resultado.set(membro.discord_id, perfil.avatarHash);
    }
  }

  for (const membro of membros) {
    if (atuais.has(membro.discord_id)) resultado.set(membro.discord_id, atuais.get(membro.discord_id) ?? null);
  }
  return resultado;
}

function avatarHashAtual(
  mapa: Map<string, string | null>,
  discordId: string,
  salvo: string | null,
): string | null {
  return mapa.has(discordId) ? (mapa.get(discordId) ?? null) : salvo;
}

/* ========== Leitura ========== */

export async function loadMembros(user: SessionUser): Promise<Membro[]> {
  const db = getDb();
  const g = gid(user);

  const membros = unwrap(
    await db
      .from("membros")
      .select(
        "discord_id, discord_username, nome_roblox, nome_rp, genero, altura_jogo, estilo_luta_principal, cargo, status, data_entrada, avatar_hash, divisao_id",
      )
      .eq("gang_id", g)
      .order("data_entrada", { ascending: false }),
  ) as Omit<Membro, "divisao" | "warns" | "stats" | "atributos">[];

  const atributosRows = unwrap(
    await db
      .from("membro_atributos")
      .select(
        "membro_id, movimentacao, parry, reacao, ofensiva, defensiva, nocao_jogo, atualizado_em, atualizado_por",
      )
      .eq("gang_id", g),
  ) as ({
    membro_id: string;
    movimentacao: number;
    parry: number;
    reacao: number;
    ofensiva: number;
    defensiva: number;
    nocao_jogo: number;
    atualizado_em: string | null;
    atualizado_por: string | null;
  })[];
  const atributosPorMembro = new Map(atributosRows.map((a) => [a.membro_id, a]));

  const divisoes = unwrap(
    await db.from("divisoes").select("id, nome_divisao").eq("gang_id", g),
  ) as {
    id: number;
    nome_divisao: string;
  }[];
  const divisaoNome = new Map(divisoes.map((d) => [d.id, d.nome_divisao]));

  const nomesPorId = new Map(
    membros.map((m) => [m.discord_id, m.nome_rp || m.discord_username || m.discord_id]),
  );

  const atributosPadrao = (membroId: string): MembroAtributos => {
    const row = atributosPorMembro.get(membroId);
    return {
      movimentacao: row?.movimentacao ?? 3,
      parry: row?.parry ?? 3,
      reacao: row?.reacao ?? 3,
      ofensiva: row?.ofensiva ?? 3,
      defensiva: row?.defensiva ?? 3,
      nocao_jogo: row?.nocao_jogo ?? 3,
      atualizado_em: row?.atualizado_em ?? null,
      atualizado_por: row?.atualizado_por ?? null,
      atualizado_por_nome: row?.atualizado_por ? nomesPorId.get(row.atualizado_por) ?? row.atualizado_por : null,
    };
  };

  const punicoes = unwrap(
    await db.from("punicoes").select("membro_id, tipo").eq("gang_id", g),
  ) as { membro_id: string; tipo: string }[];
  const warns = new Map<string, number>();
  for (const p of punicoes) {
    if (p.tipo === "Warn") warns.set(p.membro_id, (warns.get(p.membro_id) ?? 0) + 1);
  }

  const presencas = unwrap(
    await db
      .from("presencas_treino")
      .select("membro_id, presenca, treinos!inner(tipo)")
      .eq("presenca", "Presente")
      .eq("gang_id", g),
  ) as { membro_id: string; treinos: { tipo: string } | { tipo: string }[] }[];

  const stats = new Map<string, { internos: number; amistosos: number; guerras: number }>();
  const bucket = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = { internos: 0, amistosos: 0, guerras: 0 };
      stats.set(id, s);
    }
    return s;
  };
  for (const p of presencas) {
    const treino = Array.isArray(p.treinos) ? p.treinos[0] : p.treinos;
    if (!treino) continue;
    const s = bucket(p.membro_id);
    if (treino.tipo === "Amistoso") s.amistosos += 1;
    else if (treino.tipo === "Guerra") s.guerras += 1;
    else s.internos += 1;
  }


  try {
    const guerras = unwrap(
      await db.from("participacoes_guerra").select("membro_id").eq("gang_id", g),
    ) as { membro_id: string }[];
    for (const g of guerras) bucket(g.membro_id).guerras += 1;
  } catch {
    /* tabela opcional */
  }

  // O Discord é a fonte da verdade dos cargos (o banco guarda só o principal).
  const { fetchRolesDeTodos } = await import("./discord.server");
  const { mapaCargos, canonizarCargos } = await import("./cargos.server");
  const { listarCargosPainel } = await import("./cargos-painel.server");
  const [rolesDiscord, mapa, cargosPainel] = await Promise.all([
    fetchRolesDeTodos(user.guildId),
    mapaCargos(g),
    listarCargosPainel(g),
  ]);
  const avataresDiscord = rolesDiscord
    ? new Map([...rolesDiscord.entries()].map(([id, dados]) => [id, dados.avatarHash]))
    : null;
  const avatarHashes = await sincronizarAvatarHashes(user, membros, avataresDiscord);

  return membros.map((m) => ({
    ...m,
    avatar_hash: avatarHashAtual(avatarHashes, m.discord_id, m.avatar_hash),
      cargo: (() => {
        const doDiscord = rolesDiscord?.get(m.discord_id);
        const lista = doDiscord ? canonizarCargos(mapa, doDiscord.ids, doDiscord.nomes) : [];
        return lista.length ? lista.join(", ") : m.cargo;
      })(),
      cargos_painel_ids: (() => {
        const ids = new Set(rolesDiscord?.get(m.discord_id)?.ids ?? []);
        return cargosPainel
          .filter((cargoPainel) => ids.has(cargoPainel.discordRoleId))
          .map((cargoPainel) => cargoPainel.discordRoleId);
      })(),
      cargos_painel: (() => {
        const ids = new Set(rolesDiscord?.get(m.discord_id)?.ids ?? []);
        return cargosPainel
          .filter((cargoPainel) => ids.has(cargoPainel.discordRoleId))
          .map((cargoPainel) => ({
            discordRoleId: cargoPainel.discordRoleId,
            nome: cargoPainel.nome,
          }));
      })(),
      divisao: m.divisao_id != null ? (divisaoNome.get(m.divisao_id) ?? null) : null,
    warns: warns.get(m.discord_id) ?? 0,
    stats: stats.get(m.discord_id) ?? { internos: 0, amistosos: 0, guerras: 0 },
    atributos: atributosPadrao(m.discord_id),
  }));
}

/** Marcador de adiamento guardado no fim da descrição (o banco não tem coluna própria). */
const MARCA_ADIAMENTO = /\n?\[ADIADO\|([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\s*/;

/** Gang aliada de um treino amistoso, guardada na própria descrição. */
const MARCA_ALIADO = /\n?\[ALIADO\|([^\]]*)\]\s*/;

function separarAdiamento(descricao: string | null) {
  if (!descricao) return { descricao: null, adiamento: null, aliado: null };
  const mAdi = descricao.match(MARCA_ADIAMENTO);
  const mAli = descricao.match(MARCA_ALIADO);
  const limpa = descricao.replace(MARCA_ADIAMENTO, "").replace(MARCA_ALIADO, "").trim();
  return {
    descricao: limpa || null,
    adiamento: mAdi
      ? { por: mAdi[1] || null, em: mAdi[2] || null, antes: mAdi[3] || null }
      : null,
    aliado: mAli ? mAli[1] || null : null,
  };
}

export async function loadTreinos(user: SessionUser): Promise<Treino[]> {
  const db = getDb();
  const g = gid(user);
  const treinos = unwrap(
    await db
      .from("treinos")
      .select("*")
      .eq("gang_id", g)
      .order("data_treino", { ascending: false }),
  ) as (Omit<Treino, "inscritos" | "adiamento" | "aliado" | "tipos"> & { tipos?: unknown; tipo?: unknown })[];

  const inscricoes = unwrap(
    await db
      .from("presencas_treino")
      .select("treino_id, inscricao, presenca, justificativa, avaliado_por")
      .eq("gang_id", g),
  ) as {
    treino_id: number;
    inscricao: string | null;
    presenca: string | null;
    justificativa: string | null;
    avaliado_por: string | null;
  }[];

  // A inscrição permanece confirmada no banco mesmo depois de a liderança
  // registrar Presente, Ausente ou Justificado. A justificativa enviada pelo
  // próprio membro e a ausência automática não entram no total de inscritos.
  const contagem = contarInscricoesConfirmadas(inscricoes);

  return treinos.map((t) => {
    const { descricao, adiamento, aliado } = separarAdiamento(t.descricao);
    const tipos = normalizarTiposTreino(t.tipos, t.tipo);
    const categoria = t.tipo === "Amistoso" || t.tipo === "Guerra" ? t.tipo : tipos[0] ?? "Gladiador";
    return {
      ...t,
      tipo: categoria,
      tipos,
      descricao,
      adiamento,
      aliado,
      inscritos: contagem.get(t.id_treino) ?? 0,
    } as Treino;
  });
}



export async function loadDivisoes(user: SessionUser): Promise<Divisao[]> {
  const db = getDb();
  const g = gid(user);
  const divisoes = unwrap(
    await db.from("divisoes").select("*").eq("gang_id", g).order("nome_divisao"),
  ) as Omit<Divisao, "lider_nome" | "lider_discord" | "vice_nome" | "vice_discord" | "membros">[];

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp, avatar_hash, divisao_id")
      .eq("gang_id", g),
  ) as {
    discord_id: string;
    discord_username: string | null;
    nome_rp: string | null;
    avatar_hash: string | null;
    divisao_id: number | null;
  }[];

  const porId = new Map(membros.map((m) => [m.discord_id, m]));
  const avatarHashes = await sincronizarAvatarHashes(user, membros);

  return divisoes.map((d) => {
    const lider = d.lider_id ? porId.get(d.lider_id) : undefined;
    const vice = d.vice_lider_id ? porId.get(d.vice_lider_id) : undefined;
    return {
      ...d,
      lider_nome: lider?.nome_rp ?? null,
      lider_discord: lider?.discord_username ?? null,
      lider_avatar: lider ? avatarHashAtual(avatarHashes, lider.discord_id, lider.avatar_hash) : null,
      vice_nome: vice?.nome_rp ?? null,
      vice_discord: vice?.discord_username ?? null,
      vice_avatar: vice ? avatarHashAtual(avatarHashes, vice.discord_id, vice.avatar_hash) : null,

      membros: membros
        .filter((m) => m.divisao_id === d.id)
        .sort((a, b) => (a.nome_rp ?? "").localeCompare(b.nome_rp ?? ""))
        .map((m) => ({
          discord_id: m.discord_id,
          discord_username: m.discord_username,
          nome_rp: m.nome_rp,
          avatar_hash: avatarHashAtual(avatarHashes, m.discord_id, m.avatar_hash),
        })),
    };
  });
}

export async function loadPresencas(
  user: SessionUser,
  treinoId: number,
): Promise<PresencaTreino[]> {
  const db = getDb();
  const g = gid(user);
  const presencas = unwrap(
    await db
      .from("presencas_treino")
      .select("membro_id, inscricao, presenca, justificativa, justificativa_status, avaliado_por, avaliado_em")
      .eq("gang_id", g)
      .eq("treino_id", treinoId),
  ) as {
    membro_id: string;
    inscricao: string | null;
    presenca: string | null;
    justificativa: string | null;
    justificativa_status: "Nenhuma" | "Pendente" | "Aceita" | "Recusada" | null;
    avaliado_por: string | null;
    avaliado_em: string | null;
  }[];

  if (presencas.length === 0) return [];

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp, avatar_hash, status")
      .eq("gang_id", g)
      .in("discord_id", presencas.map((presenca) => presenca.membro_id)),
  ) as {
    discord_id: string;
    discord_username: string | null;
    nome_rp: string | null;
    avatar_hash: string | null;
    status: string | null;
  }[];

  const porId = new Map(membros.map((membro) => [membro.discord_id, membro]));
  const avatarHashes = await sincronizarAvatarHashes(user, membros);
  return presencas.flatMap((p) => {
      const m = porId.get(p.membro_id);
      if (!m) return [];
      return {
        membro_id: p.membro_id,
        discord_username: m.discord_username,
        nome_rp: m.nome_rp,
        avatar_hash: avatarHashAtual(avatarHashes, m.discord_id, m.avatar_hash),
        inscricao: p.inscricao,
        presenca: p.presenca ?? "Pendente",
        justificativa: p.justificativa,
        justificativa_status: p.justificativa_status ?? "Nenhuma",
        avaliado_por: p.avaliado_por,
        avaliado_em: p.avaliado_em,
      };
    });
}

export async function loadHistorico(
  user: SessionUser,
  membroId: string,
): Promise<Punicao[]> {
  const db = getDb();
  const g = gid(user);
  const punicoes = unwrap(
    await db.from("punicoes").select("*").eq("gang_id", g).eq("membro_id", membroId),
  ) as Punicao[];

  const autores = Array.from(
    new Set(punicoes.map((p) => p.staff_id).filter(Boolean) as string[]),
  );
  if (autores.length === 0) return punicoes.map((p) => ({ ...p, staff_nome: null }));

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp")
      .eq("gang_id", g)
      .in("discord_id", autores),
  ) as { discord_id: string; discord_username: string | null; nome_rp: string | null }[];
  const porId = new Map(membros.map((m) => [m.discord_id, m]));

  return punicoes.map((p) => {
    const autor = p.staff_id ? porId.get(p.staff_id) : undefined;
    return {
      ...p,
      staff_nome: autor?.nome_rp || autor?.discord_username || p.staff_id || null,
    };
  });
}

export async function revogarPunicao(user: SessionUser, input: { punicaoId: number }) {
  assert(podeRevogarPunicao(user), "Você não pode remover registros de punição.");
  const db = getDb();
  const g = gid(user);
  const { data: punicao, error: erroPunicao } = await db
    .from("punicoes")
    .select("membro_id, tipo")
    .eq("gang_id", g)
    .eq("id_punicao", input.punicaoId)
    .maybeSingle();
  if (erroPunicao) throw new Error(erroPunicao.message);
  if (!punicao) return { ok: true };
  const { error } = await db
    .from("punicoes")
    .delete()
    .eq("gang_id", g)
    .eq("id_punicao", input.punicaoId);
  if (error) throw new Error(error.message);

  if ((punicao as { membro_id: string; tipo: string }).tipo === "Ban") {
    const { data: outrosBans, error: erroBans } = await db
      .from("punicoes")
      .select("id_punicao")
      .eq("gang_id", g)
      .eq("membro_id", (punicao as { membro_id: string }).membro_id)
      .eq("tipo", "Ban");
    if (erroBans) throw new Error(erroBans.message);
    if (!outrosBans?.length) {
      const { error: erroStatus } = await db
        .from("membros")
        .update({ status: "Ativo" })
        .eq("gang_id", g)
        .eq("discord_id", (punicao as { membro_id: string }).membro_id);
      if (erroStatus) throw new Error(erroStatus.message);
    }
  }
  return { ok: true };
}

/** Dados extras da aliança guardados no fim de `observacoes` (o banco não tem colunas próprias). */
const MARCA_ALIANCA = /\n?\[ALIANCA\|([^\]]*)\]\s*$/;

function montarMarcaAlianca(campos: {
  icon_hash: string | null;
  representante_id: string | null;
  representante_nome: string | null;
  representante_avatar: string | null;
  fechado_por: string | null;
  fechado_por_nome: string | null;
  relacao: string | null;
}): string {
  const limpar = (v: string | null) => (v ?? "").replace(/[|\]\n]/g, " ").trim();
  return `[ALIANCA|${[
    campos.icon_hash,
    campos.representante_id,
    campos.representante_nome,
    campos.representante_avatar,
    campos.fechado_por,
    campos.fechado_por_nome,
    campos.relacao,
  ]
    .map(limpar)
    .join("|")}]`;
}

function separarAlianca(observacoes: string | null) {
  const vazio = {
    icon_hash: null as string | null,
    representante_id: null as string | null,
    representante_nome: null as string | null,
    representante_avatar: null as string | null,
    fechado_por: null as string | null,
    fechado_por_nome: null as string | null,
    relacao: null as string | null,
  };
  if (!observacoes) return { observacoes: null, extras: vazio };
  const m = observacoes.match(MARCA_ALIANCA);
  if (!m) return { observacoes, extras: vazio };
  const [icon, repId, repNome, repAvatar, fechadoPor, fechadoNome, relacao] = (m[1] ?? "").split(
    "|",
  );
  const limpa = observacoes.replace(MARCA_ALIANCA, "").trim();
  return {
    observacoes: limpa || null,
    extras: {
      icon_hash: icon || null,
      representante_id: repId || null,
      representante_nome: repNome || null,
      representante_avatar: repAvatar || null,
      fechado_por: fechadoPor || null,
      fechado_por_nome: fechadoNome || null,
      relacao: relacao || null,
    },
  };
}

/** A tabela legada pode usar outro nome de chave primária (ex.: id_parceria). */
let idParceriasCache: string | null = null;
export async function colunaIdParcerias(): Promise<string> {
  if (idParceriasCache) return idParceriasCache;
  const db = getDb();
  const { data } = await db.from("parcerias").select("*").limit(1);
  const linha = (data ?? [])[0] as Record<string, unknown> | undefined;
  const chaves = linha ? Object.keys(linha) : [];
  idParceriasCache =
    chaves.find((c) => c === "id") ??
    chaves.find((c) => /^id[_-]?/i.test(c) || /[_-]id$/i.test(c)) ??
    "id";
  return idParceriasCache;
}

export async function loadParcerias(
  user: SessionUser,
): Promise<{ parcerias: Parceria[]; tabelaAusente: boolean }> {
  const db = getDb();
  const { data, error } = await db
    .from("parcerias")
    .select("*")
    .eq("gang_id", gid(user))
    .order("nome");
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    const ausente =
      code === "42P01" ||
      code === "PGRST205" ||
      /relation .* does not exist/i.test(msg) ||
      /Could not find the .* column of .* in the schema cache/i.test(msg);
    if (ausente) return { parcerias: [], tabelaAusente: true };
    throw new Error(`${msg}${code ? ` (${code})` : ""}`);
  }
  const linhas = (data ?? []) as (Omit<
    Parceria,
    | "icon_hash"
    | "representante_id"
    | "representante_nome"
    | "representante_avatar"
    | "fechado_por"
    | "fechado_por_nome"
    | "relacao"
  > &
    Partial<Parceria>)[];

  const colunaId = await colunaIdParcerias();
  const parcerias = linhas.map((row) => {
    const { observacoes, extras } = separarAlianca(row.observacoes ?? null);
    return {
      ...row,
      id: (row as unknown as Record<string, number>)[colunaId] ?? row.id,
      observacoes,
      icon_hash: row.icon_hash ?? extras.icon_hash,
      representante_id: row.representante_id ?? extras.representante_id,
      representante_nome: row.representante_nome ?? extras.representante_nome,
      representante_avatar: row.representante_avatar ?? extras.representante_avatar,
      fechado_por: row.fechado_por ?? extras.fechado_por,
      fechado_por_nome: row.fechado_por_nome ?? extras.fechado_por_nome,
      relacao:
        ((row as Partial<Parceria>).relacao as string | undefined) || extras.relacao || "Aliada",
    } as Parceria;
  });

  return { parcerias, tabelaAusente: false };
}

/** Resolve convite do servidor aliado + perfil do representante pelo ID. */
export async function resolverAliado(
  user: SessionUser,
  input: { convite: string; representanteId: string },
): Promise<AliadoResolvido> {
  assert(temPermissao(user, "alianca_criar", "alianca_editar", "gerenciar_parcerias") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"), "Você não possui permissão para resolver dados da aliança.");
  const { resolverConvite, fetchUsuarioDiscord } = await import("./discord.server");

  const convite = input.convite.trim() ? await resolverConvite(input.convite) : null;
  const rep = input.representanteId.trim()
    ? await fetchUsuarioDiscord(input.representanteId)
    : null;

  return {
    guild: convite ? { id: convite.guildId, nome: convite.nome ?? "", iconHash: convite.iconHash } : null,
    representante: rep
      ? { id: rep.id, nome: rep.globalName || rep.username, avatarHash: rep.avatarHash }
      : null,
  };
}


/* ========== Escrita: membros ========== */

export type MembroDiscordParaCadastro = {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  nick: string | null;
  jaCadastrado: boolean;
};

/** Pesquisa integrantes da guild atual. Apenas a liderança pode iniciar cadastros. */
export async function buscarMembrosDiscord(
  user: SessionUser,
  busca: string,
): Promise<MembroDiscordParaCadastro[]> {
  assert(podeAdicionarMembro(user), "Você não possui a permissão Adicionar Membro ao Painel.");
  const termo = (busca ?? "").trim();
  if (termo.length < 2) throw new Error("Digite pelo menos 2 caracteres para pesquisar.");
  const { buscarMembrosServidor } = await import("./discord.server");
  const encontrados = await buscarMembrosServidor(user.guildId, termo);
  const { data, error } = await getDb()
    .from("membros")
    .select("discord_id")
    .eq("gang_id", gid(user))
    .in("discord_id", encontrados.map((membro) => membro.id));
  if (error) throw new Error(error.message);
  const cadastrados = new Set(((data ?? []) as { discord_id: string }[]).map((membro) => membro.discord_id));
  return encontrados.map((membro) => ({ ...membro, jaCadastrado: cadastrados.has(membro.id) }));
}

/**
 * Inclui um integrante real da guild no painel e aproveita sua ficha RPG global,
 * quando ela já existir. A liderança nunca recebe permissão para editar a ficha.
 */
export async function cadastrarMembroDiscord(user: SessionUser, input: { discordId: string }) {
  assert(podeAdicionarMembro(user), "Você não possui a permissão Adicionar Membro ao Painel.");
  const discordId = (input.discordId ?? "").trim().replace(/\D/g, "");
  assert(/^\d{17,20}$/.test(discordId), "Usuário Discord inválido.");
  const g = gid(user);
  const { buscarMembrosServidor, ajustarCargoDiscord } = await import("./discord.server");
  const alvo = (await buscarMembrosServidor(user.guildId, discordId)).find((membro) => membro.id === discordId);
  if (!alvo) throw new Error("Esse usuário não pertence ao servidor Discord desta gang.");

  const db = getDb();
  const { data: existente, error: erroExistente } = await db
    .from("membros")
    .select("discord_id")
    .eq("gang_id", g)
    .eq("discord_id", discordId)
    .maybeSingle();
  if (erroExistente) throw new Error(erroExistente.message);
  assert(!existente, "Esse usuário já está cadastrado nesta gang.");

  const ficha = await buscarFichaRPG(discordId);
  const { error: erroCadastro } = await db.from("membros").insert({
    gang_id: g,
    discord_id: alvo.id,
    discord_username: alvo.username,
    avatar_hash: alvo.avatarHash,
    nome_roblox: ficha.nome_roblox,
    nome_rp: ficha.nome_rp,
    genero: ficha.genero,
    altura_jogo: ficha.altura_jogo,
    estilo_luta_principal: ficha.estilo_luta_principal,
    cargo: "Membro",
    status: "Ativo",
    data_entrada: new Date().toISOString(),
  });
  if (erroCadastro) throw new Error(erroCadastro.message);

  // Mantém o registro de painel e o acesso por cargo coerentes. Caso o bot não
  // possua essa permissão, o cadastro continua salvo e a configuração pode ser revista.
  await ajustarCargoDiscord(alvo.id, "Membro", "add", ctxDiscord(user));
  return { ok: true, membro: alvo };
}

function nivelCargo(cargo: string | null | undefined): number {
  const indice = CARGOS_PERMITIDOS.indexOf(cargo as (typeof CARGOS_PERMITIDOS)[number]);
  return indice < 0 ? CARGOS_PERMITIDOS.length + 1 : indice;
}

async function podePunirAlvo(user: SessionUser, membroId: string, tipo: string): Promise<boolean> {
  if (tipo === "Warn") return podeAplicarWarn(user);
  if (tipo === "Ban") return podeAplicarBan(user);
  return false;
}

export async function advertirMembro(
  user: SessionUser,
  input: { membroId: string; tipo: string; motivo: string },
) {
  const tipo = input.tipo.trim();
  assert(tipo === "Warn" || tipo === "Ban", "Somente Warn ou Ban podem ser aplicados nesta tela.");
  assert(await podePunirAlvo(user, input.membroId, tipo), "Você não possui permissão para aplicar este tipo de punição.");
  const db = getDb();
  const g = gid(user);
  const { data: alvo, error: erroAlvo } = await db
    .from("membros")
    .select("cargo, status")
    .eq("gang_id", g)
    .eq("discord_id", input.membroId)
    .maybeSingle();
  if (erroAlvo) throw new Error(erroAlvo.message);
  assert(!!alvo, "Este usuário não está cadastrado nesta gang.");
  if (tipo === "Ban") {
    const cargoAlvo = (alvo as { cargo?: string | null }).cargo?.split(",")[0]?.trim() ?? null;
    const cargoAtor = CARGOS_PERMITIDOS.find((cargo) => temCargo(user, cargo)) ?? null;
    assert(user.isSuperOwner || nivelCargo(cargoAtor) < nivelCargo(cargoAlvo), "Somente um cargo superior pode banir este membro.");
  }

  const base = {
    membro_id: input.membroId,
    tipo,
    motivo: input.motivo?.trim() || null,
    gang_id: g,
  };

  // A autoria é gravada em staff_id (nome usado pelo bot); recua se a coluna não existir.
  const { error } = await db.from("punicoes").insert({ ...base, staff_id: user.id });
  if (error) {
    if (!/staff_id/i.test(error.message)) throw new Error(error.message);
    const { error: err2 } = await db.from("punicoes").insert(base);
    if (err2) throw new Error(err2.message);
  }

  if (tipo === "Ban") {
    const { error: erroBan } = await db
      .from("membros")
      .update({ status: "Banido" })
      .eq("gang_id", g)
      .eq("discord_id", input.membroId);
    if (erroBan) throw new Error(erroBan.message);
  }

  await anunciarPunicao(db, user, { ...input, tipo });
  return { ok: true };
}

/** Publica a advertência no canal configurado. */
async function anunciarPunicao(
  db: ReturnType<typeof getDb>,
  user: SessionUser,
  input: { membroId: string; tipo: string; motivo: string },
) {
  const { data } = await db
    .from("membros")
    .select("nome_rp, discord_username")
    .eq("gang_id", gid(user))
    .eq("discord_id", input.membroId)
    .maybeSingle();
  const alvo = (data as { nome_rp: string | null; discord_username: string | null } | null) ?? null;
  const nome = alvo?.nome_rp || alvo?.discord_username || input.membroId;
  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_advertencias", ctxDiscord(user), {
    title: `⚠️ ${input.tipo} aplicado`,
    description: `<@${input.membroId}>`,
    fields: [
      { name: "Membro", value: nome, inline: true },
      { name: "Tipo", value: input.tipo, inline: true },
      { name: "Motivo", value: input.motivo || "Não informado" },
      {
        name: "Aplicado por",
        value: user.nomeRp || user.globalName || user.username,
      },
    ],
    timestamp: new Date().toISOString(),
  });
}


async function validarHierarquiaCargo(user: SessionUser, membroId: string, novosCargos: string[]) {
  if (user.isSuperOwner || user.isOwner) return;
  const db = getDb();
  const { data: alvo, error } = await db
    .from("membros")
    .select("cargo")
    .eq("gang_id", gid(user))
    .eq("discord_id", membroId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  assert(!!alvo, "Este usuário não está cadastrado nesta gang.");
  const cargoAtor = CARGOS_PERMITIDOS.find((cargo) => temCargo(user, cargo));
  const nivelAtor = nivelCargo(cargoAtor);
  const cargosAlvo = String((alvo as { cargo?: string | null }).cargo ?? "")
    .split(",").map((cargo) => cargo.trim()).filter(Boolean);
  assert(cargosAlvo.every((cargo) => nivelCargo(cargo) > nivelAtor), "Você não pode alterar o cargo de alguém com posição igual ou superior à sua.");
  assert(novosCargos.every((cargo) => nivelCargo(cargo) > nivelAtor), "Você só pode atribuir cargos abaixo da sua posição.");
}

export async function trocarCargo(
  user: SessionUser,
  input: { membroId: string; cargos: string[] },
) {
  assert(podeAlterarCargo(user), "Você não possui a permissão Alterar Cargo.");
  const permitidos = cargosAtribuiveis(user);
  const novos = Array.from(new Set(input.cargos.filter(Boolean)));
  assert(
    novos.every((c) => permitidos.includes(c)),
    "Você não pode atribuir este cargo.",
  );
  await validarHierarquiaCargo(user, input.membroId, novos);

  const db = getDb();
  const g = gid(user);
  const { fetchRolesAtuais } = await import("./discord.server");
  const { mapaCargos, canonizarCargos } = await import("./cargos.server");
  const [doDiscord, mapa] = await Promise.all([
    fetchRolesAtuais(input.membroId, user.guildId),
    mapaCargos(g),
  ]);

  const antigos = doDiscord ? canonizarCargos(mapa, doDiscord.ids, doDiscord.nomes) : [];

  // Cargos de liderança de divisão só mudam pela tela de divisões: preserva-os.
  const preservados = antigos.filter((c) => CARGOS_DIVISAO.includes(c));
  const finais = Array.from(new Set([...preservados, ...novos]));

  // A coluna `cargo` é curta (varchar 30): guarda só o principal.
  const { error } = await db
    .from("membros")
    .update({ cargo: finais.length ? cargoPrimario(finais) : "" })
    .eq("gang_id", g)
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);

  // Sincroniza com o Discord (adiciona os novos, remove os retirados).
  // Só mexe nos cargos do painel — nunca nos de liderança de divisão.
  const { ajustarCargoPorId, ajustarCargoDiscord } = await import("./discord.server");
  for (const cargo of permitidos) {
    if (CARGOS_DIVISAO.includes(cargo)) continue;
    const tinha = antigos.includes(cargo);
    const tem = finais.includes(cargo);
    if (tinha === tem) continue;
    const roleId = mapa.porCargo.get(cargo);
    if (roleId) {
      await ajustarCargoPorId(input.membroId, roleId, tem ? "add" : "remove", user.guildId);
    } else {
      await ajustarCargoDiscord(input.membroId, cargo, tem ? "add" : "remove", ctxDiscord(user));
    }
  }

  return { ok: true };
}

/**
 * Atribui ou remove um cargo personalizado diretamente no Discord. Esses cargos
 * continuam fora da coluna curta `membros.cargo`, reservada à hierarquia legada.
 */
export async function alterarCargoPainelMembro(
  user: SessionUser,
  input: { membroId: string; cargoPainelId: number; ativo: boolean },
) {
  assert(podeAlterarCargo(user), "Você não possui a permissão Alterar Cargo.");
  const g = gid(user);
  const membroId = (input.membroId ?? "").replace(/\D/g, "");
  await validarHierarquiaCargo(user, membroId, []);
  assert(/^\d{17,20}$/.test(membroId), "Membro inválido.");
  assert(Number.isInteger(input.cargoPainelId) && input.cargoPainelId > 0, "Cargo personalizado inválido.");

  const db = getDb();
  const { data: membro, error: erroMembro } = await db
    .from("membros")
    .select("discord_id")
    .eq("gang_id", g)
    .eq("discord_id", membroId)
    .maybeSingle();
  if (erroMembro) throw new Error(erroMembro.message);
  assert(!!membro, "Este usuário não está cadastrado nesta gang.");

  const { listarCargosPainel } = await import("./cargos-painel.server");
  const cargoPainel = (await listarCargosPainel(g)).find((cargo) => cargo.id === input.cargoPainelId);
  if (!cargoPainel) {
    throw new Error("Cargo personalizado não encontrado nesta gang.");
  }

  const { ajustarCargoPorId, fetchRolesAtuais } = await import("./discord.server");
  const atuais = await fetchRolesAtuais(membroId, user.guildId);
  if (!atuais) throw new Error("Não foi possível confirmar os cargos atuais deste usuário no Discord.");
  const jaPossui = atuais.ids.includes(cargoPainel.discordRoleId);
  if (jaPossui !== input.ativo) {
    await ajustarCargoPorId(
      membroId,
      cargoPainel.discordRoleId,
      input.ativo ? "add" : "remove",
      user.guildId,
    );
  }
  return { ok: true };
}

export async function alterarStatusMembro(
  user: SessionUser,
  input: { membroId: string; status: string },
) {
  assert(podeGerenciarMembros(user));
  assert(["Ativo", "Inativo", "Afastado", "Em Analise"].includes(input.status), "Status inválido.");
  const db = getDb();
  const { data: atual, error: erroAtual } = await db
    .from("membros")
    .select("status")
    .eq("gang_id", gid(user))
    .eq("discord_id", input.membroId)
    .maybeSingle();
  if (erroAtual) throw new Error(erroAtual.message);
  assert((atual as { status?: string | null } | null)?.status !== "Banido", "O Ban só pode ser removido pelo botão Revogar banimento.");
  const { error } = await db
    .from("membros")
    .update({ status: input.status })
    .eq("gang_id", gid(user))
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removerMembro(user: SessionUser, input: { membroId: string }) {
  assert(podeGerenciarMembros(user));
  const db = getDb();
  const g = gid(user);
  const id = input.membroId;

  // Libera vínculos de liderança em divisões
  const { data: divs } = await db
    .from("divisoes")
    .select("id, lider_id, vice_lider_id")
    .eq("gang_id", g);
  for (const d of (divs ?? []) as {
    id: number;
    lider_id: string | null;
    vice_lider_id: string | null;
  }[]) {
    if (d.lider_id !== id && d.vice_lider_id !== id) continue;
    await db
      .from("divisoes")
      .update({
        lider_id: d.lider_id === id ? null : d.lider_id,
        vice_lider_id: d.vice_lider_id === id ? null : d.vice_lider_id,
      })
      .eq("gang_id", g)
      .eq("id", d.id);
  }

  await encerrarHistoricoDeMembro(g, id);

  // Remove registros dependentes (evita violação de chave estrangeira)
  const dependentes: [string, string[]][] = [
    ["membro_atributos", ["membro_id"]],
    ["historico_atributos_membro", ["membro_id"]],
    ["presencas_treino", ["membro_id"]],
    ["participacoes_guerra", ["membro_id"]],
    ["punicoes", ["membro_id", "staff_id"]],
    ["avaliacoes_treino", ["membro_avaliado_id", "avaliador_id"]],
    ["avaliacoes_lideranca", ["lider_avaliado_id", "avaliador_id"]],
    ["votos_recrutamento", ["candidato_id", "recrutador_id"]],
  ];
  for (const [tabela, colunas] of dependentes) {
    for (const coluna of colunas) {
      const { error } = await db.from(tabela).delete().eq("gang_id", g).eq(coluna, id);
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        throw new Error(`${tabela}: ${error.message}`);
      }
    }
  }

  const { error } = await db
    .from("membros")
    .delete()
    .eq("gang_id", g)
    .eq("discord_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}


/* ========== Escrita: treinos ========== */

export async function criarTreino(
  user: SessionUser,
  input: {
    titulo: string;
    descricao: string;
    data_treino: string;
    horario: string;
    tipos: string[];
    local: string;
    link_servidor_privado?: string;
    divisao_responsavel: string;
    aliado?: string;
  },
) {
  assert(podeAgendarTreino(user), "Você não possui a permissão Treino: agendar.");
  const tipos = normalizarTiposTreino(input.tipos);
  assert(tipos.length > 0, "Selecione ao menos um tipo de treino.");
  const db = getDb();
  const { mapaCargos } = await import("./cargos.server");
  const roleIdMembro = (await mapaCargos(gid(user))).porCargo.get("Membro");
  if (!roleIdMembro) {
    throw new Error("Configure o ID Discord do cargo Membro antes de criar um treino.");
  }
  const linkServidorPrivado = normalizarLinkEvento(
    input.link_servidor_privado,
    "O link do servidor privado Roblox",
  );
  const descricao = input.descricao.trim() || null;

  const { error } = await db.from("treinos").insert({
    titulo: input.titulo,
    descricao,
    data_treino: input.data_treino,
    horario: input.horario || null,
    tipo: "Treino",
    tipos,
    local: input.local || null,
    link_servidor_privado: linkServidorPrivado,
    divisao_responsavel: input.divisao_responsavel || null,
    status: "Aberto",
    criado_por: user.id,
    gang_id: gid(user),
  });
  if (error) throw new Error(error.message);

  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_treinos", ctxDiscord(user), {
    content: `<@&${roleIdMembro}>\nAcesse https://hakuryu.lovable.app para mais informações e para se inscrever no treino.`,
    allowedRoleIds: [roleIdMembro],
    title: `🐉 Novo treino: ${input.titulo}`,
    description: input.descricao?.trim() || undefined,
    fields: [
      { name: "Data", value: input.data_treino, inline: true },
      { name: "Horário", value: input.horario || "A definir", inline: true },
      { name: "Tipo", value: tipos.join(", "), inline: true },
      { name: "Local", value: input.local || "A definir", inline: true },
      ...(linkServidorPrivado
        ? [{ name: "Servidor privado Roblox", value: linkServidorPrivado }]
        : []),
      { name: "Divisão", value: input.divisao_responsavel || "Geral", inline: true },
      {
        name: "Criado por",
        value: user.nomeRp || user.globalName || user.username,
      },
    ],
    timestamp: new Date().toISOString(),
  });
  return { ok: true };
}



/** Apenas o criador controla presença, adiamento e encerramento; exclusão usa a permissão própria. */
async function requireDonoTreino(user: SessionUser, treinoId: number, exigirCriador = true) {
  const db = getDb();
  const { data, error } = await db
    .from("treinos")
    .select("id_treino, descricao, data_treino, horario, criado_por, status")
    .eq("gang_id", gid(user))
    .eq("id_treino", treinoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Treino não encontrado.");
  if (exigirCriador && data.criado_por !== user.id) {
    throw new Error("Apenas quem criou o treino pode gerenciá-lo.");
  }
  return data as {
    id_treino: number;
    descricao: string | null;
    data_treino: string;
    horario: string | null;
    criado_por: string | null;
    status: string | null;
  };
}

export async function deletarTreino(user: SessionUser, input: { treinoId: number }) {
  assert(podeDeletarTreino(user), "Você não possui a permissão Treino: deletar.");
  await requireDonoTreino(user, input.treinoId, false);
  const db = getDb();
  const { error } = await db
    .from("treinos")
    .delete()
    .eq("gang_id", gid(user))
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function encerrarTreino(user: SessionUser, input: { treinoId: number }) {
  assert(podeGerenciarTreino(user), "Você não possui a permissão Treino: gerenciar.");
  await requireDonoTreino(user, input.treinoId);
  const db = getDb();
  const g = gid(user);

  // Todo membro ativo elegível que não respondeu fica registrado como ausente.
  // ignoreDuplicates preserva respostas e avaliações existentes.
  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, status")
      .eq("gang_id", g),
  ) as { discord_id: string; status: string | null }[];
  const ausenciasAutomaticas = membros
    .filter((m) => !m.status || m.status === "Ativo")
    .map((m) => ({
      treino_id: input.treinoId,
      membro_id: m.discord_id,
      gang_id: g,
      inscricao: "Confirmado",
      presenca: "Ausente",
      justificativa: null,
      justificativa_status: "Nenhuma",
    }));

  if (ausenciasAutomaticas.length > 0) {
    const { error: erroAusencias } = await db
      .from("presencas_treino")
      .upsert(ausenciasAutomaticas, {
        onConflict: "treino_id,membro_id",
        ignoreDuplicates: true,
      });
    if (erroAusencias) throw new Error(erroAusencias.message);
  }

  const { error } = await db
    .from("treinos")
    .update({ status: "Encerrado" })
    .eq("gang_id", g)
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function reabrirTreino(user: SessionUser, input: { treinoId: number }) {
  assert(user.isSuperOwner, "Apenas o Super Owner pode reabrir um evento encerrado.");
  const db = getDb();
  const { error } = await db
    .from("treinos")
    .update({ status: "Aberto" })
    .eq("gang_id", gid(user))
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adiarTreino(
  user: SessionUser,
  input: { treinoId: number; data_treino: string; horario: string },
) {
  assert(podeGerenciarTreino(user), "Você não possui a permissão Treino: gerenciar.");
  const treino = await requireDonoTreino(user, input.treinoId);
  const db = getDb();
  const antes = `${treino.data_treino}${treino.horario ? ` ${treino.horario}` : ""}`;
  const limpa = (treino.descricao ?? "").replace(MARCA_ADIAMENTO, "").trim();
  const marca = `[ADIADO|${user.id}|${new Date().toISOString()}|${antes}]`;
  const { error } = await db
    .from("treinos")
    .update({
      data_treino: input.data_treino,
      horario: input.horario || null,
      descricao: `${limpa ? `${limpa}\n` : ""}${marca}`,
    })
    .eq("gang_id", gid(user))
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function idDoMembroNaGang(user: SessionUser): Promise<string> {
  const { data, error } = await getDb()
    .from("membros")
    .select("discord_id")
    .eq("gang_id", gid(user))
    .eq("discord_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  assert(!!data, "Você precisa estar cadastrado como membro desta gang para responder ao evento.");
  return String((data as { discord_id: string }).discord_id);
}

export async function inscreverSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();
  const g = gid(user);
  const membroId = await idDoMembroNaGang(user);
  const { data: treino } = await db
    .from("treinos")
    .select("status")
    .eq("gang_id", g)
    .eq("id_treino", input.treinoId)
    .maybeSingle();
  if (treino && treino.status && treino.status !== "Aberto") {
    throw new Error("Este treino não está mais aberto para inscrições.");
  }


  // Sem depender de constraint única: verifica e então atualiza ou insere.
  const { data: existente, error: errSel } = await db
    .from("presencas_treino")
    .select("membro_id")
    .eq("gang_id", g)
    .eq("treino_id", input.treinoId)
    .eq("membro_id", membroId)
    .maybeSingle();
  if (errSel) throw new Error(errSel.message);

  if (existente) {
    const { error } = await db
      .from("presencas_treino")
      .update({
        inscricao: "Confirmado",
        presenca: "Pendente",
        justificativa: null,
        justificativa_status: "Nenhuma",
        avaliado_por: null,
        avaliado_em: null,
      })
      .eq("gang_id", g)
      .eq("treino_id", input.treinoId)
      .eq("membro_id", membroId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  const { error } = await db.from("presencas_treino").insert({
    treino_id: input.treinoId,
    membro_id: membroId,
    inscricao: "Confirmado",
    presenca: "Pendente",
    justificativa: null,
    justificativa_status: "Nenhuma",
    gang_id: g,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function ausentarSe(
  user: SessionUser,
  input: { treinoId: number; justificativa: string },
) {
  const motivo = input.justificativa.trim();
  if (motivo.length < 3) {
    throw new Error("Explique o motivo da ausência antes de enviar a justificativa.");
  }
  const db = getDb();
  const g = gid(user);
  const membroId = await idDoMembroNaGang(user);
  const { data: treino, error: erroTreino } = await db
    .from("treinos")
    .select("status")
    .eq("gang_id", g)
    .eq("id_treino", input.treinoId)
    .maybeSingle();
  if (erroTreino) throw new Error(erroTreino.message);
  if (!treino || (treino.status && treino.status !== "Aberto")) {
    throw new Error("Este evento não aceita mais justificativas.");
  }

  const { error } = await db
    .from("presencas_treino")
    .upsert(
      {
        treino_id: input.treinoId,
        membro_id: membroId,
        gang_id: g,
        inscricao: "Confirmado",
        presenca: "Pendente",
        justificativa: motivo,
        justificativa_status: "Pendente",
        avaliado_por: null,
        avaliado_em: null,
      },
      { onConflict: "treino_id,membro_id" },
    );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function atualizarPresenca(
  user: SessionUser,
  input: { treinoId: number; membroId: string; presenca: string },
) {
  assert(podeGerenciarTreino(user), "Você não possui a permissão Treino: gerenciar.");
  const treino = await requireDonoTreino(user, input.treinoId);
  if (treino.status === "Encerrado" || treino.status === "Cancelado") {
    throw new Error("O evento está encerrado. Apenas o Super Owner pode reabri-lo.");
  }
  const db = getDb();
  const g = gid(user);
  const { data: atual, error: erroAtual } = await db
    .from("presencas_treino")
    .select("inscricao, justificativa, justificativa_status")
    .eq("gang_id", g)
    .eq("treino_id", input.treinoId)
    .eq("membro_id", input.membroId)
    .maybeSingle();
  if (erroAtual) throw new Error(erroAtual.message);
  const registroAtual = atual as {
    inscricao?: string | null;
    justificativa?: string | null;
  } | null;
  const justificativa = registroAtual?.justificativa ?? null;
  if (input.presenca === "Justificado" && !justificativa) {
    throw new Error("Só é possível justificar uma ausência que tenha um motivo enviado pelo membro.");
  }
  const justificativaStatus =
    input.presenca === "Justificado"
      ? "Aceita"
      : justificativa
        ? input.presenca === "Ausente"
          ? "Recusada"
          : "Pendente"
        : "Nenhuma";
  const { error } = await db
    .from("presencas_treino")
    .upsert(
      {
        treino_id: input.treinoId,
        membro_id: input.membroId,
        gang_id: g,
        inscricao: "Confirmado",
        presenca: input.presenca,
        justificativa,
        justificativa_status: justificativaStatus,
        avaliado_por: user.id,
        avaliado_em: new Date().toISOString(),
      },
      { onConflict: "treino_id,membro_id" },
    );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export type MinhaRespostaEvento = {
  inscricao: string | null;
  presenca: string | null;
  justificativa: string | null;
  justificativa_status: "Nenhuma" | "Pendente" | "Aceita" | "Recusada" | null;
};

export async function minhaInscricao(
  user: SessionUser,
  input: { treinoId: number },
): Promise<MinhaRespostaEvento> {
  const db = getDb();
  const membroId = await idDoMembroNaGang(user);
  const { data, error } = await db
    .from("presencas_treino")
    .select("inscricao, presenca, justificativa, justificativa_status")
    .eq("gang_id", gid(user))
    .eq("treino_id", input.treinoId)
    .eq("membro_id", membroId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const resposta = data as MinhaRespostaEvento | null;
  return {
    inscricao: resposta?.inscricao ?? null,
    presenca: resposta?.presenca ?? null,
    justificativa: resposta?.justificativa ?? null,
    justificativa_status: resposta?.justificativa_status ?? null,
  };
}

/* ========== Atividade e inatividade ========== */

const CONFIG_INATIVIDADE_PADRAO: ConfigInatividade = {
  dias_limite: 30,
  percentual_minimo: 50,
  alerta_ativo: true,
};

export type FiltroAtividade = {
  membroId?: string | null;
  inicio?: string | null;
  fim?: string | null;
  tipoEvento?: string | null;
};

export async function loadConfigInatividade(user: SessionUser): Promise<ConfigInatividade> {
  const { data, error } = await getDb()
    .from("config_inatividade")
    .select("dias_limite, percentual_minimo, alerta_ativo")
    .eq("gang_id", gid(user))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return CONFIG_INATIVIDADE_PADRAO;
  return {
    dias_limite: data.dias_limite ?? CONFIG_INATIVIDADE_PADRAO.dias_limite,
    percentual_minimo: data.percentual_minimo ?? CONFIG_INATIVIDADE_PADRAO.percentual_minimo,
    alerta_ativo: data.alerta_ativo ?? CONFIG_INATIVIDADE_PADRAO.alerta_ativo,
  };
}

export async function salvarConfigInatividade(
  user: SessionUser,
  input: ConfigInatividade,
) {
  assert(podeConfigurarInatividade(user), "Você não possui a permissão Configurações: alerta de inatividade.");
  const dias = Math.trunc(Number(input.dias_limite));
  const percentual = Math.trunc(Number(input.percentual_minimo));
  if (dias < 7 || dias > 365) throw new Error("O limite de inatividade deve estar entre 7 e 365 dias.");
  if (percentual < 0 || percentual > 100) throw new Error("O percentual mínimo deve estar entre 0% e 100%.");

  const { error } = await getDb().from("config_inatividade").upsert(
    {
      gang_id: gid(user),
      dias_limite: dias,
      percentual_minimo: percentual,
      alerta_ativo: !!input.alerta_ativo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "gang_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function loadAtividade(user: SessionUser, filtro: FiltroAtividade) {
  const db = getDb();
  const g = gid(user);
  let consulta = db
    .from("presencas_treino")
    .select(
      "treino_id, membro_id, presenca, justificativa, justificativa_status, avaliado_por, avaliado_em, treinos!inner(titulo, tipo, tipos, data_treino, status)",
    )
    .eq("gang_id", g);
  if (filtro.membroId) consulta = consulta.eq("membro_id", filtro.membroId);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp, avatar_hash, status")
      .eq("gang_id", g),
  ) as {
    discord_id: string;
    discord_username: string | null;
    nome_rp: string | null;
    avatar_hash: string | null;
    status: string | null;
  }[];
  const porMembro = new Map(membros.map((m) => [m.discord_id, m]));
  const avatarHashes = await sincronizarAvatarHashes(user, membros);

  const registros = ((data ?? []) as {
    treino_id: number;
    membro_id: string;
    presenca: string | null;
    justificativa: string | null;
    justificativa_status: "Nenhuma" | "Pendente" | "Aceita" | "Recusada" | null;
    avaliado_por: string | null;
    avaliado_em: string | null;
    treinos: { titulo: string; tipo: string; data_treino: string; status: string | null } | {
      titulo: string;
      tipo: string;
      data_treino: string;
      status: string | null;
    }[];
  }[])
    .map((linha) => {
      const evento = Array.isArray(linha.treinos) ? linha.treinos[0] : linha.treinos;
      const membro = porMembro.get(linha.membro_id);
      return {
        id: linha.treino_id,
        treino_id: linha.treino_id,
        membro_id: linha.membro_id,
        titulo_evento: evento?.titulo ?? "Evento removido",
        tipo_evento: evento?.tipo === "Amistoso" || evento?.tipo === "Guerra" ? evento.tipo : "Treino",
        // A atividade deve refletir quando o evento ocorreu, não quando a presença foi avaliada ou registrada.
        data_evento: normalizarDataEvento(evento?.data_treino),
        status: (linha.presenca ?? "Pendente") as RegistroAtividade["status"],
        justificativa: linha.justificativa,
        justificativa_status: linha.justificativa_status ?? "Nenhuma",
        avaliado_por: linha.avaliado_por,
        avaliado_em: linha.avaliado_em,
        discord_username: membro?.discord_username ?? null,
        nome_rp: membro?.nome_rp ?? null,
        avatar_hash: membro ? avatarHashAtual(avatarHashes, membro.discord_id, membro.avatar_hash) : null,
        encerrado: evento?.status === "Encerrado",
      };
    })
    .filter((r) => r.encerrado)
    .filter((r) => !filtro.inicio || r.data_evento >= filtro.inicio)
    .filter((r) => !filtro.fim || r.data_evento <= filtro.fim)
    .filter((r) => !filtro.tipoEvento || r.tipo_evento === filtro.tipoEvento)
    .map(({ encerrado: _encerrado, ...registro }) => registro as RegistroAtividade)
    .sort((a, b) => b.data_evento.localeCompare(a.data_evento));

  const config = await loadConfigInatividade(user);
  const limite = new Date();
  limite.setDate(limite.getDate() - config.dias_limite);
  const limiteIso = limite.toISOString().slice(0, 10);
  const agrupados = new Map<string, RegistroAtividade[]>();
  for (const registro of registros) {
    agrupados.set(registro.membro_id, [...(agrupados.get(registro.membro_id) ?? []), registro]);
  }

  const resumos = membros
    .filter((m) => !m.status || m.status === "Ativo")
    .filter((m) => !filtro.membroId || m.discord_id === filtro.membroId)
    .map<ResumoAtividade>((membro) => {
      const itens = agrupados.get(membro.discord_id) ?? [];
      const presente = itens.filter((i) => i.status === "Presente").length;
      const ausente = itens.filter((i) => i.status === "Ausente").length;
      const justificado = itens.filter((i) => i.status === "Justificado").length;
      const pendente = itens.filter((i) => i.status === "Pendente").length;
      const total = itens.length;
      const percentual = total > 0 ? Math.round(((presente + justificado) / total) * 100) : 0;
      const recentes = itens.filter((i) => i.data_evento >= limiteIso);
      const semPresencaRecente = recentes.length > 0 && !recentes.some(
        (i) => i.status === "Presente" || i.status === "Justificado",
      );
      return {
        membro_id: membro.discord_id,
        discord_username: membro.discord_username,
        nome_rp: membro.nome_rp,
        avatar_hash: avatarHashAtual(avatarHashes, membro.discord_id, membro.avatar_hash),
        presente,
        ausente,
        justificado,
        pendente,
        total,
        percentual_presenca: percentual,
        inativo: config.alerta_ativo && recentes.length > 0 && (
          semPresencaRecente || percentual < config.percentual_minimo
        ),
      };
    })
    .sort((a, b) => Number(b.inativo) - Number(a.inativo) || a.nome_rp?.localeCompare(b.nome_rp ?? "") || 0);

  return { registros, resumos, config };
}

/* ========== Escrita: divisões ========== */

type LiderancaDivisao = {
  id: number;
  lider_id: string | null;
  vice_lider_id: string | null;
  logo_url: string | null;
};

async function carregarLideranca(
  user: SessionUser,
  divisaoId: number,
): Promise<LiderancaDivisao> {
  const db = getDb();
  const { data, error } = await db
    .from("divisoes")
    .select("id, lider_id, vice_lider_id, logo_url")
    .eq("gang_id", gid(user))
    .eq("id", divisaoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Divisão não encontrada.");
  return data as LiderancaDivisao;
}

export const CARGO_LIDER_DIVISAO = "Líder de Divisão";
export const CARGO_VICE_LIDER_DIVISAO = "Vice-Líder de Divisão";

/** Divisão à qual o usuário pertence (tabela membros). */
async function divisaoDoUsuario(gangId: number, discordId: string): Promise<number | null> {
  const db = getDb();
  const { data } = await db
    .from("membros")
    .select("divisao_id")
    .eq("gang_id", gangId)
    .eq("discord_id", discordId)
    .maybeSingle();
  return (data as { divisao_id: number | null } | null)?.divisao_id ?? null;
}

/** Cúpula da gang ou liderança da própria divisão. */
async function podeGerirDivisao(user: SessionUser, divisao: LiderancaDivisao): Promise<boolean> {
  if (podeCriarDivisao(user) || temPermissao(user, "divisao_gerenciar_lider", "divisao_gerenciar_vice", "divisao_gerenciar_membro", "divisao_definir_vice", "divisao_definir_membros")) return true;
  if (user.id === divisao.lider_id || user.id === divisao.vice_lider_id) return true;
  if (temCargo(user, CARGO_LIDER_DIVISAO) || temCargo(user, CARGO_VICE_LIDER_DIVISAO)) {
    return (await divisaoDoUsuario(gid(user), user.id)) === divisao.id;
  }
  return false;
}

/** ID do cargo do Discord associado a uma divisão. */
async function roleIdDaDivisao(gangId: number, divisaoId: number | null): Promise<string | null> {
  if (divisaoId == null) return null;
  const db = getDb();
  const { data } = await db
    .from("divisoes")
    .select("discord_role_id")
    .eq("gang_id", gangId)
    .eq("id", divisaoId)
    .maybeSingle();
  const id = (data as { discord_role_id: string | null } | null)?.discord_role_id ?? null;
  return id ? id.replace(/\D/g, "") || null : null;
}

/**
 * Aplica o cargo do Discord da divisão de destino e remove o da divisão anterior.
 * Vale para líder, vice e membros comuns.
 */
async function trocarCargoDivisaoDiscord(
  user: SessionUser,
  membroId: string,
  antiga: number | null,
  nova: number | null,
) {
  if (antiga === nova) return;
  const g = gid(user);
  const { ajustarCargoPorId } = await import("./discord.server");
  const [roleAntigo, roleNovo] = await Promise.all([
    roleIdDaDivisao(g, antiga),
    roleIdDaDivisao(g, nova),
  ]);
  if (roleAntigo && roleAntigo !== roleNovo) {
    await ajustarCargoPorId(membroId, roleAntigo, "remove", user.guildId);
  }
  if (roleNovo) await ajustarCargoPorId(membroId, roleNovo, "add", user.guildId);
}


export async function criarDivisao(
  user: SessionUser,
  input: {
    nome_divisao: string;
    logo_url: string;
    discord_role_id: string;
    funcao_principal: string;
  },
) {
  assert(podeCriarDivisao(user), "Apenas Líder e Vice-Líder podem criar divisões.");
  const db = getDb();
  const { error } = await db.from("divisoes").insert({
    nome_divisao: input.nome_divisao,
    logo_url: input.logo_url || null,
    discord_role_id: input.discord_role_id || null,
    funcao_principal: input.funcao_principal || null,
    gang_id: gid(user),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function atualizarDivisao(
  user: SessionUser,
  input: {
    divisaoId: number;
    liderId: string | null;
    viceLiderId: string | null;
    novosMembros: string[];
    logoUrl?: string | null;
  },
) {
  const g = gid(user);
  const divisao = await carregarLideranca(user, input.divisaoId);
  assert(await podeGerirDivisao(user, divisao), "Você não gerencia esta divisão.");
  const db = getDb();

  // Líder/vice da própria divisão não trocam o líder; só a cúpula faz isso.
  const podeAlterarLider = podeCriarDivisao(user) || temPermissao(user, "divisao_gerenciar_lider");
  const liderId = podeAlterarLider ? input.liderId : divisao.lider_id;
  const liderDaPropriaDivisao = user.id === divisao.lider_id ||
    (temCargo(user, CARGO_LIDER_DIVISAO) && (await divisaoDoUsuario(gid(user), user.id)) === divisao.id);
  const podeDefinirVice = podeAlterarLider || liderDaPropriaDivisao || temPermissao(user, "divisao_gerenciar_vice", "divisao_definir_vice");
  const viceLiderId = podeDefinirVice ? input.viceLiderId : divisao.vice_lider_id;
  const podeDefinirMembros = podeCriarDivisao(user) || temPermissao(user, "divisao_gerenciar_membro", "divisao_definir_membros") || user.id === divisao.lider_id || user.id === divisao.vice_lider_id;
  const membrosSolicitados = podeDefinirMembros ? input.novosMembros : [];

  const logoUrl = input.logoUrl === undefined ? undefined : input.logoUrl?.trim() || null;
  const { error } = await db
    .from("divisoes")
    .update({
      lider_id: liderId,
      vice_lider_id: viceLiderId,
      ...(logoUrl === undefined ? {} : { logo_url: logoUrl }),
    })
    .eq("gang_id", g)
    .eq("id", input.divisaoId);
  if (error) throw new Error(error.message);
  if (logoUrl !== undefined && logoUrl !== divisao.logo_url) {
    const { deletarImagemR2PorUrl } = await import("./r2.server");
    await deletarImagemR2PorUrl(divisao.logo_url);
  }

  const entrando = Array.from(
    new Set([
      ...(liderId ? [liderId] : []),
      ...(viceLiderId ? [viceLiderId] : []),
      ...membrosSolicitados,
    ]),
  );
  if (entrando.length > 0) {
    // Guarda a divisão anterior de cada um para trocar o cargo no Discord.
    const { data: antesData } = await db
      .from("membros")
      .select("discord_id, divisao_id")
      .eq("gang_id", g)
      .in("discord_id", entrando);
    const anteriores = new Map(
      ((antesData ?? []) as { discord_id: string; divisao_id: number | null }[]).map((m) => [
        m.discord_id,
        m.divisao_id,
      ]),
    );

    const { error: err2 } = await db
      .from("membros")
      .update({ divisao_id: input.divisaoId })
      .eq("gang_id", g)
      .in("discord_id", entrando);
    if (err2) throw new Error(err2.message);

    for (const id of entrando) {
      await trocarCargoDivisaoDiscord(user, id, anteriores.get(id) ?? null, input.divisaoId);
    }
  }

  // Quem deixou a liderança e não faz mais parte da divisão perde o cargo dela.
  for (const antigo of [divisao.lider_id, divisao.vice_lider_id]) {
    if (!antigo || entrando.includes(antigo)) continue;
    if ((await divisaoDoUsuario(gid(user), antigo)) !== input.divisaoId) {
      await trocarCargoDivisaoDiscord(user, antigo, input.divisaoId, null);
    }
  }

  await sincronizarCargosLideranca(db, user, divisao, liderId, viceLiderId);
  return { ok: true };
}


/** Aplica/retira o cargo (Discord + tabela membros) de líder e vice da divisão. */
async function sincronizarCargosLideranca(
  db: ReturnType<typeof getDb>,
  user: SessionUser,
  antes: LiderancaDivisao,
  liderId: string | null,
  viceLiderId: string | null,
) {
  const g = gid(user);
  const { ajustarCargoDiscord } = await import("./discord.server");

  const pares: { antigo: string | null; novo: string | null; cargo: string }[] = [
    { antigo: antes.lider_id, novo: liderId, cargo: CARGO_LIDER_DIVISAO },
    { antigo: antes.vice_lider_id, novo: viceLiderId, cargo: CARGO_VICE_LIDER_DIVISAO },
  ];

  const lerCargos = async (id: string): Promise<string[]> => {
    const { data } = await db
      .from("membros")
      .select("cargo")
      .eq("gang_id", g)
      .eq("discord_id", id)
      .maybeSingle();
    return ((data as { cargo: string | null } | null)?.cargo ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  };
  const gravar = async (id: string, cargos: string[]) => {
    await db
      .from("membros")
      .update({ cargo: cargoPrimario(cargos.length ? cargos : ["Membro"]) })
      .eq("gang_id", g)
      .eq("discord_id", id);
  };

  for (const { antigo, novo, cargo } of pares) {
    if (antigo === novo) continue;
    if (antigo) {
      await ajustarCargoDiscord(antigo, cargo, "remove", ctxDiscord(user));
      await gravar(antigo, (await lerCargos(antigo)).filter((c) => c !== cargo));
    }
    if (novo) {
      await ajustarCargoDiscord(novo, cargo, "add", ctxDiscord(user));
      const atuais = await lerCargos(novo);
      await gravar(novo, atuais.includes(cargo) ? atuais : [...atuais, cargo]);
    }
  }
}


export async function removerMembroDivisao(
  user: SessionUser,
  input: { membroId: string },
) {
  assert(temPermissao(user, "divisao_gerenciar_membro", "divisao_definir_membros") || temCargo(user, CARGO_LIDER_DIVISAO) || temCargo(user, CARGO_VICE_LIDER_DIVISAO) || podeCriarDivisao(user), "Você não possui permissão para definir membros da divisão.");
  const db = getDb();
  const g = gid(user);
  const { data: membro, error: errMembro } = await db
    .from("membros")
    .select("divisao_id")
    .eq("gang_id", g)
    .eq("discord_id", input.membroId)
    .maybeSingle();
  if (errMembro) throw new Error(errMembro.message);
  const divisaoId = (membro as { divisao_id: number | null } | null)?.divisao_id ?? null;
  if (divisaoId == null) return { ok: true };
  assert(
    await podeGerirDivisao(user, await carregarLideranca(user, divisaoId)),
    "Você não gerencia esta divisão.",
  );
  const lideranca = await carregarLideranca(user, divisaoId);
  const novoLider = lideranca.lider_id === input.membroId ? null : lideranca.lider_id;
  const novoVice = lideranca.vice_lider_id === input.membroId ? null : lideranca.vice_lider_id;
  if (novoLider !== lideranca.lider_id || novoVice !== lideranca.vice_lider_id) {
    await db
      .from("divisoes")
      .update({ lider_id: novoLider, vice_lider_id: novoVice })
      .eq("gang_id", g)
      .eq("id", divisaoId);
    await sincronizarCargosLideranca(db, user, lideranca, novoLider, novoVice);
  }

  const { error } = await db
    .from("membros")
    .update({ divisao_id: null })
    .eq("gang_id", g)
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
  await trocarCargoDivisaoDiscord(user, input.membroId, divisaoId, null);
  return { ok: true };
}

export async function deletarDivisao(user: SessionUser, input: { divisaoId: number }) {
  assert(temPermissao(user, "divisao_deletar") || podeCriarDivisao(user), "Você não possui a permissão Divisão: deletar.");
  const db = getDb();
  const g = gid(user);
  // Liderança perde o cargo de capitão junto com a divisão.
  const lideranca = await carregarLideranca(user, input.divisaoId);
  await sincronizarCargosLideranca(db, user, lideranca, null, null);

  // Todos os integrantes perdem o cargo do Discord da divisão.
  const { data: integrantes } = await db
    .from("membros")
    .select("discord_id")
    .eq("gang_id", g)
    .eq("divisao_id", input.divisaoId);
  for (const m of (integrantes ?? []) as { discord_id: string }[]) {
    await trocarCargoDivisaoDiscord(user, m.discord_id, input.divisaoId, null);
  }

  await db
    .from("membros")
    .update({ divisao_id: null })
    .eq("gang_id", g)
    .eq("divisao_id", input.divisaoId);
  const { error } = await db
    .from("divisoes")
    .delete()
    .eq("gang_id", g)
    .eq("id", input.divisaoId);
  if (error) throw new Error(error.message);
  const { deletarImagemR2PorUrl } = await import("./r2.server");
  await deletarImagemR2PorUrl(lideranca.logo_url);
  return { ok: true };
}


/* ========== Escrita: alianças ========== */

export async function salvarParceria(
  user: SessionUser,
  input: {
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
    relacao?: string;
  },
) {
  assert(
    input.id == null
      ? temPermissao(user, "alianca_criar", "gerenciar_parcerias") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider")
      : temPermissao(user, "alianca_editar", "gerenciar_parcerias") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"),
    input.id == null ? "Você não possui a permissão Alianças: criar." : "Você não possui a permissão Alianças: editar.",
  );
  const db = getDb();
  const g = gid(user);
  const colunaId = await colunaIdParcerias();
  const linhasExistentes = unwrap(
    await db
      .from("parcerias")
      .select("*")
      .eq("gang_id", g),
  ) as unknown as ({ nome: string | null; tag: string | null; link_servidor: string | null } & Record<string, unknown>)[];
  const duplicada = encontrarParceriaDuplicada(
    linhasExistentes.map((linha) => ({
      id: Number(linha[colunaId]),
      nome: linha.nome,
      tag: linha.tag,
      link_servidor: linha.link_servidor,
    })),
    input,
  );
  if (duplicada) {
    throw new Error(`Já existe uma aliança cadastrada para “${duplicada.nome ?? "este servidor"}”. Edite o registro existente.`);
  }

  // Quem fechou é mantido no registro original ao editar.
  let fechadoPor = user.id;
  let fechadoNome = user.nomeRp || user.globalName || user.username;
  if (input.id != null) {
    const { data } = await db
      .from("parcerias")
      .select("observacoes")
      .eq("gang_id", g)
      .eq(colunaId, input.id)
      .maybeSingle();
    const antigo = separarAlianca((data as { observacoes: string | null } | null)?.observacoes ?? null);
    if (antigo.extras.fechado_por) {
      fechadoPor = antigo.extras.fechado_por;
      fechadoNome = antigo.extras.fechado_por_nome ?? fechadoPor;
    }
  }

  const marca = montarMarcaAlianca({
    icon_hash: input.icon_hash || null,
    representante_id: input.representante_id || null,
    representante_nome: input.representante_nome || null,
    representante_avatar: input.representante_avatar || null,
    fechado_por: fechadoPor,
    fechado_por_nome: fechadoNome,
    relacao: input.relacao === "Inimiga" ? "Inimiga" : "Aliada",
  });
  const obs = `${input.observacoes ? `${input.observacoes.trim()}\n` : ""}${marca}`;

  const payload = {
    nome: input.nome,
    tag: input.tag || null,
    contato: input.contato || null,
    status: input.status,
    link_servidor: input.link_servidor || null,
    observacoes: obs,
    data_inicio: input.data_inicio || new Date().toISOString().slice(0, 10),
  };
  const query =
    input.id == null
      ? db.from("parcerias").insert({ ...payload, gang_id: g })
      : db.from("parcerias").update(payload).eq("gang_id", g).eq(colunaId, input.id);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (input.id == null) {
    const { enviarMensagemCanal } = await import("./discord.server");
    await enviarMensagemCanal("canal_aliancas", ctxDiscord(user), {
      title:
        input.relacao === "Inimiga"
          ? `⚔️ Nova gang inimiga: ${input.nome}`
          : `🤝 Nova aliança: ${input.nome}`,
      description: input.observacoes?.trim() || undefined,
      fields: [
        ...(input.tag ? [{ name: "Tag", value: input.tag, inline: true }] : []),
        { name: "Status", value: input.status, inline: true },
        ...(input.representante_id
          ? [
              {
                name: "Representante",
                value: `${input.representante_nome || ""} <@${input.representante_id}>`.trim(),
                inline: true,
              },
            ]
          : []),
        ...(input.link_servidor
          ? [{ name: "Servidor", value: input.link_servidor }]
          : []),
        ...(input.contato ? [{ name: "Contato", value: input.contato }] : []),
        { name: "Fechada por", value: fechadoNome },
      ],
      timestamp: new Date().toISOString(),
    });
  }
  return { ok: true };
}



export async function deletarParceria(user: SessionUser, input: { id: number }) {
  assert(temPermissao(user, "alianca_deletar", "gerenciar_parcerias") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"), "Você não possui a permissão Alianças: deletar.");
  const db = getDb();
  const coluna = await colunaIdParcerias();
  const { error } = await db
    .from("parcerias")
    .delete()
    .eq("gang_id", gid(user))
    .eq(coluna, input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ========== Atributos de combate ========== */

const CHAVES_ATRIBUTOS = [
  "movimentacao",
  "parry",
  "reacao",
  "ofensiva",
  "defensiva",
  "nocao_jogo",
] as const;

type ChaveAtributo = (typeof CHAVES_ATRIBUTOS)[number];

function validarAtributos(valores: AtributosMembroValores) {
  for (const chave of CHAVES_ATRIBUTOS) {
    const valor = Number(valores[chave]);
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw new Error(`O atributo ${chave} deve estar entre 1 e 5.`);
    }
  }
}

async function podeEditarAtributosMembro(user: SessionUser, membroId: string): Promise<boolean> {
  if (podeGerenciarMembros(user) || user.permissoes.includes("avaliar_atributos")) return true;

  const db = getDb();
  const g = gid(user);
  const { data: alvo, error: alvoError } = await db
    .from("membros")
    .select("divisao_id")
    .eq("gang_id", g)
    .eq("discord_id", membroId)
    .maybeSingle();
  if (alvoError) throw new Error(alvoError.message);
  if (!alvo?.divisao_id) return false;

  const { data: divisao, error: divisaoError } = await db
    .from("divisoes")
    .select("lider_id, vice_lider_id")
    .eq("gang_id", g)
    .eq("id", alvo.divisao_id)
    .maybeSingle();
  if (divisaoError) throw new Error(divisaoError.message);

  const lidera = temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lidera && (divisao?.lider_id === user.id || divisao?.vice_lider_id === user.id);
}

export async function salvarAtributosMembro(
  user: SessionUser,
  input: { membroId: string; valores: AtributosMembroValores },
) {
  assert(await podeEditarAtributosMembro(user, input.membroId), "Você não pode avaliar este membro.");
  validarAtributos(input.valores);

  const db = getDb();
  const valores = Object.fromEntries(
    CHAVES_ATRIBUTOS.map((chave) => [chave, Number(input.valores[chave])]),
  ) as Record<ChaveAtributo, number>;

  const { error: upsertError } = await db.from("membro_atributos").upsert(
    {
      membro_id: input.membroId,
      gang_id: gid(user),
      ...valores,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.id,
    },
    { onConflict: "membro_id,gang_id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  const { error: historicoError } = await db.from("historico_atributos_membro").insert({
    membro_id: input.membroId,
    gang_id: gid(user),
    ...valores,
    avaliado_por: user.id,
  });
  if (historicoError) throw new Error(historicoError.message);

  return { ok: true };
}

export async function loadHistoricoAtributos(
  user: SessionUser,
  membroId: string,
): Promise<HistoricoAtributosMembro[]> {
  const db = getDb();
  const g = gid(user);
  if (membroId !== user.id) {
    assert(await podeEditarAtributosMembro(user, membroId), "Você não pode ver este histórico.");
  }

  const rows = unwrap(
    await db
      .from("historico_atributos_membro")
      .select(
        "id, membro_id, movimentacao, parry, reacao, ofensiva, defensiva, nocao_jogo, avaliado_em, avaliado_por",
      )
      .eq("gang_id", g)
      .eq("membro_id", membroId)
      .order("avaliado_em", { ascending: false }),
  ) as Omit<HistoricoAtributosMembro, "avaliado_por_nome">[];

  const autores = Array.from(new Set(rows.map((r) => r.avaliado_por).filter(Boolean) as string[]));
  if (autores.length === 0) return rows.map((r) => ({ ...r, avaliado_por_nome: null }));

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, nome_rp, discord_username")
      .eq("gang_id", g)
      .in("discord_id", autores),
  ) as { discord_id: string; nome_rp: string | null; discord_username: string | null }[];
  const porId = new Map(membros.map((m) => [m.discord_id, m]));

  return rows.map((row) => {
    const autor = row.avaliado_por ? porId.get(row.avaliado_por) : undefined;
    return {
      ...row,
      avaliado_por_nome: autor?.nome_rp || autor?.discord_username || row.avaliado_por || null,
    };
  });
}

/* ========== Dados pessoais do membro ========== */

/** Somente o Super Owner edita a ficha global diretamente a partir do painel. */
export async function atualizarDadosMembro(
  user: SessionUser,
  input: { membroId: string } & FichaRPGInput,
) {
  assert(podeEditarFichaRPG(user), "Você não possui a permissão para editar a ficha RPG pelo painel.");
  const alvo = (input.membroId ?? "").trim().replace(/\D/g, "");
  assert(/^\d{17,20}$/.test(alvo), "Membro inválido.");

  const ficha = normalizarFichaRPG(input);
  const db = getDb();
  const { data: membroAtual, error: erroMembro } = await db
    .from("membros")
    .select("discord_username")
    .eq("gang_id", gid(user))
    .eq("discord_id", alvo)
    .maybeSingle();
  if (erroMembro) throw new Error(erroMembro.message);
  assert(!!membroAtual, "Este usuário não está cadastrado na gang ativa.");

  const { error: erroPerfil } = await db.from("perfis_jogador").upsert(
    {
      discord_id: alvo,
      discord_username: (membroAtual as { discord_username?: string | null }).discord_username ?? null,
      ...ficha,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "discord_id" },
  );
  if (erroPerfil) throw new Error(erroPerfil.message);

  // A ficha é global: o mesmo jogador pode estar em várias gangs.
  const { error: erroMembros } = await db
    .from("membros")
    .update(ficha)
    .eq("discord_id", alvo);
  if (erroMembros) throw new Error(erroMembros.message);
  return { ok: true, ficha };
}

/* ========== Configurações do painel ========== */

export async function loadConfiguracoesPainel(user: SessionUser) {
  assert(
    podeConfigurarCargos(user) || podeConfigurarCanais(user) || podeConfigurarInatividade(user),
    "Você não possui permissão para acessar as configurações.",
  );
  const { loadConfiguracoes } = await import("./settings.server");
  const configuracoes = await loadConfiguracoes([...CARGOS_PERMITIDOS], gid(user));
  if (!user.isSuperOwner) delete configuracoes.canais["canal_divulgacao"];
  return configuracoes;
}

export async function salvarConfiguracoesPainel(
  user: SessionUser,
  input: {
    cargos: Record<string, string>;
    canais: Record<string, string>;
    owners: string;
    guildId: string;
  },
  ) {
  assert(podeConfigurarCargos(user) || podeConfigurarCanais(user), "Você não possui permissão para alterar estas configurações.");
  if (!user.isSuperOwner && Object.hasOwn(input.canais, "canal_divulgacao")) {
    throw new Error("Somente o Super Owner pode alterar o canal de divulgação global.");
  }
  const { salvarConfiguracoesDaGang, chaveCargo } = await import("./settings.server");
  const valores: Record<string, string> = {};
  if (podeConfigurarCargos(user)) {
    valores["owner_ids"] = input.owners;
    valores["guild_id"] = input.guildId;
    for (const [nome, id] of Object.entries(input.cargos)) valores[chaveCargo(nome)] = id;
  }
  if (podeConfigurarCanais(user)) {
    for (const [chave, id] of Object.entries(input.canais)) {
      if (chave === "canal_divulgacao" && !user.isSuperOwner) continue;
      valores[chave] = id;
    }
  }
  await salvarConfiguracoesDaGang(gid(user), valores);
  return { ok: true };
}

export async function loadCargosPainelPersonalizados(user: SessionUser) {
  assert(
    podeConfigurarCargos(user) || podeAlterarCargo(user),
    "Você não possui permissão para consultar cargos personalizados.",
  );
  const { listarCargosPainel } = await import("./cargos-painel.server");
  return listarCargosPainel(gid(user));
}

export async function salvarCargoPainelPersonalizado(
  user: SessionUser,
  input: { id?: number | null; nome: string; discordRoleId: string; permissoes: string[]; cargosAtribuiveis?: string[] },
) {
  assert(
    podeConfigurarCargos(user),
    "Você não possui a permissão Configurações: criar cargos.",
  );
  const { salvarCargoPainel } = await import("./cargos-painel.server");
  return salvarCargoPainel(gid(user), input);
}

export async function excluirCargoPainelPersonalizado(user: SessionUser, id: number) {
  assert(
    podeConfigurarCargos(user),
    "Você não possui a permissão Configurações: criar cargos.",
  );
  const { excluirCargoPainel } = await import("./cargos-painel.server");
  await excluirCargoPainel(gid(user), id);
  return { ok: true };
}

// ==================== Logs de partidas ====================

function tabelaLogsAusente(msg: string, code?: string) {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .*logs_partidas.* does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg)
  );
}

export async function loadLogs(
  user: SessionUser,
): Promise<{ logs: LogPartida[]; tabelaAusente: boolean }> {
  const db = getDb();
  const { data, error } = await db
    .from("logs_partidas")
    .select("*")
    .eq("gang_id", gid(user))
    .order("data_partida", { ascending: false });
  if (error) {
    if (tabelaLogsAusente(error.message, error.code)) return { logs: [], tabelaAusente: true };
    throw new Error(error.message);
  }
  const logs = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row["id"] ?? 0),
    tipo: String(row["tipo"] ?? "Amistoso"),
    adversario_id: row["adversario_id"] == null ? null : Number(row["adversario_id"]),
    adversario_nome: String(row["adversario_nome"] ?? "—"),
    adversario_guild_id: (row["adversario_guild_id"] as string | null) ?? null,
    adversario_icon_hash: (row["adversario_icon_hash"] as string | null) ?? null,
    pontos_nos: Number(row["pontos_nos"] ?? 0),
    pontos_eles: Number(row["pontos_eles"] ?? 0),
    data_partida: (row["data_partida"] as string | null) ?? null,
    link_servidor_privado: (row["link_servidor_privado"] as string | null) ?? null,
    observacoes: (row["observacoes"] as string | null) ?? null,
    criado_por: (row["criado_por"] as string | null) ?? null,
    criado_por_nome: (row["criado_por_nome"] as string | null) ?? null,
  })) satisfies LogPartida[];
  return { logs, tabelaAusente: false };
}

export async function salvarLog(
  user: SessionUser,
  input: {
    tipo: string;
    adversario_id: number | null;
    adversario_nome: string;
    adversario_guild_id: string | null;
    adversario_icon_hash: string | null;
    pontos_nos: number;
    pontos_eles: number;
    data_partida: string;
    link_servidor_privado?: string;
    observacoes: string;
  },
) {
  assert(podeCriarLog(user), "Você não possui a permissão Logs: criar.");
  const db = getDb();
  const autor = user.nomeRp || user.globalName || user.username;
  const linkServidorPrivado = normalizarLinkEvento(
    input.link_servidor_privado,
    "O link do servidor privado Roblox",
  );
  const { error } = await db.from("logs_partidas").insert({
    tipo: input.tipo,
    adversario_id: input.adversario_id,
    adversario_nome: input.adversario_nome,
    adversario_guild_id: input.adversario_guild_id,
    adversario_icon_hash: input.adversario_icon_hash,
    pontos_nos: input.pontos_nos,
    pontos_eles: input.pontos_eles,
    data_partida: input.data_partida || new Date().toISOString().slice(0, 10),
    link_servidor_privado: linkServidorPrivado,
    observacoes: input.observacoes.trim() || null,
    criado_por: user.id,
    criado_por_nome: autor,
    gang_id: gid(user),
  });
  if (error) {
    if (tabelaLogsAusente(error.message, error.code)) {
      throw new Error(
        "A tabela `logs_partidas` não existe no banco. Rode o script schema_hakuryu.sql para criá-la.",
      );
    }
    throw new Error(error.message);
  }

  const resultado =
    input.pontos_nos > input.pontos_eles
      ? "Vitória"
      : input.pontos_nos < input.pontos_eles
        ? "Derrota"
        : "Empate";
  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_treinos", ctxDiscord(user), {
    title: `${input.tipo === "Guerra" ? "⚔️" : "🤝"} ${input.tipo}: ${input.pontos_nos} x ${input.pontos_eles} — ${input.adversario_nome}`,
    description: input.observacoes.trim() || undefined,
    fields: [
      { name: "Resultado", value: resultado, inline: true },
      { name: "Registrado por", value: autor, inline: true },
      ...(linkServidorPrivado
        ? [{ name: "Servidor privado Roblox", value: linkServidorPrivado }]
        : []),
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function deletarLog(user: SessionUser, id: number) {
  assert(podeDeletarLog(user), "Você não possui a permissão Logs: deletar.");
  const db = getDb();
  const { error } = await db
    .from("logs_partidas")
    .delete()
    .eq("gang_id", gid(user))
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function guildAtualInfo(user: SessionUser): Promise<GuildAtual> {
  const { fetchGuildInfo } = await import("./discord.server");
  return await fetchGuildInfo(user.guildId ?? undefined);
}
