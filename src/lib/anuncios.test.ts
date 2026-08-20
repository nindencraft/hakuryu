import { describe, expect, it } from "vitest";

import {
  categoriaAnuncioOuErro,
  categoriaAnuncioValida,
  INFORMACOES_CATEGORIA_ANUNCIO,
} from "./anuncios";

describe("categorias de anúncios", () => {
  it("aceita somente as três categorias da vitrine", () => {
    expect(categoriaAnuncioValida("gang")).toBe(true);
    expect(categoriaAnuncioValida("roleplay")).toBe(true);
    expect(categoriaAnuncioValida("comunidade")).toBe(true);
    expect(categoriaAnuncioValida("noticia")).toBe(false);
  });

  it("expõe uma apresentação para todas as categorias", () => {
    expect(INFORMACOES_CATEGORIA_ANUNCIO.gang.ancora).toBe("gangs");
    expect(INFORMACOES_CATEGORIA_ANUNCIO.roleplay.titulo).toBe("Roleplays");
    expect(() => categoriaAnuncioOuErro("outro")).toThrow("categoria de anúncio válida");
  });
});
