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
  Membro,
  Parceria,
  PresencaTreino,
  Punicao,
  Treino,
} from "./types";


/* ========== Sessão / guardas ========== */

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await currentUser(request);
  if (!user) throw new Error("NAO_AUTENTICADO");
  // Revalida os cargos direto no Discord (a sessão pode estar defasada).
  const { fetchCargosAtuais } = await import("./discord.server");
  const cargosAtuais = await fetchCargosAtuais(user.id);
  if (cargosAtuais) user.roles = cargosAtuais;
  // Donos extras podem ser cadastrados nas Configurações.
  if (!user.isOwner) {
    const { ehDono } = await import("./settings.server");
    if (await ehDono(user.id)) user.isOwner = true;
  }
  if (!podeAcessar(user)) throw new Error("SEM_PERMISSAO");
  return user;
}

function assert(condition: boolean, message = "Você não tem permissão para esta ação.") {
  if (!condition) throw new Error(message);
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/* ========== Leitura ========== */

export async function loadMembros(): Promise<Membro[]> {
  const db = getDb();

  const membros = unwrap(
    await db
      .from("membros")
      .select(
        "discord_id, discord_username, nome_roblox, nome_rp, genero, altura_jogo, estilo_luta_principal, cargo, status, data_entrada, avatar_hash, divisao_id",
      )
      .order("data_entrada", { ascending: false }),
  ) as Omit<Membro, "divisao" | "warns" | "stats">[];

  const divisoes = unwrap(await db.from("divisoes").select("id, nome_divisao")) as {
    id: number;
    nome_divisao: string;
  }[];
  const divisaoNome = new Map(divisoes.map((d) => [d.id, d.nome_divisao]));

  const punicoes = unwrap(
    await db.from("punicoes").select("membro_id, tipo"),
  ) as { membro_id: string; tipo: string }[];
  const warns = new Map<string, number>();
  for (const p of punicoes) {
    if (p.tipo === "Warn") warns.set(p.membro_id, (warns.get(p.membro_id) ?? 0) + 1);
  }

  const presencas = unwrap(
    await db
      .from("presencas_treino")
      .select("membro_id, presenca, treinos!inner(tipo)")
      .eq("presenca", "Presente"),
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
      await db.from("participacoes_guerra").select("membro_id"),
    ) as { membro_id: string }[];
    for (const g of guerras) bucket(g.membro_id).guerras += 1;
  } catch {
    /* tabela opcional */
  }

  // O Discord é a fonte da verdade dos cargos (o banco guarda só o principal).
  const { fetchCargosDeTodos } = await import("./discord.server");
  const cargosDiscord = await fetchCargosDeTodos();
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

export async function loadTreinos(): Promise<Treino[]> {
  const db = getDb();
  const treinos = unwrap(
    await db.from("treinos").select("*").order("data_treino", { ascending: false }),
  ) as Omit<Treino, "inscritos" | "adiamento" | "aliado">[];

  const inscricoes = unwrap(
    await db.from("presencas_treino").select("treino_id, inscricao"),
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



export async function loadDivisoes(): Promise<Divisao[]> {
  const db = getDb();
  const divisoes = unwrap(
    await db.from("divisoes").select("*").order("nome_divisao"),
  ) as Omit<Divisao, "lider_nome" | "lider_discord" | "vice_nome" | "vice_discord" | "membros">[];

  const membros = unwrap(
    await db.from("membros").select("discord_id, discord_username, nome_rp, avatar_hash, divisao_id"),
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

export async function loadPresencas(treinoId: number): Promise<PresencaTreino[]> {
  const db = getDb();
  const presencas = unwrap(
    await db
      .from("presencas_treino")
      .select("membro_id, inscricao, presenca")
      .eq("treino_id", treinoId),
  ) as { membro_id: string; inscricao: string | null; presenca: string | null }[];

  if (presencas.length === 0) return [];

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp, avatar_hash")
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

export async function loadHistorico(membroId: string): Promise<Punicao[]> {
  const db = getDb();
  const punicoes = unwrap(
    await db.from("punicoes").select("*").eq("membro_id", membroId),
  ) as Punicao[];

  const autores = Array.from(
    new Set(punicoes.map((p) => p.staff_id).filter(Boolean) as string[]),
  );
  if (autores.length === 0) return punicoes.map((p) => ({ ...p, staff_nome: null }));

  const membros = unwrap(
    await db
      .from("membros")
      .select("discord_id, discord_username, nome_rp")
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
  const { error } = await db.from("punicoes").delete().eq("id_punicao", input.punicaoId);
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

export async function loadParcerias(): Promise<{ parcerias: Parceria[]; tabelaAusente: boolean }> {
  const db = getDb();
  const { data, error } = await db.from("parcerias").select("*").order("nome");
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
    .eq("discord_id", input.membroId)
    .maybeSingle();
  const alvo = (data as { nome_rp: string | null; discord_username: string | null } | null) ?? null;
  const nome = alvo?.nome_rp || alvo?.discord_username || input.membroId;
  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_advertencias", {
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
  const { fetchCargosAtuais } = await import("./discord.server");
  const doDiscord = await fetchCargosAtuais(input.membroId);

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
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);

  // Sincroniza com o Discord (adiciona os novos, remove os retirados).
  const { ajustarCargoDiscord } = await import("./discord.server");
  for (const cargo of permitidos) {
    const tinha = antigos.includes(cargo);
    const tem = finais.includes(cargo);
    if (tinha === tem) continue;
    await ajustarCargoDiscord(input.membroId, cargo, tem ? "add" : "remove");
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
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removerMembro(user: SessionUser, input: { membroId: string }) {
  assert(podeGerenciarMembros(user));
  const db = getDb();
  const { error } = await db.from("membros").delete().eq("discord_id", input.membroId);
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
  });
  if (error) throw new Error(error.message);

  const { enviarMensagemCanal } = await import("./discord.server");
  await enviarMensagemCanal("canal_treinos", {
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
  const { error } = await db.from("treinos").delete().eq("id_treino", input.treinoId);
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
    .eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function inscreverSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();
  const { data: treino } = await db
    .from("treinos")
    .select("status")
    .eq("id_treino", input.treinoId)
    .maybeSingle();
  if (treino && treino.status && treino.status !== "Aberto") {
    throw new Error("Este treino não está mais aberto para inscrições.");
  }


  // Sem depender de constraint única: verifica e então atualiza ou insere.
  const { data: existente, error: errSel } = await db
    .from("presencas_treino")
    .select("membro_id")
    .eq("treino_id", input.treinoId)
    .eq("membro_id", user.id)
    .maybeSingle();
  if (errSel) throw new Error(errSel.message);

  if (existente) {
    const { error } = await db
      .from("presencas_treino")
      .update({ inscricao: "Confirmado" })
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
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function ausentarSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();
  const { error } = await db
    .from("presencas_treino")
    .delete()
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
    .eq("treino_id", input.treinoId)
    .eq("membro_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { inscricao: string | null } | null)?.inscricao ?? null;
}

/* ========== Escrita: divisões ========== */

type LiderancaDivisao = { id: number; lider_id: string | null; vice_lider_id: string | null };

async function carregarLideranca(divisaoId: number): Promise<LiderancaDivisao> {
  const db = getDb();
  const { data, error } = await db
    .from("divisoes")
    .select("id, lider_id, vice_lider_id")
    .eq("id", divisaoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Divisão não encontrada.");
  return data as LiderancaDivisao;
}

export const CARGO_LIDER_DIVISAO = "Líder de Divisão";
export const CARGO_VICE_LIDER_DIVISAO = "Vice-Líder de Divisão";

/** Divisão à qual o usuário pertence (tabela membros). */
async function divisaoDoUsuario(discordId: string): Promise<number | null> {
  const db = getDb();
  const { data } = await db
    .from("membros")
    .select("divisao_id")
    .eq("discord_id", discordId)
    .maybeSingle();
  return (data as { divisao_id: number | null } | null)?.divisao_id ?? null;
}

/** Cúpula da gang ou liderança da própria divisão. */
async function podeGerirDivisao(user: SessionUser, divisao: LiderancaDivisao): Promise<boolean> {
  if (podeCriarDivisao(user)) return true;
  if (user.id === divisao.lider_id || user.id === divisao.vice_lider_id) return true;
  if (temCargo(user, CARGO_LIDER_DIVISAO) || temCargo(user, CARGO_VICE_LIDER_DIVISAO)) {
    return (await divisaoDoUsuario(user.id)) === divisao.id;
  }
  return false;
}

/** ID do cargo do Discord associado a uma divisão. */
async function roleIdDaDivisao(divisaoId: number | null): Promise<string | null> {
  if (divisaoId == null) return null;
  const db = getDb();
  const { data } = await db
    .from("divisoes")
    .select("discord_role_id")
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
  membroId: string,
  antiga: number | null,
  nova: number | null,
) {
  if (antiga === nova) return;
  const { ajustarCargoPorId } = await import("./discord.server");
  const [roleAntigo, roleNovo] = await Promise.all([
    roleIdDaDivisao(antiga),
    roleIdDaDivisao(nova),
  ]);
  if (roleAntigo && roleAntigo !== roleNovo) {
    await ajustarCargoPorId(membroId, roleAntigo, "remove");
  }
  if (roleNovo) await ajustarCargoPorId(membroId, roleNovo, "add");
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
  const divisao = await carregarLideranca(input.divisaoId);
  assert(await podeGerirDivisao(user, divisao), "Você não gerencia esta divisão.");
  const db = getDb();

  // Líder/vice da própria divisão não trocam o líder; só a cúpula faz isso.
  const liderId = podeCriarDivisao(user) ? input.liderId : divisao.lider_id;
  const podeDefinirVice =
    podeCriarDivisao(user) ||
    user.id === divisao.lider_id ||
    (temCargo(user, CARGO_LIDER_DIVISAO) && (await divisaoDoUsuario(user.id)) === divisao.id);
  const viceLiderId = podeDefinirVice ? input.viceLiderId : divisao.vice_lider_id;

  const { error } = await db
    .from("divisoes")
    .update({ lider_id: liderId, vice_lider_id: viceLiderId })
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
      .in("discord_id", entrando);
    if (err2) throw new Error(err2.message);

    for (const id of entrando) {
      await trocarCargoDivisaoDiscord(id, anteriores.get(id) ?? null, input.divisaoId);
    }
  }

  // Quem deixou a liderança e não faz mais parte da divisão perde o cargo dela.
  for (const antigo of [divisao.lider_id, divisao.vice_lider_id]) {
    if (!antigo || entrando.includes(antigo)) continue;
    if ((await divisaoDoUsuario(antigo)) !== input.divisaoId) {
      await trocarCargoDivisaoDiscord(antigo, input.divisaoId, null);
    }
  }

  await sincronizarCargosLideranca(db, divisao, liderId, viceLiderId);
  return { ok: true };
}


/** Aplica/retira o cargo (Discord + tabela membros) de líder e vice da divisão. */
async function sincronizarCargosLideranca(
  db: ReturnType<typeof getDb>,
  antes: LiderancaDivisao,
  liderId: string | null,
  viceLiderId: string | null,
) {
  const { ajustarCargoDiscord } = await import("./discord.server");

  const pares: { antigo: string | null; novo: string | null; cargo: string }[] = [
    { antigo: antes.lider_id, novo: liderId, cargo: CARGO_LIDER_DIVISAO },
    { antigo: antes.vice_lider_id, novo: viceLiderId, cargo: CARGO_VICE_LIDER_DIVISAO },
  ];

  const lerCargos = async (id: string): Promise<string[]> => {
    const { data } = await db.from("membros").select("cargo").eq("discord_id", id).maybeSingle();
    return ((data as { cargo: string | null } | null)?.cargo ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  };
  const gravar = async (id: string, cargos: string[]) => {
    await db
      .from("membros")
      .update({ cargo: cargoPrimario(cargos.length ? cargos : ["Membro"]) })
      .eq("discord_id", id);
  };

  for (const { antigo, novo, cargo } of pares) {
    if (antigo === novo) continue;
    if (antigo) {
      await ajustarCargoDiscord(antigo, cargo, "remove");
      await gravar(antigo, (await lerCargos(antigo)).filter((c) => c !== cargo));
    }
    if (novo) {
      await ajustarCargoDiscord(novo, cargo, "add");
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
  const { data: membro, error: errMembro } = await db
    .from("membros")
    .select("divisao_id")
    .eq("discord_id", input.membroId)
    .maybeSingle();
  if (errMembro) throw new Error(errMembro.message);
  const divisaoId = (membro as { divisao_id: number | null } | null)?.divisao_id ?? null;
  if (divisaoId == null) return { ok: true };
  assert(
    await podeGerirDivisao(user, await carregarLideranca(divisaoId)),
    "Você não gerencia esta divisão.",
  );
  const lideranca = await carregarLideranca(divisaoId);
  const novoLider = lideranca.lider_id === input.membroId ? null : lideranca.lider_id;
  const novoVice = lideranca.vice_lider_id === input.membroId ? null : lideranca.vice_lider_id;
  if (novoLider !== lideranca.lider_id || novoVice !== lideranca.vice_lider_id) {
    await db
      .from("divisoes")
      .update({ lider_id: novoLider, vice_lider_id: novoVice })
      .eq("id", divisaoId);
    await sincronizarCargosLideranca(db, lideranca, novoLider, novoVice);
  }

  const { error } = await db
    .from("membros")
    .update({ divisao_id: null })
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
  await trocarCargoDivisaoDiscord(input.membroId, divisaoId, null);
  return { ok: true };
}

export async function deletarDivisao(user: SessionUser, input: { divisaoId: number }) {
  assert(podeCriarDivisao(user), "Apenas Líder e Vice-Líder podem deletar divisões.");
  const db = getDb();
  // Liderança perde o cargo de capitão junto com a divisão.
  const lideranca = await carregarLideranca(input.divisaoId);
  await sincronizarCargosLideranca(db, lideranca, null, null);

  // Todos os integrantes perdem o cargo do Discord da divisão.
  const { data: integrantes } = await db
    .from("membros")
    .select("discord_id")
    .eq("divisao_id", input.divisaoId);
  for (const m of (integrantes ?? []) as { discord_id: string }[]) {
    await trocarCargoDivisaoDiscord(m.discord_id, input.divisaoId, null);
  }

  await db.from("membros").update({ divisao_id: null }).eq("divisao_id", input.divisaoId);
  const { error } = await db.from("divisoes").delete().eq("id", input.divisaoId);
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

  // Quem fechou é mantido no registro original ao editar.
  let fechadoPor = user.id;
  let fechadoNome = user.nomeRp || user.globalName || user.username;
  const colunaId = await colunaIdParcerias();
  if (input.id != null) {
    const { data } = await db
      .from("parcerias")
      .select("observacoes")
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
      ? db.from("parcerias").insert(payload)
      : db.from("parcerias").update(payload).eq(colunaId, input.id);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (input.id == null) {
    const { enviarMensagemCanal } = await import("./discord.server");
    await enviarMensagemCanal("canal_aliancas", {
      title: `🤝 Nova aliança: ${input.nome}`,
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
  const { error } = await db.from("parcerias").delete().eq(coluna, input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
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
  return loadConfiguracoes([...CARGOS_PERMITIDOS]);
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
  const { salvarConfiguracoes, chaveCargo, CHAVE_GUILD } = await import("./settings.server");
  const valores: Record<string, string> = {
    owner_ids: input.owners,
    [CHAVE_GUILD]: (input.guildId ?? "").replace(/\D/g, ""),
  };
  for (const [nome, id] of Object.entries(input.cargos)) valores[chaveCargo(nome)] = id;
  for (const [chave, id] of Object.entries(input.canais)) valores[chave] = id;
  await salvarConfiguracoes(valores);
  return { ok: true };
}
