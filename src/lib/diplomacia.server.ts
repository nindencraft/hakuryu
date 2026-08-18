import { getDb } from "./db.server";
import { podeGerenciarParcerias, type SessionUser } from "./session.server";
import type { GangRegistrada, GuerraAtiva, SolicitacaoGang } from "./types";

/* ========== utilidades ========== */

function gid(user: SessionUser): number {
  if (user.gangId == null) throw new Error("SEM_GANG");
  return user.gangId;
}

function assert(condicao: boolean, mensagem = "Você não tem permissão para esta ação.") {
  if (!condicao) throw new Error(mensagem);
}

function ausente(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .*gang_(relacoes|solicitacoes).* does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg)
  );
}

function nomeUsuario(user: SessionUser): string {
  return user.nomeRp || user.globalName || user.username;
}

function par(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

type GangLinha = { id: number; nome: string; guild_id: string; ativo: boolean };

async function iconesPorGuild(): Promise<Map<string, string | null>> {
  const { fetchGuildsDoBot } = await import("./discord.server");
  const guilds = await fetchGuildsDoBot();
  return new Map(guilds.map((g) => [g.id, g.iconHash]));
}

async function gangsAtivas(): Promise<GangLinha[]> {
  const db = getDb();
  const { data, error } = await db
    .from("gangs")
    .select("id, nome, guild_id, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as GangLinha[];
}

type RelacaoLinha = { gang_a_id: number; gang_b_id: number; tipo: string };

async function relacoesDaGang(
  gangId: number,
): Promise<{ relacoes: RelacaoLinha[]; tabelaAusente: boolean }> {
  const db = getDb();
  const { data, error } = await db
    .from("gang_relacoes")
    .select("gang_a_id, gang_b_id, tipo")
    .or(`gang_a_id.eq.${gangId},gang_b_id.eq.${gangId}`);
  if (error) {
    if (ausente(error)) return { relacoes: [], tabelaAusente: true };
    throw new Error(error.message);
  }
  return { relacoes: (data ?? []) as RelacaoLinha[], tabelaAusente: false };
}

async function definirRelacao(
  user: SessionUser,
  outraGangId: number,
  tipo: "Aliada" | "Inimiga",
) {
  const db = getDb();
  const [a, b] = par(gid(user), outraGangId);
  const { error } = await db
    .from("gang_relacoes")
    .upsert(
      {
        gang_a_id: a,
        gang_b_id: b,
        tipo,
        definido_por: user.id,
        definido_por_nome: nomeUsuario(user),
      },
      { onConflict: "gang_a_id,gang_b_id" },
    );
  if (error && !ausente(error)) throw new Error(error.message);
}

async function limparRelacao(gangId: number, outraGangId: number) {
  const db = getDb();
  const [a, b] = par(gangId, outraGangId);
  const { error } = await db
    .from("gang_relacoes")
    .delete()
    .eq("gang_a_id", a)
    .eq("gang_b_id", b);
  if (error && !ausente(error)) throw new Error(error.message);
}

/* ========== leitura ========== */

export async function listarGangsRegistradas(
  user: SessionUser,
): Promise<{ gangs: GangRegistrada[]; tabelaAusente: boolean }> {
  const db = getDb();
  const minha = gid(user);
  const [todas, { relacoes, tabelaAusente }, icones] = await Promise.all([
    gangsAtivas(),
    relacoesDaGang(minha),
    iconesPorGuild(),
  ]);

  const relacaoDe = new Map<number, string>();
  for (const r of relacoes) {
    const outra = r.gang_a_id === minha ? r.gang_b_id : r.gang_a_id;
    relacaoDe.set(outra, r.tipo);
  }

  // Solicitações pendentes envolvendo a minha gang (para desabilitar duplicatas).
  const pendentes = new Map<number, { tipo: string; direcao: "enviada" | "recebida" }[]>();
  const { data: pend } = await db
    .from("gang_solicitacoes")
    .select("gang_origem_id, gang_destino_id, tipo")
    .eq("status", "Pendente")
    .or(`gang_origem_id.eq.${minha},gang_destino_id.eq.${minha}`);
  for (const s of (pend ?? []) as {
    gang_origem_id: number;
    gang_destino_id: number;
    tipo: string;
  }[]) {
    const outra = s.gang_origem_id === minha ? s.gang_destino_id : s.gang_origem_id;
    const direcao = s.gang_origem_id === minha ? "enviada" : "recebida";
    pendentes.set(outra, [...(pendentes.get(outra) ?? []), { tipo: s.tipo, direcao }]);
  }

  // Contagem de membros, treinos e divisões por gang.
  const contagem = new Map<number, number>();
  const treinosPorGang = new Map<number, number>();
  const divisoesPorGang = new Map<number, number>();
  const [{ data: membros }, { data: treinos }, { data: divisoes }] = await Promise.all([
    db.from("membros").select("gang_id"),
    db.from("treinos").select("gang_id"),
    db.from("divisoes").select("gang_id"),
  ]);
  for (const m of (membros ?? []) as { gang_id: number | null }[]) {
    if (m.gang_id == null) continue;
    contagem.set(m.gang_id, (contagem.get(m.gang_id) ?? 0) + 1);
  }
  for (const t of (treinos ?? []) as { gang_id: number | null }[]) {
    if (t.gang_id == null) continue;
    treinosPorGang.set(t.gang_id, (treinosPorGang.get(t.gang_id) ?? 0) + 1);
  }
  for (const d of (divisoes ?? []) as { gang_id: number | null }[]) {
    if (d.gang_id == null) continue;
    divisoesPorGang.set(d.gang_id, (divisoesPorGang.get(d.gang_id) ?? 0) + 1);
  }

  const convites = await convitesDasGangs(todas.filter((g) => g.id !== minha));


  // Solicitação aceita que originou cada relação (representante, datas, quem fechou).
  const acordo = new Map<number, SolicitacaoLinha>();
  if (relacaoDe.size > 0) {
    const { data: aceitas } = await db
      .from("gang_solicitacoes")
      .select("*")
      .eq("status", "Aceita")
      .in("tipo", ["Alianca", "Guerra"])
      .or(`gang_origem_id.eq.${minha},gang_destino_id.eq.${minha}`)
      .order("respondido_em", { ascending: false });
    for (const s of (aceitas ?? []) as SolicitacaoLinha[]) {
      const outra = s.gang_origem_id === minha ? s.gang_destino_id : s.gang_origem_id;
      const esperado = relacaoDe.get(outra) === "Aliada" ? "Alianca" : "Guerra";
      if (s.tipo !== esperado) continue;
      if (!acordo.has(outra)) acordo.set(outra, s);
    }
  }

  const gangs = todas
    .filter((g) => g.id !== minha)
    .map<GangRegistrada>((g) => {
      const a = acordo.get(g.id);
      return {
        id: g.id,
        nome: g.nome,
        guild_id: g.guild_id,
        icon_hash: icones.get(g.guild_id) ?? null,
        membros: contagem.get(g.id) ?? 0,
        relacao: (relacaoDe.get(g.id) as GangRegistrada["relacao"]) ?? "Neutra",
        pendencias: pendentes.get(g.id) ?? [],
        desde: a?.respondido_em ?? a?.criado_em ?? null,
        representante_id: a?.representante_id ?? null,
        representante_nome: a?.representante_nome ?? null,
        representante_avatar: a?.representante_avatar ?? null,
        solicitado_por_nome: a?.criado_por_nome ?? null,
        fechado_por_nome: a?.respondido_por_nome ?? null,
      };
    });


  return { gangs, tabelaAusente };
}

type SolicitacaoLinha = {
  id: number;
  gang_origem_id: number;
  gang_destino_id: number;
  tipo: string;
  status: string;
  motivo: string | null;
  data_evento: string | null;
  horario: string | null;
  local: string | null;
  membros_origem: number | null;
  membros_destino: number | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  respondido_por: string | null;
  respondido_por_nome: string | null;
  respondido_em: string | null;
  criado_em: string | null;
  encerrar_origem?: boolean | null;
  encerrar_destino?: boolean | null;
  representante_id?: string | null;
  representante_nome?: string | null;
  representante_avatar?: string | null;
};

export async function listarSolicitacoes(
  user: SessionUser,
): Promise<{ solicitacoes: SolicitacaoGang[]; tabelaAusente: boolean }> {
  const db = getDb();
  const minha = gid(user);
  const { data, error } = await db
    .from("gang_solicitacoes")
    .select("*")
    .or(`gang_origem_id.eq.${minha},gang_destino_id.eq.${minha}`)
    .order("criado_em", { ascending: false });
  if (error) {
    if (ausente(error)) return { solicitacoes: [], tabelaAusente: true };
    throw new Error(error.message);
  }

  const [todas, icones] = await Promise.all([gangsAtivas(), iconesPorGuild()]);
  const porId = new Map(todas.map((g) => [g.id, g]));

  const solicitacoes = ((data ?? []) as SolicitacaoLinha[]).map<SolicitacaoGang>((s) => {
    const souOrigem = s.gang_origem_id === minha;
    const outraId = souOrigem ? s.gang_destino_id : s.gang_origem_id;
    const outra = porId.get(outraId);
    return {
      id: s.id,
      tipo: s.tipo,
      status: s.status,
      motivo: s.motivo,
      data_evento: s.data_evento,
      horario: s.horario,
      local: s.local,
      membros_origem: s.membros_origem,
      membros_destino: s.membros_destino,
      criado_por: s.criado_por,
      criado_por_nome: s.criado_por_nome,
      respondido_por_nome: s.respondido_por_nome,
      respondido_em: s.respondido_em,
      criado_em: s.criado_em,
      representante_id: s.representante_id ?? null,
      representante_nome: s.representante_nome ?? null,
      representante_avatar: s.representante_avatar ?? null,
      direcao: souOrigem ? "enviada" : "recebida",
      gang: {
        id: outraId,
        nome: outra?.nome ?? "Gang desconhecida",
        guild_id: outra?.guild_id ?? null,
        icon_hash: outra ? (icones.get(outra.guild_id) ?? null) : null,
      },
    };
  });

  return { solicitacoes, tabelaAusente: false };
}

export async function listarGuerrasAtivas(
  user: SessionUser,
): Promise<{ guerras: GuerraAtiva[]; tabelaAusente: boolean }> {
  const db = getDb();
  const minha = gid(user);
  const { data, error } = await db
    .from("gang_solicitacoes")
    .select("*")
    .eq("tipo", "Guerra")
    .eq("status", "Aceita")
    .or(`gang_origem_id.eq.${minha},gang_destino_id.eq.${minha}`)
    .order("criado_em", { ascending: false });
  if (error) {
    if (ausente(error)) return { guerras: [], tabelaAusente: true };
    throw new Error(error.message);
  }

  const [todas, icones] = await Promise.all([gangsAtivas(), iconesPorGuild()]);
  const porId = new Map(todas.map((g) => [g.id, g]));
  const info = (id: number) => {
    const g = porId.get(id);
    return {
      nome: g?.nome ?? "Gang desconhecida",
      guild_id: g?.guild_id ?? null,
      icon_hash: g ? (icones.get(g.guild_id) ?? null) : null,
    };
  };

  const guerras = ((data ?? []) as SolicitacaoLinha[]).map<GuerraAtiva>((s) => {
    const souOrigem = s.gang_origem_id === minha;
    return {
      id: s.id,
      motivo: s.motivo,
      data_evento: s.data_evento,
      horario: s.horario,
      local: s.local,
      membros_nos: souOrigem ? s.membros_origem : s.membros_destino,
      membros_eles: souOrigem ? s.membros_destino : s.membros_origem,
      solicitante_nome: s.criado_por_nome,
      aceito_por_nome: s.respondido_por_nome,
      criado_em: s.criado_em,
      pedimos_encerrar: !!(souOrigem ? s.encerrar_origem : s.encerrar_destino),
      eles_pediram_encerrar: !!(souOrigem ? s.encerrar_destino : s.encerrar_origem),
      nos: info(minha),
      eles: info(souOrigem ? s.gang_destino_id : s.gang_origem_id),
    };
  });

  return { guerras, tabelaAusente: false };
}

/* ========== escrita ========== */

export type NovaSolicitacao = {
  gangId: number;
  tipo: string;
  motivo: string;
  data_evento: string;
  horario: string;
  local: string;
  membros_origem: string;
  membros_destino: string;
  representante_id?: string;
};

export async function criarSolicitacao(user: SessionUser, input: NovaSolicitacao) {
  assert(
    podeGerenciarParcerias(user),
    "Apenas Dono, Líder e Vice-Líder podem enviar solicitações.",
  );
  const db = getDb();
  const minha = gid(user);
  if (input.gangId === minha) throw new Error("Você não pode se solicitar.");
  if (!["Alianca", "Guerra", "Treino"].includes(input.tipo)) {
    throw new Error("Tipo de solicitação inválido.");
  }

  const { relacoes, tabelaAusente } = await relacoesDaGang(minha);
  if (tabelaAusente) {
    throw new Error(
      "As tabelas de diplomacia não existem no banco. Rode o script sql/diplomacia.sql.",
    );
  }
  const relacaoAtual = relacoes.find(
    (r) => r.gang_a_id === input.gangId || r.gang_b_id === input.gangId,
  )?.tipo;
  if (input.tipo === "Alianca" && relacaoAtual === "Aliada") {
    throw new Error("Vocês já são aliadas.");
  }
  if (input.tipo === "Guerra" && relacaoAtual === "Inimiga") {
    throw new Error("Vocês já estão em guerra.");
  }

  const { data: dup } = await db
    .from("gang_solicitacoes")
    .select("id")
    .eq("status", "Pendente")
    .eq("tipo", input.tipo)
    .or(
      `and(gang_origem_id.eq.${minha},gang_destino_id.eq.${input.gangId}),and(gang_origem_id.eq.${input.gangId},gang_destino_id.eq.${minha})`,
    )
    .limit(1);
  if ((dup ?? []).length > 0) {
    throw new Error("Já existe uma solicitação pendente desse tipo entre as duas gangs.");
  }

  const numero = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let rep: { id: string; nome: string; avatar: string | null } | null = null;
  const repId = (input.representante_id ?? "").trim().replace(/\D/g, "");
  if (input.tipo === "Alianca" && !repId) {
    throw new Error("Informe o ID do representante da aliança.");
  }
  if (repId) {
    const { fetchUsuarioDiscord } = await import("./discord.server");
    const u = await fetchUsuarioDiscord(repId);
    rep = {
      id: repId,
      nome: u ? (u.globalName || u.username) : repId,
      avatar: u?.avatarHash ?? null,
    };
  }

  const { error } = await db.from("gang_solicitacoes").insert({
    gang_origem_id: minha,
    gang_destino_id: input.gangId,
    tipo: input.tipo,
    status: "Pendente",
    motivo: input.motivo.trim() || null,
    data_evento: input.data_evento || null,
    horario: input.horario || null,
    local: input.local.trim() || null,
    membros_origem: numero(input.membros_origem),
    membros_destino: numero(input.membros_destino),
    criado_por: user.id,
    criado_por_nome: nomeUsuario(user),
    ...(rep
      ? {
          representante_id: rep.id,
          representante_nome: rep.nome,
          representante_avatar: rep.avatar,
        }
      : {}),
  });
  if (error) throw new Error(error.message);

  await avisarDiscord(user, input.gangId, {
    title:
      input.tipo === "Alianca"
        ? "🤝 Nova solicitação de aliança"
        : input.tipo === "Guerra"
          ? "⚔️ Declaração de guerra recebida"
          : "🏋️ Solicitação de treino amistoso",
    description: input.motivo.trim() || undefined,
    fields: [
      { name: "Enviado por", value: nomeUsuario(user), inline: true },
      ...(input.data_evento
        ? [{ name: "Data", value: input.data_evento, inline: true }]
        : []),
      ...(input.horario ? [{ name: "Horário", value: input.horario, inline: true }] : []),
      ...(input.local.trim() ? [{ name: "Local", value: input.local, inline: true }] : []),
    ],
    timestamp: new Date().toISOString(),
  });

  return { ok: true };
}

async function avisarDiscord(
  user: SessionUser,
  gangDestinoId: number,
  embed: {
    title: string;
    description?: string | undefined;
    fields?: { name: string; value: string; inline?: boolean }[];
    timestamp?: string;
  },
) {
  try {
    const { enviarMensagemCanal } = await import("./discord.server");
    const { buscarGangPorId } = await import("./gangs.server");
    const destino = await buscarGangPorId(gangDestinoId);
    const origem = user.gangId != null ? await buscarGangPorId(user.gangId) : null;
    const campos = [
      ...(embed.fields ?? []),
      { name: "Gang", value: origem?.nome ?? "—", inline: true },
    ];
    if (destino) {
      await enviarMensagemCanal(
        "canal_aliancas",
        { guildId: destino.guild_id, gangId: destino.id },
        { ...embed, fields: campos },
      );
    }
  } catch {
    /* best-effort */
  }
}

export async function responderSolicitacao(
  user: SessionUser,
  input: { id: number; aceitar: boolean },
) {
  assert(
    podeGerenciarParcerias(user),
    "Apenas Dono, Líder e Vice-Líder podem responder solicitações.",
  );
  const db = getDb();
  const minha = gid(user);

  const { data, error } = await db
    .from("gang_solicitacoes")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sol = data as SolicitacaoLinha | null;
  if (!sol) throw new Error("Solicitação não encontrada.");
  if (sol.gang_destino_id !== minha) {
    throw new Error("Só a gang que recebeu a solicitação pode respondê-la.");
  }
  if (sol.status !== "Pendente") throw new Error("Esta solicitação já foi respondida.");

  const patch: Record<string, unknown> = {
    status: input.aceitar ? "Aceita" : "Recusada",
    respondido_por: user.id,
    respondido_por_nome: nomeUsuario(user),
    respondido_em: new Date().toISOString(),
  };

  if (input.aceitar) {
    if (sol.tipo === "Alianca") {
      await definirRelacao(user, sol.gang_origem_id, "Aliada");
    } else if (sol.tipo === "Guerra") {
      await definirRelacao(user, sol.gang_origem_id, "Inimiga");
    } else if (sol.tipo === "Treino") {
      const ids = await criarTreinosAmistosos(sol, user);
      patch["treino_origem_id"] = ids.origem;
      patch["treino_destino_id"] = ids.destino;
    }
  }

  const { error: upErr } = await db
    .from("gang_solicitacoes")
    .update(patch)
    .eq("id", sol.id);
  if (upErr) throw new Error(upErr.message);

  await avisarDiscord(user, sol.gang_origem_id, {
    title: input.aceitar ? "✅ Solicitação aceita" : "❌ Solicitação recusada",
    fields: [
      { name: "Tipo", value: sol.tipo, inline: true },
      { name: "Respondido por", value: nomeUsuario(user), inline: true },
    ],
    timestamp: new Date().toISOString(),
  });

  return { ok: true };
}

/** Cria o treino amistoso espelhado nas duas gangs. */
async function criarTreinosAmistosos(
  sol: SolicitacaoLinha,
  user: SessionUser,
): Promise<{ origem: number | null; destino: number | null }> {
  const db = getDb();
  const { buscarGangPorId } = await import("./gangs.server");
  const [origem, destino] = await Promise.all([
    buscarGangPorId(sol.gang_origem_id),
    buscarGangPorId(sol.gang_destino_id),
  ]);

  const base = {
    data_treino: sol.data_evento ?? new Date().toISOString().slice(0, 10),
    horario: sol.horario,
    tipo: "Amistoso",
    local: sol.local,
    status: "Aberto",
  };

  const linhas = [
    {
      ...base,
      gang_id: sol.gang_origem_id,
      titulo: `Amistoso vs. ${destino?.nome ?? "gang adversária"}`,
      descricao: `${sol.motivo ? `${sol.motivo}\n` : ""}[ALIADO|${(destino?.nome ?? "").replace(/[|\]\n]/g, " ")}]`,
      criado_por: sol.criado_por,
    },
    {
      ...base,
      gang_id: sol.gang_destino_id,
      titulo: `Amistoso vs. ${origem?.nome ?? "gang adversária"}`,
      descricao: `${sol.motivo ? `${sol.motivo}\n` : ""}[ALIADO|${(origem?.nome ?? "").replace(/[|\]\n]/g, " ")}]`,
      criado_por: user.id,
    },
  ];

  const { data, error } = await db.from("treinos").insert(linhas).select("id_treino, gang_id");
  if (error) throw new Error(`Não consegui criar o treino amistoso: ${error.message}`);

  const criados = (data ?? []) as { id_treino: number; gang_id: number }[];
  return {
    origem: criados.find((t) => t.gang_id === sol.gang_origem_id)?.id_treino ?? null,
    destino: criados.find((t) => t.gang_id === sol.gang_destino_id)?.id_treino ?? null,
  };
}

export async function encerrarGuerra(user: SessionUser, input: { id: number }) {
  assert(podeGerenciarParcerias(user), "Apenas Dono, Líder e Vice-Líder podem encerrar guerras.");
  const db = getDb();
  const minha = gid(user);

  const { data, error } = await db
    .from("gang_solicitacoes")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sol = data as SolicitacaoLinha | null;
  if (!sol) throw new Error("Guerra não encontrada.");
  if (sol.gang_origem_id !== minha && sol.gang_destino_id !== minha) {
    throw new Error("Esta guerra não é da sua gang.");
  }

  const souOrigem = sol.gang_origem_id === minha;
  const meuCampo = souOrigem ? "encerrar_origem" : "encerrar_destino";
  const outroJaPediu = !!(souOrigem ? sol.encerrar_destino : sol.encerrar_origem);

  // Marca o pedido do meu lado; a guerra só encerra quando os dois lados pedem.
  const { error: marcaErr } = await db
    .from("gang_solicitacoes")
    .update({ [meuCampo]: true })
    .eq("id", sol.id);
  const colunaAusente =
    !!marcaErr && /encerrar_(origem|destino)|column .* does not exist|PGRST204/i.test(
      `${marcaErr.code ?? ""} ${marcaErr.message ?? ""}`,
    );
  if (marcaErr && !colunaAusente) throw new Error(marcaErr.message);

  if (!outroJaPediu && !colunaAusente) {
    return { ok: true, encerrada: false };
  }

  const { error: upErr } = await db
    .from("gang_solicitacoes")
    .update({ status: "Encerrada" })
    .eq("id", sol.id);
  if (upErr) throw new Error(upErr.message);

  const outra = sol.gang_origem_id === minha ? sol.gang_destino_id : sol.gang_origem_id;
  await limparRelacao(minha, outra);
  return { ok: true, encerrada: true };
}

export async function cancelarSolicitacao(user: SessionUser, input: { id: number }) {
  assert(podeGerenciarParcerias(user));
  const db = getDb();
  const minha = gid(user);
  const { error } = await db
    .from("gang_solicitacoes")
    .delete()
    .eq("id", input.id)
    .eq("gang_origem_id", minha)
    .eq("status", "Pendente");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Apaga uma solicitação do histórico da minha gang (guerras ativas não podem sumir). */
export async function excluirSolicitacao(user: SessionUser, input: { id: number }) {
  assert(podeGerenciarParcerias(user));
  const db = getDb();
  const minha = gid(user);

  const { data, error } = await db
    .from("gang_solicitacoes")
    .select("id, tipo, status, gang_origem_id, gang_destino_id")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sol = data as SolicitacaoLinha | null;
  if (!sol) return { ok: true };
  if (sol.gang_origem_id !== minha && sol.gang_destino_id !== minha) {
    throw new Error("Esta solicitação não é da sua gang.");
  }
  if (sol.tipo === "Guerra" && sol.status === "Aceita") {
    throw new Error("Encerre a guerra antes de apagar o registro.");
  }

  const { error: delErr } = await db.from("gang_solicitacoes").delete().eq("id", sol.id);
  if (delErr) throw new Error(delErr.message);
  return { ok: true };
}
