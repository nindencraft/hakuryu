import { getDb, currentUser } from "./db.server";
import {
  podeAcessar,
  podeGerenciarDivisoes,
  podeGerenciarMembros,
  podeGerenciarParcerias,
  podeGerenciarTreinos,
  type SessionUser,
} from "./session.server";
import type {
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

  return membros.map((m) => ({
    ...m,
    divisao: m.divisao_id != null ? (divisaoNome.get(m.divisao_id) ?? null) : null,
    warns: warns.get(m.discord_id) ?? 0,
    stats: stats.get(m.discord_id) ?? { internos: 0, amistosos: 0, guerras: 0 },
  }));
}

/** Marcador de adiamento guardado no fim da descrição (o banco não tem coluna própria). */
const MARCA_ADIAMENTO = /\n?\[ADIADO\|([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\s*$/;

function separarAdiamento(descricao: string | null) {
  if (!descricao) return { descricao: null, adiamento: null };
  const m = descricao.match(MARCA_ADIAMENTO);
  if (!m) return { descricao, adiamento: null };
  const limpa = descricao.replace(MARCA_ADIAMENTO, "").trim();
  return {
    descricao: limpa || null,
    adiamento: { por: m[1] || null, em: m[2] || null, antes: m[3] || null },
  };
}

export async function loadTreinos(): Promise<Treino[]> {
  const db = getDb();
  const treinos = unwrap(
    await db.from("treinos").select("*").order("data_treino", { ascending: false }),
  ) as Omit<Treino, "inscritos" | "adiamento">[];

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
    const { descricao, adiamento } = separarAdiamento(t.descricao);
    return { ...t, descricao, adiamento, inscritos: contagem.get(t.id_treino) ?? 0 };
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
      vice_nome: vice?.nome_rp ?? null,
      vice_discord: vice?.discord_username ?? null,
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
  return unwrap(
    await db.from("punicoes").select("*").eq("membro_id", membroId),
  ) as Punicao[];
}

export async function loadParcerias(): Promise<{ parcerias: Parceria[]; tabelaAusente: boolean }> {
  const db = getDb();
  const { data, error } = await db.from("parcerias").select("*").order("nome");
  if (error) {
    const ausente = /does not exist|schema cache|relation/i.test(error.message);
    if (ausente) return { parcerias: [], tabelaAusente: true };
    throw new Error(error.message);
  }
  return { parcerias: (data ?? []) as Parceria[], tabelaAusente: false };
}

/* ========== Escrita: membros ========== */

export async function advertirMembro(
  user: SessionUser,
  input: { membroId: string; tipo: string; motivo: string },
) {
  assert(podeGerenciarMembros(user));
  const db = getDb();
  const base = {
    membro_id: input.membroId,
    tipo: input.tipo,
    motivo: input.motivo || null,
  };

  // A autoria é gravada em staff_id (nome usado pelo bot); recua se a coluna não existir.
  const { error } = await db.from("punicoes").insert({ ...base, staff_id: user.id });
  if (!error) return { ok: true };
  if (!/staff_id/i.test(error.message)) throw new Error(error.message);

  const { error: err2 } = await db.from("punicoes").insert(base);
  if (err2) throw new Error(err2.message);

  return { ok: true };
}

export async function trocarCargo(
  user: SessionUser,
  input: { membroId: string; cargo: string },
) {
  assert(podeGerenciarMembros(user));
  const db = getDb();
  const { error } = await db
    .from("membros")
    .update({ cargo: input.cargo })
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
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
  },
) {
  assert(podeGerenciarTreinos(user));
  const db = getDb();
  const { error } = await db.from("treinos").insert({
    titulo: input.titulo,
    descricao: input.descricao || null,
    data_treino: input.data_treino,
    horario: input.horario || null,
    tipo: input.tipo,
    local: input.local || null,
    divisao_responsavel: input.divisao_responsavel || null,
    criado_por: user.id,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletarTreino(user: SessionUser, input: { treinoId: number }) {
  assert(podeGerenciarTreinos(user));
  const db = getDb();
  const { error } = await db.from("treinos").delete().eq("id_treino", input.treinoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function inscreverSe(user: SessionUser, input: { treinoId: number }) {
  const db = getDb();

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

export async function criarDivisao(
  user: SessionUser,
  input: {
    nome_divisao: string;
    logo_url: string;
    discord_role_id: string;
    funcao_principal: string;
  },
) {
  assert(podeGerenciarDivisoes(user));
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
  assert(podeGerenciarDivisoes(user));
  const db = getDb();
  const { error } = await db
    .from("divisoes")
    .update({ lider_id: input.liderId, vice_lider_id: input.viceLiderId })
    .eq("id", input.divisaoId);
  if (error) throw new Error(error.message);

  if (input.novosMembros.length > 0) {
    const { error: err2 } = await db
      .from("membros")
      .update({ divisao_id: input.divisaoId })
      .in("discord_id", input.novosMembros);
    if (err2) throw new Error(err2.message);
  }
  return { ok: true };
}

export async function removerMembroDivisao(
  user: SessionUser,
  input: { membroId: string },
) {
  assert(podeGerenciarDivisoes(user));
  const db = getDb();
  const { error } = await db
    .from("membros")
    .update({ divisao_id: null })
    .eq("discord_id", input.membroId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletarDivisao(user: SessionUser, input: { divisaoId: number }) {
  assert(podeGerenciarDivisoes(user));
  const db = getDb();
  const { error } = await db.from("divisoes").delete().eq("id", input.divisaoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ========== Escrita: parcerias ========== */

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
  },
) {
  assert(podeGerenciarParcerias(user));
  const db = getDb();
  const payload = {
    nome: input.nome,
    tag: input.tag || null,
    contato: input.contato || null,
    status: input.status,
    link_servidor: input.link_servidor || null,
    observacoes: input.observacoes || null,
    data_inicio: input.data_inicio || null,
  };
  const query =
    input.id == null
      ? db.from("parcerias").insert(payload)
      : db.from("parcerias").update(payload).eq("id", input.id);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletarParceria(user: SessionUser, input: { id: number }) {
  assert(podeGerenciarParcerias(user));
  const db = getDb();
  const { error } = await db.from("parcerias").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
