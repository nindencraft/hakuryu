import { getDb, currentUser } from "./db.server";
import {
  cargosAtribuiveis,
  podeAcessar,
  podeAdvertir,
  podeCriarDivisao,
  podeGerenciarMembros,
  podeRevogarPunicao,
  podeGerenciarParcerias,
  podeGerenciarTreinos,
  temCargo,
  CARGOS_DIVISAO,
  CARGOS_PERMITIDOS,
  type SessionUser,
} from "./session.server";
import { cargoPrimario } from "./permissions";
import type {
  AliadoResolvido,
  Divisao,
  GuildAtual,
  LogPartida,
  Membro,
  MembroAtributos,
  HistoricoAtributosMembro,
  AtributosMembroValores,
  Parceria,
  PresencaTreino,
  Punicao,
  Treino,
} from "./types";


/* ========== Sessão / guardas ========== */

export async function requireUserSemGang(request: Request): Promise<SessionUser> {
  const user = await currentUser(request);
  if (!user) throw new Error("NAO_AUTENTICADO");
  // Revalida os cargos direto no Discord (a sessão pode estar defasada).
  const { fetchCargosAtuais } = await import("./discord.server");
  const cargosAtuais = await fetchCargosAtuais(user.id, user.guildId);
  if (cargosAtuais) user.roles = cargosAtuais;
  // Dono é recalculado a cada requisição no escopo da gang ativa:
  // ser dono de uma gang NÃO dá poder em outra.
  const { ehDono, ehSuperOwner } = await import("./settings.server");
  user.isSuperOwner = ehSuperOwner(user.id);
  user.isOwner = user.isSuperOwner || (await ehDono(user.id, user.gangId));
  // Líder registrado da gang sempre tem o cargo "Lider" no painel.
  if (user.gangId != null && !temCargo(user, "Lider")) {
    const { buscarGangPorId } = await import("./gangs.server");
    const gang = await buscarGangPorId(user.gangId);
    if (gang?.lider_id && gang.lider_id === user.id) user.roles = [...user.roles, "Lider"];
  }
  // Sem gang escolhida o painel manda o usuário para /selecionar-gang.
  if (user.gangId == null) return user;
  if (!podeAcessar(user)) throw new Error("SEM_PERMISSAO");
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
  const { fetchCargosDeTodos } = await import("./discord.server");
  const cargosDiscord = await fetchCargosDeTodos(user.guildId);
  const canonizar = (nomes: string[]) => {
    const norm = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const set = new Set(nomes.map(norm));
    return CARGOS_PERMITIDOS.filter((c) => set.has(norm(c)));
  };

  return membros.map((m) => ({
    ...m,
    cargo: (() => {
      const doDiscord = cargosDiscord?.get(m.discord_id);
      const lista = doDiscord ? canonizar(doDiscord) : [];
      return lista.length ? lista.join(", ") : m.cargo;
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
  ) as Omit<Treino, "inscritos" | "adiamento" | "aliado">[];

  const inscricoes = unwrap(
    await db.from("presencas_treino").select("treino_id, inscricao").eq("gang_id", g),
  ) as { treino_id: number; inscricao: string | null }[];

  const contagem = new Map<number, number>();
  for (const i of inscricoes) {
    if (i.inscricao === "Confirmado") {
      contagem.set(i.treino_id, (contagem.get(i.treino_id) ?? 0) + 1);
    }
  }

  return treinos.map((t) => {
    const { descricao, adiamento, aliado } = separarAdiamento(t.descricao);
    return { ...t, descricao, adiamento, aliado, inscritos: contagem.get(t.id_treino) ?? 0 };
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

  return divisoes.map((d) => {
    const lider = d.lider_id ? porId.get(d.lider_id) : undefined;
    const vice = d.vice_lider_id ? porId.get(d.vice_lider_id) : undefined;
    return {
      ...d,
      lider_nome: lider?.nome_rp ?? null,
      lider_discord: lider?.discord_username ?? null,
      lider_avatar: lider?.avatar_hash ?? null,
      vice_nome: vice?.nome_rp ?? null,
      vice_discord: vice?.discord_username ?? null,
      vice_avatar: vice?.avatar_hash ?? null,

      membros: membros
        .filter((m) => m.divisao_id === d.id)
        .sort((a, b) => (a.nome_rp ?? "").localeCompare(b.nome_rp ?? ""))
        .map(({ discord_id, discord_username, nome_rp, avatar_hash }) => ({
          discord_id,
          discord_username,
          nome_rp,
          avatar_hash,
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
      .select("membro_id, inscricao, presenca")
      .eq("gang_id", g)
      .eq("treino_id", treinoId),
  ) as { membro_id: string; inscricao: string | null; presenca: string | null }[];

  if (presencas.length === 0) return [];

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp, avatar_hash")
      .eq("gang_id", g)
      .in(
        "discord_id",
        presencas.map((p) => p.membro_id),
      ),
  ) as { discord_id: string; discord_username: string | null; nome_rp: string | null; avatar_hash: string | null }[];

  const porId = new Map(membros.map((m) => [m.discord_id, m]));

  return presencas.map((p) => ({
    membro_id: p.membro_id,
    discord_username: porId.get(p.membro_id)?.discord_username ?? null,
    nome_rp: porId.get(p.membro_id)?.nome_rp ?? null,
    avatar_hash: porId.get(p.membro_id)?.avatar_hash ?? null,
    inscricao: p.inscricao,
    presenca: p.presenca ?? "Pendente",
  }));
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
  assert(podeRevogarPunicao(user), "Apenas Dono, Líder e Vice-Líder podem revogar advertências.");
  const db = getDb();
  const { error } = await db
    .from("punicoes")
    .delete()
    .eq("gang_id", gid(user))
    .eq("id_punicao", input.punicaoId);
  if (error) throw new Error(error.message);
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
  assert(podeGerenciarParcerias(user), "Apenas Líder e Vice-Líder podem gerenciar alianças.");
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

export async function advertirMembro(
  user: SessionUser,
  input: { membroId: string; tipo: string; motivo: string },
) {
  assert(podeAdvertir(user));
  const db = getDb();
  const base = {
    membro_id: input.membroId,
    tipo: input.tipo,
    motivo: input.motivo || null,
    gang_id: gid(user),
  };

  // A autoria é gravada em staff_id (nome usado pelo bot); recua se a coluna não existir.
  const { error } = await db.from("punicoes").insert({ ...base, staff_id: user.id });
  if (error) {
    if (!/staff_id/i.test(error.message)) throw new Error(error.message);
    const { error: err2 } = await db.from("punicoes").insert(base);
    if (err2) throw new Error(err2.message);
  }

  await anunciarPunicao(db, user, input);
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


export async function trocarCargo(
  user: SessionUser,
  input: { membroId: string; cargos: string[] },
) {
  const permitidos = cargosAtribuiveis(user);
  const novos = Array.from(new Set(input.cargos.filter(Boolean)));
  assert(novos.length > 0, "Selecione ao menos um cargo.");
  assert(
    novos.every((c) => permitidos.includes(c)),
    "Você não pode atribuir este cargo.",
  );

  const db = getDb();
  const g = gid(user);
  const { fetchCargosAtuais } = await import("./discord.server");
  const doDiscord = await fetchCargosAtuais(input.membroId, user.guildId);

  const norm = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const antigos = doDiscord
    ? (CARGOS_PERMITIDOS as readonly string[]).filter((c) =>
        doDiscord.some((r) => norm(r) === norm(c)),
      )
    : [];


  // Cargos de liderança de divisão só mudam pela tela de divisões: preserva-os.
  const preservados = antigos.filter((c) => CARGOS_DIVISAO.includes(c));
  const finais = Array.from(new Set([...preservados, ...novos]));

  // A coluna `cargo` é curta (varchar 30): guarda só o principal.
  const { error } = await db
    .from("membros")
    .update({ cargo: cargoPrimario(finais) })
    .eq("gang_id", g)
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);

  // Sincroniza com o Discord (adiciona os novos, remove os retirados).
  const { ajustarCargoDiscord } = await import("./discord.server");
  for (const cargo of permitidos) {
    const tinha = antigos.includes(cargo);
    const tem = finais.includes(cargo);
    if (tinha === tem) continue;
    await ajustarCargoDiscord(input.membroId, cargo, tem ? "add" : "remove", ctxDiscord(user));
  }

  return { ok: true };
}

export async function alterarStatusMembro(
  user: SessionUser,
  input: { membroId: string; status: string },
) {
  assert(podeGerenciarMembros(user));
  const db = getDb();
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
  const { error } = await db
    .from("membros")
    .delete()
    .eq("gang_id", gid(user))
    .eq("discord_id", input.membroId);
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
    tipo: string;
    local: string;
    divisao_responsavel: string;
    aliado: string;
  },
) {
  assert(podeGerenciarTreinos(user));
  const db = getDb();
  const aliado = input.tipo === "Amistoso" ? input.aliado.trim() : "";
  const marca = aliado ? `[ALIADO|${aliado.replace(/[|\]\n]/g, " ")}]` : "";
  const descricao =
    `${input.descricao ? `${input.descricao.trim()}\n` : ""}${marca}`.trim() || null;

  const { error } = await db.from("treinos").insert({
    titulo: input.titulo,
    descricao,
    data_treino: input.data_treino,
    horario: input.horario || null,
    tipo: input.tipo,
    local: input.local || null,
    divisao_responsavel: input.divisao_responsavel || null,
    status: "Aberto",
    criado_por: user.id,
    gang_id: gid(user),
  });
  if (error) throw new Error(error.message);

  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_treinos", ctxDiscord(user), {
    title: `🐉 Novo treino: ${input.titulo}`,
    description: input.descricao?.trim() || undefined,
    fields: [
      { name: "Data", value: input.data_treino, inline: true },
      { name: "Horário", value: input.horario || "A definir", inline: true },
      { name: "Tipo", value: input.tipo, inline: true },
      { name: "Local", value: input.local || "A definir", inline: true },
      { name: "Divisão", value: input.divisao_responsavel || "Geral", inline: true },
      ...(aliado ? [{ name: "Gang aliada", value: aliado, inline: true }] : []),
      {
        name: "Criado por",
        value: user.nomeRp || user.globalName || user.username,
      },
    ],
    timestamp: new Date().toISOString(),
  });
  return { ok: true };
}



/** Só o criador do treino (ou o dono) controla presença, adiamento, encerramento e exclusão. */
async function requireDonoTreino(user: SessionUser, treinoId: number) {
  const db = getDb();
  const { data, error } = await db
    .from("treinos")
    .select("id_treino, descricao, data_treino, horario, criado_por, status")
    .eq("gang_id", gid(user))
    .eq("id_treino", treinoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Treino não encontrado.");
  if (!user.isOwner && data.criado_por !== user.id) {
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
  assert(podeGerenciarTreinos(user));
  await requireDonoTreino(user, input.treinoId);
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
  assert(podeGerenciarTreinos(user));
  await requireDonoTreino(user, input.treinoId);
  const db = getDb();
  const { error } = await db
    .from("treinos")
    .update({ status: "Encerrado" })
    .eq("gang_id", gid(user))
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adiarTreino(
  user: SessionUser,
  input: { treinoId: number; data_treino: string; horario: string },
) {
  assert(podeGerenciarTreinos(user));
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

export async function inscreverSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();
  const g = gid(user);
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
    .eq("membro_id", user.id)
    .maybeSingle();
  if (errSel) throw new Error(errSel.message);

  if (existente) {
    const { error } = await db
      .from("presencas_treino")
      .update({ inscricao: "Confirmado" })
      .eq("gang_id", g)
      .eq("treino_id", input.treinoId)
      .eq("membro_id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  const { error } = await db.from("presencas_treino").insert({
    treino_id: input.treinoId,
    membro_id: user.id,
    inscricao: "Confirmado",
    presenca: "Pendente",
    gang_id: g,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function ausentarSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();
  const { error } = await db
    .from("presencas_treino")
    .delete()
    .eq("gang_id", gid(user))
    .eq("treino_id", input.treinoId)
    .eq("membro_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function atualizarPresenca(
  user: SessionUser,
  input: { treinoId: number; membroId: string; presenca: string },
) {
  assert(podeGerenciarTreinos(user));
  await requireDonoTreino(user, input.treinoId);
  const db = getDb();
  const { error } = await db
    .from("presencas_treino")
    .update({ presenca: input.presenca })
    .eq("gang_id", gid(user))
    .eq("treino_id", input.treinoId)
    .eq("membro_id", input.membroId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function minhaInscricao(
  user: SessionUser,
  input: { treinoId: number },
): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from("presencas_treino")
    .select("inscricao")
    .eq("gang_id", gid(user))
    .eq("treino_id", input.treinoId)
    .eq("membro_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { inscricao: string | null } | null)?.inscricao ?? null;
}

/* ========== Escrita: divisões ========== */

type LiderancaDivisao = { id: number; lider_id: string | null; vice_lider_id: string | null };

async function carregarLideranca(
  user: SessionUser,
  divisaoId: number,
): Promise<LiderancaDivisao> {
  const db = getDb();
  const { data, error } = await db
    .from("divisoes")
    .select("id, lider_id, vice_lider_id")
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
  if (podeCriarDivisao(user)) return true;
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
  },
) {
  const g = gid(user);
  const divisao = await carregarLideranca(user, input.divisaoId);
  assert(await podeGerirDivisao(user, divisao), "Você não gerencia esta divisão.");
  const db = getDb();

  // Líder/vice da própria divisão não trocam o líder; só a cúpula faz isso.
  const liderId = podeCriarDivisao(user) ? input.liderId : divisao.lider_id;
  const podeDefinirVice =
    podeCriarDivisao(user) ||
    user.id === divisao.lider_id ||
    (temCargo(user, CARGO_LIDER_DIVISAO) &&
      (await divisaoDoUsuario(gid(user), user.id)) === divisao.id);
  const viceLiderId = podeDefinirVice ? input.viceLiderId : divisao.vice_lider_id;

  const { error } = await db
    .from("divisoes")
    .update({ lider_id: liderId, vice_lider_id: viceLiderId })
    .eq("gang_id", g)
    .eq("id", input.divisaoId);
  if (error) throw new Error(error.message);

  const entrando = Array.from(
    new Set([
      ...(liderId ? [liderId] : []),
      ...(viceLiderId ? [viceLiderId] : []),
      ...input.novosMembros,
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
  assert(podeCriarDivisao(user), "Apenas Líder e Vice-Líder podem deletar divisões.");
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
  assert(podeGerenciarParcerias(user), "Apenas Líder e Vice-Líder podem gerenciar alianças.");
  const db = getDb();
  const g = gid(user);

  // Quem fechou é mantido no registro original ao editar.
  let fechadoPor = user.id;
  let fechadoNome = user.nomeRp || user.globalName || user.username;
  const colunaId = await colunaIdParcerias();
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
  assert(podeGerenciarParcerias(user));
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
  if (podeGerenciarMembros(user)) return true;

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

/** O próprio membro edita sua ficha; a liderança pode editar a de qualquer um. */
export async function atualizarDadosMembro(
  user: SessionUser,
  input: {
    membroId: string;
    nome_rp: string;
    nome_roblox: string;
    genero: string;
    altura: string;
    estilo_luta_principal: string;
  },
) {
  const alvo = input.membroId || user.id;
  assert(
    alvo === user.id || podeGerenciarMembros(user),
    "Você só pode alterar os seus próprios dados.",
  );

  const limpo = (v: string) => (v ?? "").trim() || null;
  const alturaNum = Number((input.altura ?? "").toString().replace(",", "."));

  const { error } = await getDb()
    .from("membros")
    .update({
      nome_rp: limpo(input.nome_rp),
      nome_roblox: limpo(input.nome_roblox),
      genero: limpo(input.genero),
      altura_jogo: Number.isFinite(alturaNum) && input.altura?.trim() ? alturaNum : null,
      estilo_luta_principal: limpo(input.estilo_luta_principal),
    })
    .eq("gang_id", gid(user))
    .eq("discord_id", alvo);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ========== Configurações do painel ========== */

export async function loadConfiguracoesPainel(user: SessionUser) {
  assert(
    podeGerenciarMembros(user),
    "Apenas Líder, Vice-Líder e o dono acessam as configurações.",
  );
  const { loadConfiguracoes } = await import("./settings.server");
  return loadConfiguracoes([...CARGOS_PERMITIDOS], gid(user));
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
  assert(podeGerenciarMembros(user), "Você não pode alterar as configurações.");
  const { salvarConfiguracoesDaGang, chaveCargo } = await import("./settings.server");
  const valores: Record<string, string> = { owner_ids: input.owners };
  for (const [nome, id] of Object.entries(input.cargos)) valores[chaveCargo(nome)] = id;
  for (const [chave, id] of Object.entries(input.canais)) valores[chave] = id;
  await salvarConfiguracoesDaGang(gid(user), valores);
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
    observacoes: string;
  },
) {
  assert(podeGerenciarTreinos(user), "Sem permissão para registrar logs.");
  const db = getDb();
  const autor = user.nomeRp || user.globalName || user.username;
  const { error } = await db.from("logs_partidas").insert({
    tipo: input.tipo,
    adversario_id: input.adversario_id,
    adversario_nome: input.adversario_nome,
    adversario_guild_id: input.adversario_guild_id,
    adversario_icon_hash: input.adversario_icon_hash,
    pontos_nos: input.pontos_nos,
    pontos_eles: input.pontos_eles,
    data_partida: input.data_partida || new Date().toISOString().slice(0, 10),
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
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function deletarLog(user: SessionUser, id: number) {
  assert(podeGerenciarTreinos(user), "Sem permissão para remover logs.");
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
