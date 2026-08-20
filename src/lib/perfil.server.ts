import { getDb } from "./db.server";
import {
  FICHA_RPG_VAZIA,
  normalizarFichaRPG,
  normalizarTotaisAtividade,
  somarTotaisAtividade,
  type FichaRPG,
  type FichaRPGInput,
  type TotaisAtividadePerfil,
} from "./perfil";
import type { SessionUser } from "./session.server";

type LinhaMembro = {
  gang_id: number;
  cargo: string | null;
  data_entrada: string | null;
};

type LinhaFichaRPG = {
  nome_roblox: string | null;
  nome_rp: string | null;
  genero: string | null;
  altura_jogo: number | null;
  estilo_luta_principal: string | null;
};

type LinhaGang = { id: number; nome: string; guild_id: string | null };

type LinhaHistorico = {
  id: number;
  gang_id: number;
  gang_nome: string;
  gang_guild_id: string | null;
  cargo_final: string | null;
  entrou_em: string;
  saiu_em: string | null;
  treinos_participados: number;
  amistosos_participados: number;
  guerras_participadas: number;
};

export type GangNoPerfil = {
  gangId: number;
  gangNome: string;
  guildId: string | null;
  cargo: string | null;
  entrouEm: string;
  saiuEm: string | null;
  atividade: TotaisAtividadePerfil;
};

export type PerfilJogador = {
  jogador: {
    discordId: string;
    username: string;
    globalName: string | null;
    avatarUrl: string;
    nomeRp: string | null;
  };
  ficha: FichaRPG;
  gangsAtuais: GangNoPerfil[];
  gangsAnteriores: GangNoPerfil[];
  atividade: TotaisAtividadePerfil;
  historicoDisponivel: boolean;
};

function tabelaPodeEstarAusente(error: { message?: string; code?: string } | null): boolean {
  const mensagem = error?.message ?? "";
  return error?.code === "42P01" || /does not exist|schema cache|could not find the table/i.test(mensagem);
}

/** Lê a ficha global do jogador, independentemente da gang selecionada. */
export async function buscarFichaRPG(discordId: string): Promise<FichaRPG> {
  const { data, error } = await getDb()
    .from("perfis_jogador")
    .select("nome_roblox, nome_rp, genero, altura_jogo, estilo_luta_principal")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) {
    if (tabelaPodeEstarAusente(error)) return FICHA_RPG_VAZIA;
    throw new Error(error.message);
  }
  if (!data) return FICHA_RPG_VAZIA;
  const ficha = data as LinhaFichaRPG;
  return {
    nome_roblox: ficha.nome_roblox ?? null,
    nome_rp: ficha.nome_rp ?? null,
    genero: ficha.genero === "Masculino" || ficha.genero === "Feminino" ? ficha.genero : null,
    altura_jogo: ficha.altura_jogo != null ? Number(ficha.altura_jogo) : null,
    estilo_luta_principal: ficha.estilo_luta_principal as FichaRPG["estilo_luta_principal"],
  };
}

/** Atualiza a ficha do próprio usuário e replica os dados nas gangs cadastradas. */
export async function atualizarFichaRPG(user: SessionUser, input: FichaRPGInput): Promise<FichaRPG> {
  const ficha = normalizarFichaRPG(input);
  const db = getDb();
  const { error: erroPerfil } = await db.from("perfis_jogador").upsert(
    {
      discord_id: user.id,
      discord_username: user.username,
      ...ficha,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "discord_id" },
  );
  if (erroPerfil) throw new Error(erroPerfil.message);
  const { error: erroMembros } = await db.from("membros").update(ficha).eq("discord_id", user.id);
  if (erroMembros) throw new Error(erroMembros.message);
  return ficha;
}

async function contarAtividadeDaGang(discordId: string, gangId: number): Promise<TotaisAtividadePerfil> {
  const db = getDb();
  let treinos = 0;
  let amistosos = 0;
  let guerras = 0;

  try {
    const { data: presencas, error: erroPresencas } = await db
      .from("presencas_treino")
      .select("treino_id, treinos!inner(tipo)")
      .eq("gang_id", gangId)
      .eq("membro_id", discordId)
      .eq("presenca", "Presente");
    if (erroPresencas) throw erroPresencas;

    for (const linha of (presencas ?? []) as { treinos: { tipo: string } | { tipo: string }[] }[]) {
      const treino = Array.isArray(linha.treinos) ? linha.treinos[0] : linha.treinos;
      if (treino?.tipo === "Amistoso") amistosos += 1;
      else treinos += 1;
    }
  } catch (error) {
    if (!tabelaPodeEstarAusente(error as { message?: string; code?: string })) throw error;
  }

  try {
    const { data, error } = await db
      .from("participacoes_guerra")
      .select("membro_id")
      .eq("gang_id", gangId)
      .eq("membro_id", discordId);
    if (error) throw error;
    guerras = data?.length ?? 0;
  } catch (error) {
    if (!tabelaPodeEstarAusente(error as { message?: string; code?: string })) throw error;
  }

  return normalizarTotaisAtividade({ treinos, amistosos, guerras });
}

export async function encerrarHistoricoDeMembro(gangId: number, discordId: string): Promise<void> {
  const db = getDb();
  const atividade = await contarAtividadeDaGang(discordId, gangId);
  const { error } = await db
    .from("historico_gangs_jogador")
    .update({
      saiu_em: new Date().toISOString(),
      treinos_participados: atividade.treinos,
      amistosos_participados: atividade.amistosos,
      guerras_participadas: atividade.guerras,
    })
    .eq("discord_id", discordId)
    .eq("gang_id", gangId)
    .is("saiu_em", null);

  if (error && !tabelaPodeEstarAusente(error)) throw new Error(error.message);
}

export async function encerrarHistoricosDaGang(gangId: number): Promise<void> {
  const db = getDb();
  const { data: membros, error } = await db.from("membros").select("discord_id").eq("gang_id", gangId);
  if (error) throw new Error(error.message);
  for (const membro of (membros ?? []) as { discord_id: string }[]) {
    await encerrarHistoricoDeMembro(gangId, membro.discord_id);
  }
}

export async function obterPerfilJogador(user: SessionUser): Promise<PerfilJogador> {
  const db = getDb();
  const { data: membros, error: erroMembros } = await db
    .from("membros")
    .select("gang_id, cargo, data_entrada")
    .eq("discord_id", user.id);
  if (erroMembros) throw new Error(erroMembros.message);

  const linhasMembros = (membros ?? []) as LinhaMembro[];
  const ficha = await buscarFichaRPG(user.id);
  const gangIds = [...new Set(linhasMembros.map((membro) => membro.gang_id))];
  const { data: gangs, error: erroGangs } = gangIds.length
    ? await db.from("gangs").select("id, nome, guild_id").in("id", gangIds)
    : { data: [], error: null };
  if (erroGangs) throw new Error(erroGangs.message);
  const gangPorId = new Map(((gangs ?? []) as LinhaGang[]).map((gang) => [gang.id, gang]));

  let linhasHistorico: LinhaHistorico[] = [];
  let historicoDisponivel = true;
  const { data: historico, error: erroHistorico } = await db
    .from("historico_gangs_jogador")
    .select("id, gang_id, gang_nome, gang_guild_id, cargo_final, entrou_em, saiu_em, treinos_participados, amistosos_participados, guerras_participadas")
    .eq("discord_id", user.id)
    .not("saiu_em", "is", null)
    .order("saiu_em", { ascending: false });
  if (erroHistorico) {
    if (!tabelaPodeEstarAusente(erroHistorico)) throw new Error(erroHistorico.message);
    historicoDisponivel = false;
  } else {
    linhasHistorico = (historico ?? []) as LinhaHistorico[];
  }

  const gangsAtuais = await Promise.all(linhasMembros.map(async (membro) => {
    const gang = gangPorId.get(membro.gang_id);
    return {
      gangId: membro.gang_id,
      gangNome: gang?.nome ?? "Gang registrada",
      guildId: gang?.guild_id ?? null,
      cargo: membro.cargo,
      entrouEm: membro.data_entrada ?? new Date().toISOString(),
      saiuEm: null,
      atividade: await contarAtividadeDaGang(user.id, membro.gang_id),
    } satisfies GangNoPerfil;
  }));

  const gangsAnteriores = linhasHistorico.map((linha) => ({
    gangId: linha.gang_id,
    gangNome: linha.gang_nome,
    guildId: linha.gang_guild_id,
    cargo: linha.cargo_final,
    entrouEm: linha.entrou_em,
    saiuEm: linha.saiu_em,
    atividade: normalizarTotaisAtividade({
      treinos: linha.treinos_participados,
      amistosos: linha.amistosos_participados,
      guerras: linha.guerras_participadas,
    }),
  } satisfies GangNoPerfil));

  return {
    jogador: {
      discordId: user.id,
      username: user.username,
      globalName: user.globalName,
      avatarUrl: user.avatarUrl,
      nomeRp: ficha.nome_rp ?? user.nomeRp,
    },
    ficha,
    gangsAtuais,
    gangsAnteriores,
    atividade: somarTotaisAtividade([...gangsAtuais.map((gang) => gang.atividade), ...gangsAnteriores.map((gang) => gang.atividade)]),
    historicoDisponivel,
  };
}
