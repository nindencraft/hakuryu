import { getDb } from "./db.server";
import { normalizarLinkEvento } from "./event-link";
import {
  categoriaExploradorOuErro,
  normalizarEtiquetas,
  statusExploradorOuErro,
  type CategoriaExplorador,
  type EntradaServidorExplorador,
  type StatusExplorador,
} from "./explorador";
import type { SessionUserView } from "./permissions";

export type ServidorExplorador = {
  id: number;
  categoria: CategoriaExplorador;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  discordUrl: string;
  etiquetas: string[];
  status: StatusExplorador;
  motivoModeracao: string | null;
  responsavelDiscordId: string;
  responsavelNome: string;
  responsavelAvatarUrl: string;
  criadoEm: string;
  atualizadoEm: string;
};

type ServidorRow = {
  id: number;
  categoria: string;
  titulo: string;
  descricao: string;
  imagem_url: string;
  discord_url: string;
  etiquetas: string[] | null;
  status: string;
  motivo_moderacao: string | null;
  responsavel_discord_id: string;
  responsavel_nome: string;
  responsavel_avatar_url: string;
  criado_em: string;
  atualizado_em: string;
};

function paraServidor(row: ServidorRow): ServidorExplorador {
  return {
    id: row.id,
    categoria: categoriaExploradorOuErro(row.categoria),
    titulo: row.titulo,
    descricao: row.descricao,
    imagemUrl: row.imagem_url,
    discordUrl: row.discord_url,
    etiquetas: row.etiquetas ?? [],
    status: statusExploradorOuErro(row.status),
    motivoModeracao: row.motivo_moderacao,
    responsavelDiscordId: row.responsavel_discord_id,
    responsavelNome: row.responsavel_nome,
    responsavelAvatarUrl: row.responsavel_avatar_url,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function normalizarLinkDiscord(valor: string) {
  const url = normalizarLinkEvento(valor, "O convite do Discord");
  if (!url) return null;
  try {
    const destino = new URL(url);
    const host = destino.hostname.toLowerCase().replace(/^www\./, "");
    const conviteDireto = host === "discord.gg" && destino.pathname.replaceAll("/", "").length > 0;
    const conviteOficial = host === "discord.com" && destino.pathname.startsWith("/invite/");
    if (!conviteDireto && !conviteOficial) {
      throw new Error("Use um convite do Discord, como https://discord.gg/seu-servidor.");
    }
    return destino.toString();
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith("Use um convite")) throw erro;
    throw new Error("Informe um convite válido do Discord.");
  }
}

function validarEntrada(input: EntradaServidorExplorador) {
  const categoria = categoriaExploradorOuErro(input.categoria);
  const titulo = input.titulo.trim();
  const descricao = input.descricao.trim();
  const imagemUrl = normalizarLinkEvento(input.imagemUrl, "A URL do banner");
  const discordUrl = normalizarLinkDiscord(input.discordUrl);
  const etiquetas = normalizarEtiquetas(input.etiquetas);

  if (titulo.length < 3 || titulo.length > 100) throw new Error("O nome deve ter entre 3 e 100 caracteres.");
  if (descricao.length < 20 || descricao.length > 1_500) {
    throw new Error("A descrição deve ter entre 20 e 1500 caracteres.");
  }
  if (!imagemUrl || !discordUrl) throw new Error("Informe o banner e um convite válido do Discord.");
  if (etiquetas.length === 0) throw new Error("Informe pelo menos uma etiqueta para facilitar a busca.");
  return { categoria, titulo, descricao, imagemUrl, discordUrl, etiquetas };
}

export async function listarServidoresExploradorPublicos(): Promise<ServidorExplorador[]> {
  const { data, error } = await getDb()
    .from("servidores_explorador")
    .select("id, categoria, titulo, descricao, imagem_url, discord_url, etiquetas, status, motivo_moderacao, responsavel_discord_id, responsavel_nome, responsavel_avatar_url, criado_em, atualizado_em")
    .eq("status", "aprovado")
    .order("atualizado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ServidorRow[]).map(paraServidor);
}

export async function obterMeuServidorExplorador(discordId: string): Promise<ServidorExplorador | null> {
  const { data, error } = await getDb()
    .from("servidores_explorador")
    .select("id, categoria, titulo, descricao, imagem_url, discord_url, etiquetas, status, motivo_moderacao, responsavel_discord_id, responsavel_nome, responsavel_avatar_url, criado_em, atualizado_em")
    .eq("responsavel_discord_id", discordId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? paraServidor(data as ServidorRow) : null;
}

export async function salvarMeuServidorExplorador(user: SessionUserView, input: EntradaServidorExplorador) {
  const servidor = validarEntrada(input);
  const atual = await obterMeuServidorExplorador(user.id);
  const agora = new Date().toISOString();
  const status: StatusExplorador = input.solicitarPublicacao ? "pendente" : "pausado";
  const dados = {
    categoria: servidor.categoria,
    titulo: servidor.titulo,
    descricao: servidor.descricao,
    imagem_url: servidor.imagemUrl,
    discord_url: servidor.discordUrl,
    etiquetas: servidor.etiquetas,
    status,
    motivo_moderacao: null,
    responsavel_nome: user.globalName ?? user.username,
    responsavel_avatar_url: user.avatarUrl,
    atualizado_em: agora,
  };

  if (atual) {
    const { error } = await getDb()
      .from("servidores_explorador")
      .update(dados)
      .eq("id", atual.id)
      .eq("responsavel_discord_id", user.id);
    if (error) throw new Error(error.message);
    if (atual.imagemUrl !== servidor.imagemUrl) {
      const { deletarImagemR2PorUrl } = await import("./r2.server");
      await deletarImagemR2PorUrl(atual.imagemUrl);
    }
    return { ok: true, status };
  }

  const { error } = await getDb().from("servidores_explorador").insert({
    ...dados,
    responsavel_discord_id: user.id,
    criado_em: agora,
  });
  if (error) throw new Error(error.message);
  return { ok: true, status };
}

export async function listarServidoresExploradorAdmin(): Promise<ServidorExplorador[]> {
  const { data, error } = await getDb()
    .from("servidores_explorador")
    .select("id, categoria, titulo, descricao, imagem_url, discord_url, etiquetas, status, motivo_moderacao, responsavel_discord_id, responsavel_nome, responsavel_avatar_url, criado_em, atualizado_em")
    .order("atualizado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ServidorRow[]).map(paraServidor);
}

export async function moderarServidorExplorador(id: number, statusBruto: string, motivoBruto?: string | null) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Servidor inválido.");
  const status = statusExploradorOuErro(statusBruto);
  const motivo = (motivoBruto ?? "").trim();
  if (status === "recusado" && motivo.length < 3) {
    throw new Error("Explique o motivo da recusa para orientar o responsável.");
  }
  const { error } = await getDb()
    .from("servidores_explorador")
    .update({ status, motivo_moderacao: motivo || null, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function excluirServidorExploradorAdmin(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Servidor inválido.");
  const db = getDb();
  const anterior = await db.from("servidores_explorador").select("imagem_url").eq("id", id).maybeSingle();
  if (anterior.error) throw new Error(anterior.error.message);
  if (!anterior.data) throw new Error("Servidor não encontrado.");
  const { error } = await db.from("servidores_explorador").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const { deletarImagemR2PorUrl } = await import("./r2.server");
  await deletarImagemR2PorUrl(anterior.data.imagem_url);
  return { ok: true };
}

export async function excluirServidorExploradorAutorizado(user: SessionUserView, id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Servidor inválido.");
  const db = getDb();
  const { data: anterior, error: erroBusca } = await db
    .from("servidores_explorador")
    .select("imagem_url, responsavel_discord_id")
    .eq("id", id)
    .maybeSingle();
  if (erroBusca) throw new Error(erroBusca.message);
  if (!anterior) throw new Error("Servidor não encontrado.");
  if (!user.isSuperOwner && anterior.responsavel_discord_id !== user.id) {
    throw new Error("Você não tem permissão para excluir este servidor.");
  }

  const { error } = await db.from("servidores_explorador").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const { deletarImagemR2PorUrl } = await import("./r2.server");
  await deletarImagemR2PorUrl(anterior.imagem_url);
  return { ok: true };
}
