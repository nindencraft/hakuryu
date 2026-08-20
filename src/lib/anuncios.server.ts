import { getDb } from "./db.server";
import { categoriaAnuncioOuErro, type CategoriaAnuncio } from "./anuncios";
import { normalizarLinkEvento } from "./event-link";

export type AnuncioComunidade = {
  id: number;
  categoria: CategoriaAnuncio;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  discordUrl: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type EntradaAnuncioComunidade = {
  id?: number | null;
  categoria: CategoriaAnuncio;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  discordUrl: string;
  ativo: boolean;
};

type AnuncioRow = {
  id: number;
  categoria: string;
  titulo: string;
  descricao: string;
  imagem_url: string;
  discord_url: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

function paraAnuncio(row: AnuncioRow): AnuncioComunidade {
  return {
    id: row.id,
    categoria: categoriaAnuncioOuErro(row.categoria),
    titulo: row.titulo,
    descricao: row.descricao,
    imagemUrl: row.imagem_url,
    discordUrl: row.discord_url,
    ativo: row.ativo,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function validarEntrada(input: EntradaAnuncioComunidade) {
  const categoria = categoriaAnuncioOuErro(input.categoria);
  const titulo = input.titulo.trim();
  const descricao = input.descricao.trim();
  const imagemUrl = normalizarLinkEvento(input.imagemUrl, "A URL da imagem do anúncio");
  const discordUrl = normalizarLinkEvento(input.discordUrl, "O link do Discord do anúncio");

  if (titulo.length < 3 || titulo.length > 100) {
    throw new Error("O título do anúncio deve ter entre 3 e 100 caracteres.");
  }
  if (descricao.length < 10 || descricao.length > 500) {
    throw new Error("A descrição do anúncio deve ter entre 10 e 500 caracteres.");
  }
  if (!imagemUrl || !discordUrl) {
    throw new Error("Informe uma URL válida para a imagem e o Discord do anúncio.");
  }

  return { categoria, titulo, descricao, imagemUrl, discordUrl, ativo: Boolean(input.ativo) };
}

export async function listarAnunciosPublicos(): Promise<AnuncioComunidade[]> {
  const { data, error } = await getDb()
    .from("anuncios_comunidade")
    .select(
      "id, categoria, titulo, descricao, imagem_url, discord_url, ativo, criado_em, atualizado_em",
    )
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as AnuncioRow[]).map(paraAnuncio);
}

export async function listarAnunciosAdmin(): Promise<AnuncioComunidade[]> {
  const { data, error } = await getDb()
    .from("anuncios_comunidade")
    .select(
      "id, categoria, titulo, descricao, imagem_url, discord_url, ativo, criado_em, atualizado_em",
    )
    .order("ativo", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as AnuncioRow[]).map(paraAnuncio);
}

export async function salvarAnuncio(input: EntradaAnuncioComunidade) {
  const anuncio = validarEntrada(input);
  const db = getDb();
  const atualizadoEm = new Date().toISOString();

  if (input.id == null) {
    const { error } = await db.from("anuncios_comunidade").insert({
      categoria: anuncio.categoria,
      titulo: anuncio.titulo,
      descricao: anuncio.descricao,
      imagem_url: anuncio.imagemUrl,
      discord_url: anuncio.discordUrl,
      ativo: anuncio.ativo,
      atualizado_em: atualizadoEm,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  if (!Number.isInteger(input.id) || input.id < 1) throw new Error("Anúncio inválido.");
  const { error } = await db
    .from("anuncios_comunidade")
    .update({
      categoria: anuncio.categoria,
      titulo: anuncio.titulo,
      descricao: anuncio.descricao,
      imagem_url: anuncio.imagemUrl,
      discord_url: anuncio.discordUrl,
      ativo: anuncio.ativo,
      atualizado_em: atualizadoEm,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function excluirAnuncio(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Anúncio inválido.");
  const { error } = await getDb().from("anuncios_comunidade").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
