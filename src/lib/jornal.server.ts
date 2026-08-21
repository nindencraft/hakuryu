import { currentUser, getDb } from "./db.server";
import { fetchUsuarioDiscord } from "./discord.server";
import { normalizarLinkEvento } from "./event-link";
import { podeEditarNoticia, podePublicarNoticia } from "./jornal.permissoes";
import { ehSuperOwner } from "./settings.server";

export type AutorNoticia = {
  discordId: string;
  nome: string;
  avatarUrl: string | null;
};

export type NoticiaPublica = {
  id: number;
  titulo: string;
  imagemUrl: string;
  descricao: string;
  publicadaEm: string;
  autor: AutorNoticia;
};

export type WarnJornalista = {
  id: number;
  motivo: string;
  criadoEm: string;
  criadoPor: string;
  revogadoEm: string | null;
  revogadoPor: string | null;
};

export type JornalistaAdmin = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  ativo: boolean;
  adicionadoEm: string;
  quantidadeWarns: number;
  quantidadeNoticias: number;
  noticias: Array<{ id: number; titulo: string; publicadaEm: string }>;
  warns: WarnJornalista[];
};

type JornalistaRow = {
  discord_id: string;
  discord_username: string;
  global_name: string | null;
  avatar_hash: string | null;
  ativo: boolean;
  adicionado_em: string;
};

type NoticiaRow = {
  id: number;
  titulo: string;
  imagem_url: string;
  descricao: string;
  publicada_em: string;
  autor_discord_id: string;
  autor_nome: string;
  autor_avatar_url: string | null;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

function avatarDiscord(discordId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return `https://cdn.discordapp.com/embed/avatars/${Number(discordId) % 5}.png`;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=128`;
}

async function usuarioAtual(request: Request) {
  const user = await currentUser(request);
  if (!user) throw new Error("NAO_AUTENTICADO");
  return { user, isSuperOwner: ehSuperOwner(user.id) };
}

async function requireSuperOwnerJornal(request: Request) {
  const contexto = await usuarioAtual(request);
  if (!contexto.isSuperOwner) throw new Error("Apenas o Super Owner acessa a administração do jornal.");
  return contexto;
}

async function jornalistaAtivo(discordId: string): Promise<JornalistaRow | null> {
  const db = getDb();
  const res = await db
    .from("jornalistas")
    .select("discord_id, discord_username, global_name, avatar_hash, ativo, adicionado_em")
    .eq("discord_id", discordId)
    .eq("ativo", true)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as JornalistaRow | null) ?? null;
}

export async function listarNoticiasPublicas(): Promise<NoticiaPublica[]> {
  const db = getDb();
  const rows = unwrap(
    await db
      .from("noticias")
      .select("id, titulo, imagem_url, descricao, publicada_em, autor_discord_id, autor_nome, autor_avatar_url")
      .order("publicada_em", { ascending: false })
      .limit(60),
  ) as NoticiaRow[];

  return rows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    imagemUrl: row.imagem_url,
    descricao: row.descricao,
    publicadaEm: row.publicada_em,
    autor: {
      discordId: row.autor_discord_id,
      nome: row.autor_nome,
      avatarUrl: row.autor_avatar_url,
    },
  }));
}

export async function permissaoJornal(request: Request) {
  const { user, isSuperOwner } = await usuarioAtual(request);
  const jornalista = await jornalistaAtivo(user.id);
  return {
    podePublicar: podePublicarNoticia({ isSuperOwner, jornalistaAtivo: jornalista != null }),
    isSuperOwner,
    jornalistaAtivo: jornalista != null,
    usuarioDiscordId: user.id,
  };
}

function validarConteudoNoticia(input: { titulo: string; imagemUrl: string; descricao: string }) {
  const titulo = input.titulo.trim();
  const descricao = input.descricao.trim();
  const imagemUrl = normalizarLinkEvento(input.imagemUrl, "A URL da imagem principal");
  if (titulo.length < 3 || titulo.length > 180) {
    throw new Error("O título deve ter entre 3 e 180 caracteres.");
  }
  if (descricao.length < 10 || descricao.length > 10_000) {
    throw new Error("A descrição deve ter entre 10 e 10.000 caracteres.");
  }
  if (!imagemUrl) throw new Error("Informe uma URL válida para a imagem principal.");
  return { titulo, descricao, imagemUrl };
}

async function buscarNoticiaParaPermissao(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Notícia inválida.");
  const db = getDb();
  const res = await db.from("noticias").select("id, autor_discord_id, imagem_url").eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) throw new Error("A reportagem não foi encontrada.");
  return res.data as { id: number; autor_discord_id: string; imagem_url: string };
}

export async function criarNoticia(
  request: Request,
  input: { titulo: string; imagemUrl: string; descricao: string },
) {
  const { user, isSuperOwner } = await usuarioAtual(request);
  const jornalista = await jornalistaAtivo(user.id);
  if (!podePublicarNoticia({ isSuperOwner, jornalistaAtivo: jornalista != null })) {
    throw new Error("Somente jornalistas ativos ou o Super Owner podem publicar notícias.");
  }

  const { titulo, descricao, imagemUrl } = validarConteudoNoticia(input);

  const autorNome = jornalista?.global_name || jornalista?.discord_username || user.globalName || user.username;
  const autorAvatarUrl = jornalista
    ? avatarDiscord(jornalista.discord_id, jornalista.avatar_hash)
    : user.avatarUrl ?? null;
  const db = getDb();
  unwrap(
    await db.from("noticias").insert({
      titulo,
      imagem_url: imagemUrl,
      descricao,
      jornalista_id: jornalista?.discord_id ?? null,
      autor_discord_id: user.id,
      autor_nome: autorNome,
      autor_avatar_url: autorAvatarUrl,
    }),
  );
  return { ok: true };
}

export async function editarNoticia(
  request: Request,
  input: { id: number; titulo: string; imagemUrl: string; descricao: string },
) {
  const { user, isSuperOwner } = await usuarioAtual(request);
  const [jornalista, noticia] = await Promise.all([
    jornalistaAtivo(user.id),
    buscarNoticiaParaPermissao(input.id),
  ]);
  if (
    !podeEditarNoticia({
      isSuperOwner,
      jornalistaAtivo: jornalista != null,
      autorDiscordId: noticia.autor_discord_id,
      usuarioDiscordId: user.id,
    })
  ) {
    throw new Error("Você só pode editar reportagens publicadas por você.");
  }

  const { titulo, descricao, imagemUrl } = validarConteudoNoticia(input);
  const res = await getDb()
    .from("noticias")
    .update({ titulo, imagem_url: imagemUrl, descricao })
    .eq("id", noticia.id);
  if (res.error) throw new Error(res.error.message);
  if (noticia.imagem_url !== imagemUrl) {
    const { deletarImagemR2PorUrl } = await import("./r2.server");
    await deletarImagemR2PorUrl(noticia.imagem_url);
  }
  return { ok: true };
}

export async function excluirNoticia(request: Request, id: number) {
  await requireSuperOwnerJornal(request);
  if (!Number.isInteger(id) || id < 1) throw new Error("Notícia inválida.");
  const db = getDb();
  const anterior = await db.from("noticias").select("imagem_url").eq("id", id).maybeSingle();
  if (anterior.error) throw new Error(anterior.error.message);
  if (!anterior.data) throw new Error("A reportagem não foi encontrada.");
  const res = await db.from("noticias").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
  const { deletarImagemR2PorUrl } = await import("./r2.server");
  await deletarImagemR2PorUrl(anterior.data.imagem_url);
  return { ok: true };
}

export async function listarJornalistasAdmin(request: Request): Promise<JornalistaAdmin[]> {
  await requireSuperOwnerJornal(request);
  const db = getDb();
  const jornalistas = unwrap(
    await db
      .from("jornalistas")
      .select("discord_id, discord_username, global_name, avatar_hash, ativo, adicionado_em")
      .order("ativo", { ascending: false })
      .order("adicionado_em", { ascending: false }),
  ) as JornalistaRow[];
  if (!jornalistas.length) return [];

  const ids = jornalistas.map((j) => j.discord_id);
  const [noticias, warns] = await Promise.all([
    db.from("noticias").select("id, jornalista_id, titulo, publicada_em").in("jornalista_id", ids).order("publicada_em", { ascending: false }),
    db
      .from("jornalista_warns")
      .select("id, jornalista_id, motivo, criado_em, criado_por, revogado_em, revogado_por")
      .in("jornalista_id", ids)
      .order("criado_em", { ascending: false }),
  ]);
  const noticiasRows = unwrap(noticias) as Array<{ id: number; jornalista_id: string; titulo: string; publicada_em: string }>;
  const warnsRows = unwrap(warns) as Array<{
    id: number;
    jornalista_id: string;
    motivo: string;
    criado_em: string;
    criado_por: string;
    revogado_em: string | null;
    revogado_por: string | null;
  }>;

  return jornalistas.map((jornalista) => {
    const historicoNoticias = noticiasRows
      .filter((noticia) => noticia.jornalista_id === jornalista.discord_id)
      .map((noticia) => ({ id: noticia.id, titulo: noticia.titulo, publicadaEm: noticia.publicada_em }));
    const historicoWarns = warnsRows
      .filter((warn) => warn.jornalista_id === jornalista.discord_id)
      .map((warn) => ({
        id: warn.id,
        motivo: warn.motivo,
        criadoEm: warn.criado_em,
        criadoPor: warn.criado_por,
        revogadoEm: warn.revogado_em,
        revogadoPor: warn.revogado_por,
      }));
    return {
      discordId: jornalista.discord_id,
      username: jornalista.discord_username,
      globalName: jornalista.global_name,
      avatarUrl: avatarDiscord(jornalista.discord_id, jornalista.avatar_hash),
      ativo: jornalista.ativo,
      adicionadoEm: jornalista.adicionado_em,
      quantidadeWarns: historicoWarns.filter((warn) => !warn.revogadoEm).length,
      quantidadeNoticias: historicoNoticias.length,
      noticias: historicoNoticias,
      warns: historicoWarns,
    };
  });
}

export async function adicionarJornalista(request: Request, discordId: string) {
  const { user } = await requireSuperOwnerJornal(request);
  const perfil = await fetchUsuarioDiscord(discordId);
  if (!perfil) throw new Error("Não foi possível encontrar esse usuário no Discord. Verifique o ID.");
  const db = getDb();
  unwrap(
    await db.from("jornalistas").upsert(
      {
        discord_id: perfil.id,
        discord_username: perfil.username,
        global_name: perfil.globalName,
        avatar_hash: perfil.avatarHash,
        ativo: true,
        adicionado_por: user.id,
        removido_em: null,
        removido_por: null,
      },
      { onConflict: "discord_id" },
    ),
  );
  return { ok: true };
}

export async function removerJornalista(request: Request, discordId: string) {
  const { user } = await requireSuperOwnerJornal(request);
  const db = getDb();
  const res = await db
    .from("jornalistas")
    .update({ ativo: false, removido_em: new Date().toISOString(), removido_por: user.id })
    .eq("discord_id", discordId);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

export async function adicionarWarnJornalista(request: Request, input: { jornalistaId: string; motivo: string }) {
  const { user } = await requireSuperOwnerJornal(request);
  const motivo = input.motivo.trim();
  if (motivo.length < 3 || motivo.length > 800) {
    throw new Error("O motivo do aviso deve ter entre 3 e 800 caracteres.");
  }
  const db = getDb();
  unwrap(
    await db.from("jornalista_warns").insert({
      jornalista_id: input.jornalistaId,
      motivo,
      criado_por: user.id,
    }),
  );
  return { ok: true };
}

export async function removerWarnJornalista(request: Request, warnId: number) {
  const { user } = await requireSuperOwnerJornal(request);
  const db = getDb();
  const res = await db
    .from("jornalista_warns")
    .update({ revogado_em: new Date().toISOString(), revogado_por: user.id })
    .eq("id", warnId)
    .is("revogado_em", null);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
