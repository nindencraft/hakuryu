export const CATEGORIAS_ANUNCIO = ["gang", "roleplay", "comunidade"] as const;

export type CategoriaAnuncio = (typeof CATEGORIAS_ANUNCIO)[number];

export const INFORMACOES_CATEGORIA_ANUNCIO: Record<
  CategoriaAnuncio,
  { titulo: string; subtitulo: string; ancora: string }
> = {
  gang: {
    titulo: "Gangs",
    subtitulo: "Recrutamento, alianças e organizações ativas.",
    ancora: "gangs",
  },
  roleplay: {
    titulo: "Roleplays",
    subtitulo: "Universos para criar histórias dentro de Gakuran.",
    ancora: "roleplays",
  },
  comunidade: {
    titulo: "Comunidades",
    subtitulo: "Espaços para conversar, jogar e se conectar.",
    ancora: "comunidades",
  },
};

export function categoriaAnuncioValida(valor: string): valor is CategoriaAnuncio {
  return CATEGORIAS_ANUNCIO.includes(valor as CategoriaAnuncio);
}

export function categoriaAnuncioOuErro(valor: string): CategoriaAnuncio {
  if (!categoriaAnuncioValida(valor)) {
    throw new Error("Selecione uma categoria de anúncio válida.");
  }
  return valor;
}
