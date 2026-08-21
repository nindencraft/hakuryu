import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getConfig } from "./config.server";

export const PASTAS_R2 = ["banners", "anuncios", "divisoes", "noticias"] as const;
export type PastaR2 = (typeof PASTAS_R2)[number];

const TIPOS_IMAGEM = new Map([
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);
const TAMANHO_MAXIMO_BYTES = 6 * 1024 * 1024;

export type ImagemParaUpload = {
  pasta: PastaR2;
  finalidade?: "administrativo" | "recrutamento" | "explorador";
  nomeArquivo: string;
  tipo: string;
  conteudoBase64: string;
};

function configuracaoR2() {
  const config = getConfig();
  const ausentes = [
    ["CLOUDFLARE_R2_ACCOUNT_ID", config.r2AccountId],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", config.r2AccessKeyId],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", config.r2SecretAccessKey],
    ["CLOUDFLARE_R2_BUCKET", config.r2Bucket],
    ["CLOUDFLARE_R2_PUBLIC_URL", config.r2PublicUrl],
  ]
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);

  if (ausentes.length > 0) {
    throw new Error(`Configuração do Cloudflare R2 ausente: ${ausentes.join(", ")}.`);
  }

  return config;
}

function clienteR2() {
  const config = configuracaoR2();
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

function basePublicaR2() {
  return configuracaoR2().r2PublicUrl.replace(/\/+$/, "");
}

function pastaValida(pasta: string): pasta is PastaR2 {
  return (PASTAS_R2 as readonly string[]).includes(pasta);
}

function extensaoSegura(tipo: string) {
  const extensao = TIPOS_IMAGEM.get(tipo.toLowerCase());
  if (!extensao) {
    throw new Error("Envie uma imagem em WebP, JPEG ou PNG.");
  }
  return extensao;
}

function bytesDoBase64(conteudoBase64: string) {
  const limpo = conteudoBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!limpo) throw new Error("O arquivo de imagem está vazio.");
  try {
    return Buffer.from(limpo, "base64");
  } catch {
    throw new Error("Não foi possível ler o arquivo de imagem.");
  }
}

export function chaveR2DaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = basePublicaR2();
  if (!url.startsWith(`${base}/`)) return null;
  const chave = url.slice(base.length + 1);
  if (!chave || chave.includes("..") || !PASTAS_R2.some((pasta) => chave.startsWith(`${pasta}/`))) {
    return null;
  }
  return chave;
}

export function gerarUrlPublicaR2(chave: string) {
  return `${basePublicaR2()}/${chave}`;
}

export async function uploadImagemR2(entrada: ImagemParaUpload): Promise<{ chave: string; url: string }> {
  if (!pastaValida(entrada.pasta)) throw new Error("Pasta de mídia inválida.");
  const extensao = extensaoSegura(entrada.tipo);
  const bytes = bytesDoBase64(entrada.conteudoBase64);
  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new Error("A imagem otimizada não pode ultrapassar 6 MB.");
  }

  const config = configuracaoR2();
  const nomeSeguro = entrada.nomeArquivo
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "imagem";
  const chave = `${entrada.pasta}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}.${extensao}`;

  await clienteR2().send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: chave,
      Body: bytes,
      ContentType: entrada.tipo.toLowerCase(),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { chave, url: gerarUrlPublicaR2(chave) };
}

export async function deletarImagemR2PorUrl(url: string | null | undefined): Promise<boolean> {
  const chave = chaveR2DaUrl(url);
  if (!chave) return false;

  const config = configuracaoR2();
  await clienteR2().send(new DeleteObjectCommand({ Bucket: config.r2Bucket, Key: chave }));
  return true;
}

export async function deletarImagensR2PorUrl(urls: Array<string | null | undefined>) {
  const unicas = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  await Promise.all(unicas.map((url) => deletarImagemR2PorUrl(url)));
}

export function validarImagemParaUpload(entrada: Pick<ImagemParaUpload, "pasta" | "tipo" | "conteudoBase64">) {
  if (!pastaValida(entrada.pasta)) throw new Error("Pasta de mídia inválida.");
  extensaoSegura(entrada.tipo);
  const bytes = bytesDoBase64(entrada.conteudoBase64);
  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new Error("A imagem otimizada não pode ultrapassar 6 MB.");
  }
  return bytes.byteLength;
}
