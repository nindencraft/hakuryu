import { getDb } from "./db.server";

export type Gang = {
  id: number;
  nome: string;
  guild_id: string;
  ativo: boolean;
  lider_id: string | null;
  criado_em: string;
  criado_por: string | null;
};

export async function buscarGangPorId(gangId: number): Promise<Gang | null> {
  const db = getDb();

  const { data, error } = await db
    .from("gangs")
    .select("*")
    .eq("id", gangId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar gang: ${error.message}`);
  }

  return (data as Gang | null) ?? null;
}

export async function buscarGangPorGuildId(
  guildId: string,
): Promise<Gang | null> {
  const db = getDb();

  const { data, error } = await db
    .from("gangs")
    .select("*")
    .eq("guild_id", guildId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar gang pelo servidor: ${error.message}`);
  }

  return (data as Gang | null) ?? null;
}

export async function listarGangs(): Promise<Gang[]> {
  const db = getDb();

  const { data, error } = await db
    .from("gangs")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar gangs: ${error.message}`);
  }

  return (data as Gang[]) ?? [];
}

export async function listarGangsAtivas(): Promise<Gang[]> {
  const db = getDb();

  const { data, error } = await db
    .from("gangs")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar gangs ativas: ${error.message}`);
  }

  return (data as Gang[]) ?? [];
}

export async function listarGangsDoUsuario(
  guildIds: string[],
): Promise<Gang[]> {
  if (guildIds.length === 0) {
    return [];
  }

  const db = getDb();

  const { data, error } = await db
    .from("gangs")
    .select("*")
    .in("guild_id", guildIds)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(
      `Erro ao listar gangs do usuário: ${error.message}`,
    );
  }

  return (data as Gang[]) ?? [];
}

export async function criarGang(params: {
  nome: string;
  guildId: string;
  liderId?: string | null;
  criadoPor?: string | null;
}): Promise<Gang> {
  const db = getDb();

  const nome = params.nome.trim();
  const guildId = params.guildId.trim();
  const liderId = params.liderId?.trim() || null;
  const criadoPor = params.criadoPor?.trim() || null;

  if (!nome) {
    throw new Error("O nome da gang é obrigatório.");
  }

  if (!guildId) {
    throw new Error("O ID do servidor Discord é obrigatório.");
  }

  const existente = await buscarGangPorGuildId(guildId);

  if (existente) {
    throw new Error(
      `Este servidor Discord já está associado à gang "${existente.nome}".`,
    );
  }

  const { data, error } = await db
    .from("gangs")
    .insert({
      nome,
      guild_id: guildId,
      ativo: true,
      lider_id: liderId,
      criado_por: criadoPor,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar gang: ${error.message}`);
  }

  return data as Gang;
}

export async function atualizarGang(
  gangId: number,
  dados: {
    nome?: string;
    guildId?: string;
    liderId?: string | null;
    ativo?: boolean;
  },
): Promise<Gang> {
  const db = getDb();

  const update: Record<string, unknown> = {};

  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();

    if (!nome) {
      throw new Error("O nome da gang não pode ficar vazio.");
    }

    update["nome"] = nome;
  }

  if (dados.guildId !== undefined) {
    const guildId = dados.guildId.trim();

    if (!guildId) {
      throw new Error("O ID do servidor Discord não pode ficar vazio.");
    }

    update["guild_id"] = guildId;
  }

  if (dados.liderId !== undefined) {
    update["lider_id"] = dados.liderId?.trim() || null;
  }

  if (dados.ativo !== undefined) {
    update["ativo"] = dados.ativo;
  }

  if (Object.keys(update).length === 0) {
    const gang = await buscarGangPorId(gangId);

    if (!gang) {
      throw new Error("Gang não encontrada.");
    }

    return gang;
  }

  const { data, error } = await db
    .from("gangs")
    .update(update)
    .eq("id", gangId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar gang: ${error.message}`);
  }

  return data as Gang;
}

export async function definirLiderGang(
  gangId: number,
  discordId: string | null,
): Promise<Gang> {
  return atualizarGang(gangId, {
    liderId: discordId,
  });
}

export async function desativarGang(gangId: number): Promise<Gang> {
  return atualizarGang(gangId, {
    ativo: false,
  });
}

export async function ativarGang(gangId: number): Promise<Gang> {
  return atualizarGang(gangId, {
    ativo: true,
  });
}

export async function ehLiderDaGang(
  gangId: number,
  discordId: string,
): Promise<boolean> {
  const gang = await buscarGangPorId(gangId);

  if (!gang || !gang.ativo) {
    return false;
  }

  return gang.lider_id === discordId;
}

export async function gangDoServidor(
  guildId: string,
): Promise<Gang | null> {
  return buscarGangPorGuildId(guildId);
}

function tabelaPodeEstarAusente(error: { message?: string; code?: string } | null): boolean {
  const mensagem = error?.message ?? "";
  return error?.code === "42P01" || /does not exist|schema cache|could not find the table/i.test(mensagem);
}

async function apagarRegistrosDaGang(db: ReturnType<typeof getDb>, tabela: string, gangId: number) {
  const { error } = await db.from(tabela).delete().eq("gang_id", gangId);
  if (error && !tabelaPodeEstarAusente(error)) {
    throw new Error(`Não foi possível limpar ${tabela}: ${error.message}`);
  }
}

export async function excluirGang(gangId: number): Promise<{ ok: true }> {
  const db = getDb();
  const gang = await buscarGangPorId(gangId);
  if (!gang) throw new Error("Gang não encontrada.");

  const { encerrarHistoricosDaGang } = await import("./perfil.server");
  await encerrarHistoricosDaGang(gangId);

  const removerRelacoes = async (tabela: string, filtro: string) => {
    const { error } = await db.from(tabela).delete().or(filtro);
    if (error && !tabelaPodeEstarAusente(error)) {
      throw new Error(`Não foi possível limpar ${tabela}: ${error.message}`);
    }
  };

  await removerRelacoes("gang_relacoes", `gang_a_id.eq.${gangId},gang_b_id.eq.${gangId}`);
  await removerRelacoes(
    "gang_solicitacoes",
    `gang_origem_id.eq.${gangId},gang_destino_id.eq.${gangId}`,
  );

  for (const tabela of [
    "avaliacoes_treino",
    "avaliacoes_lideranca",
    "votos_recrutamento",
    "historico_atributos_membro",
    "membro_atributos",
    "presencas_treino",
    "participacoes_guerra",
    "punicoes",
    "treinos_internos",
    "treinos_amistosos",
    "treinos",
    "guerras",
    "inimigos",
    "parcerias",
    "logs_partidas",
    "config_cargos",
    "gang_config",
  ]) {
    await apagarRegistrosDaGang(db, tabela, gangId);
  }

  const { error: erroLideranca } = await db
    .from("divisoes")
    .update({ lider_id: null, vice_lider_id: null })
    .eq("gang_id", gangId);
  if (erroLideranca && !tabelaPodeEstarAusente(erroLideranca)) {
    throw new Error(`Não foi possível liberar lideranças: ${erroLideranca.message}`);
  }

  await apagarRegistrosDaGang(db, "membros", gangId);
  await apagarRegistrosDaGang(db, "divisoes", gangId);

  const { error } = await db.from("gangs").delete().eq("id", gangId);
  if (error) throw new Error(`Não foi possível excluir a gang: ${error.message}`);
  return { ok: true };
}
