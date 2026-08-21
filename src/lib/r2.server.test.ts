import { describe, expect, it } from "vitest";

import { validarImagemParaUpload } from "./r2.server";

describe("validação de imagem para Cloudflare R2", () => {
  it("aceita um payload WebP em uma pasta permitida", () => {
    expect(
      validarImagemParaUpload({
        pasta: "anuncios",
        tipo: "image/webp",
        conteudoBase64: Buffer.from("imagem-teste").toString("base64"),
      }),
    ).toBeGreaterThan(0);
  });

  it("rejeita tipos e pastas fora do contrato", () => {
    expect(() =>
      validarImagemParaUpload({ pasta: "avatares" as "anuncios", tipo: "image/webp", conteudoBase64: "eA==" }),
    ).toThrow("Pasta de mídia inválida");
    expect(() =>
      validarImagemParaUpload({ pasta: "noticias", tipo: "image/gif", conteudoBase64: "eA==" }),
    ).toThrow("WebP, JPEG ou PNG");
  });
});
