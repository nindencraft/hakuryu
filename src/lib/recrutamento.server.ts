import { getDb } from "./db.server";
import { garantirConviteInfinito } from "./discord.server";
import { normalizarLinkEvento } from "./event-link";
import { descricaoRecrutamentoValida, linkPublicoRecrutamento, type EntradaRecrutamentoGang } from "./recrutamento";
import { podeGerenciarRecrutamento, type SessionUser } from "./session.server";

type LinhaRecrutamento = {
  gang_id: number;
  imagem_url: string;
  descricao: string;
  convite_automatico_url: string | null;
  link_servidor_manual: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

type LinhaGang = { id: number; nome: string; guild_id: string; ativo: boolean };

export type RecrutamentoGang = {
  gangId: number;
  gangNome: string;
  imagemUrl: string;
  descricao: string;
  discordUrl: string;
  ativo: boolean;
  linkServidorManual: string | null;
  conviteAutomaticoUrl: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

function paraRecrutamento(linha: LinhaRecrutamento, gang: LinhaGang): RecrutamentoGang | null {
  const discordUrl = linkPublicoRecrutamento(linha.link_servidor_manual, linha.convite_automatico_url);
  if (!discordUrl) return null;
  return {
    gangId: linha.gang_id,
    gangNome: gang.nome,
    imagemUrl: linha.imagem_url,
    descricao: linha.descricao,
    discordUrl,
    ativo: linha.ativo,
    linkServidorManual: linha.link_servidor_manual,
    conviteAutomaticoUrl: linha.convite_automatico_url,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

async function buscarGang(gangId: number): Promise<LinhaGang> {
  const { data, error } = await getDb()
    .from("gangs")
    .select("id, nome, guild_id, ativo")
    .eq("id", gangId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.ativo) throw new Error("A gang selecionada não está ativa.");
  return data as LinhaGang;
}

export async function listarRecrutamentosPublicos(): Promise<RecrutamentoGang[]> {
  const { data, error } = await getDb()
    .from("recrutamentos_gang")
    .select("gang_id, imagem_url, descricao, convite_automatico_url, link_servidor_manual, ativo, criado_em, atualizado_em")
    .eq("ativo", true)
    .order("atualizado_em", { ascending: false });
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as LinhaRecrutamento[];
  if (linhas.length === 0) return [];
  const { data: gangs, error: erroGangs } = await getDb()
    .from("gangs")
    .select("id, nome, guild_id, ativo")
    .in("id", linhas.map((linha) => linha.gang_id))
    .eq("ativo", true);
  if (erroGangs) throw new Error(erroGangs.message);
  const porId = new Map(((gangs ?? []) as LinhaGang[]).map((gang) => [gang.id, gang]));
  return linhas.flatMap((linha) => {
    const gang = porId.get(linha.gang_id);
    const recrutamento = gang ? paraRecrutamento(linha, gang) : null;
    return recrutamento ? [recrutamento] : [];
  });
}

export async function obterRecrutamentoDaGang(gangId: number): Promise<RecrutamentoGang | null> {
  const gang = await buscarGang(gangId);
  const { data, error } = await getDb()
    .from("recrutamentos_gang")
    .select("gang_id, imagem_url, descricao, convite_automatico_url, link_servidor_manual, ativo, criado_em, atualizado_em")
    .eq("gang_id", gangId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? paraRecrutamento(data as LinhaRecrutamento, gang) : null;
}

export async function salvarRecrutamentoDaGang(
  usuario: SessionUser,
  entrada: EntradaRecrutamentoGang,
): Promise<RecrutamentoGang> {
  if (!podeGerenciarRecrutamento(usuario)) {
    throw new Error("Você não tem permissão para gerenciar o recrutamento da gang.");
  }
  if (usuario.gangId == null) throw new Error("Selecione uma gang antes de gerenciar o recrutamento.");

  const imagemUrl = normalizarLinkEvento(entrada.imagemUrl, "A URL da imagem do recrutamento");
  const linkServidorManual = normalizarLinkEvento(
    entrada.linkServidorManual,
    "O link manual do servidor Discord",
  );
  if (!imagemUrl) throw new Error("Informe uma URL pública para a imagem do recrutamento.");
  if (!descricaoRecrutamentoValida(entrada.descricao)) {
    throw new Error("A descrição do recrutamento deve ter entre 10 e 500 caracteres.");
  }

  const gang = await buscarGang(usuario.gangId);
  const db = getDb();
  const anterior = await db
    .from("recrutamentos_gang")
    .select("imagem_url")
    .eq("gang_id", gang.id)
    .maybeSingle();
  if (anterior.error) throw new Error(anterior.error.message);
  const existente = await obterRecrutamentoDaGang(gang.id);
  let conviteAutomaticoUrl = existente?.conviteAutomaticoUrl ?? null;

  // Quando não há link manual, o botão Salvar garante um convite permanente pronto
  // para os visitantes; o fluxo não chama a API Discord ao abrir a vitrine pública.
  if (!linkServidorManual) {
    conviteAutomaticoUrl = await garantirConviteInfinito(gang.guild_id);
    if (!conviteAutomaticoUrl) {
      throw new Error("Não foi possível criar ou localizar o convite infinito desta gang.");
    }
  }

  const agora = new Date().toISOString();
  const registro = {
    gang_id: gang.id,
    imagem_url: imagemUrl,
    descricao: entrada.descricao.trim(),
    convite_automatico_url: conviteAutomaticoUrl,
    link_servidor_manual: linkServidorManual,
    ativo: Boolean(entrada.ativo),
    atualizado_em: agora,
  };
  const { error } = existente
    ? await db.from("recrutamentos_gang").update(registro).eq("gang_id", gang.id)
    : await db.from("recrutamentos_gang").insert({ ...registro, criado_em: agora });
  if (error) throw new Error(error.message);
  if (anterior.data?.imagem_url && anterior.data.imagem_url !== imagemUrl) {
    const { deletarImagemR2PorUrl } = await import("./r2.server");
    await deletarImagemR2PorUrl(anterior.data.imagem_url);
  }

  const salvo = await obterRecrutamentoDaGang(gang.id);
  if (!salvo) throw new Error("Não foi possível carregar o anúncio de recrutamento salvo.");
  return salvo;
}

export async function excluirRecrutamentoDaGang(usuario: SessionUser, gangId: number) {
  if (!Number.isInteger(gangId) || gangId < 1) throw new Error("Recrutamento inválido.");
  const podeExcluirDaGangAtiva = usuario.gangId === gangId && podeGerenciarRecrutamento(usuario);
  if (!usuario.isSuperOwner && !podeExcluirDaGangAtiva) {
    throw new Error("Você não tem permissão para excluir este recrutamento.");
  }

  const db = getDb();
  const { data: anterior, error: erroBusca } = await db
    .from("recrutamentos_gang")
    .select("imagem_url")
    .eq("gang_id", gangId)
    .maybeSingle();
  if (erroBusca) throw new Error(erroBusca.message);
  if (!anterior) throw new Error("Recrutamento não encontrado.");

  const { error } = await db.from("recrutamentos_gang").delete().eq("gang_id", gangId);
  if (error) throw new Error(error.message);

  const { deletarImagemR2PorUrl } = await import("./r2.server");
  await deletarImagemR2PorUrl(anterior.imagem_url);
  return { ok: true };
}
