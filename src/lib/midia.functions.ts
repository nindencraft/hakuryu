import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { podeCriarDivisao, podeGerenciarRecrutamento } from "./session.server";
import type { ImagemParaUpload } from "./r2.server";

export const uploadImagemR2 = createServerFn({ method: "POST" })
  .inputValidator((input: ImagemParaUpload) => input)
  .handler(async ({ data }) => {
    const request = getRequest();
    const dashboard = await import("./dashboard.server");

    if (data.pasta === "anuncios") {
      const user = await dashboard.requireUserSemGang(request);
      if (!user.isSuperOwner) throw new Error("Apenas o Super Owner pode enviar esta imagem.");
    } else if (data.pasta === "banners" && data.finalidade === "recrutamento") {
      const userDaGang = await dashboard.requireUser(request);
      if (!podeGerenciarRecrutamento(userDaGang)) {
        throw new Error("Você não tem permissão para enviar banners de recrutamento.");
      }
    } else if (data.pasta === "banners" && data.finalidade === "explorador") {
      await dashboard.requireUserSemGang(request);
    } else if (data.pasta === "banners") {
      const user = await dashboard.requireUserSemGang(request);
      if (!user.isSuperOwner) throw new Error("Apenas o Super Owner pode enviar esta imagem.");
    } else if (data.pasta === "noticias") {
      const { permissaoJornal } = await import("./jornal.server");
      const permissao = await permissaoJornal(request);
      if (!permissao.podePublicar) {
        throw new Error("Somente jornalistas ativos ou o Super Owner podem enviar imagens de notícias.");
      }
    } else if (data.pasta === "divisoes") {
      const user = await dashboard.requireUser(request);
      if (!podeCriarDivisao(user)) {
        throw new Error("Você não tem permissão para enviar logos de divisão.");
      }
    }

    const { uploadImagemR2: enviar } = await import("./r2.server");
    return enviar(data);
  });
