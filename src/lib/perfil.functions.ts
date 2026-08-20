import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as dashboard from "./dashboard.server";
import type { FichaRPGInput } from "./perfil";

export const fetchMeuPerfil = createServerFn({ method: "GET" }).handler(async () => {
  const user = await dashboard.requireUserSemGang(getRequest());
  const { obterPerfilJogador } = await import("./perfil.server");
  return obterPerfilJogador(user);
});

/** Atualiza exclusivamente a ficha RPG da própria conta Discord autenticada. */
export const atualizarMinhaFichaRPG = createServerFn({ method: "POST" })
  .inputValidator((data: FichaRPGInput) => data)
  .handler(async ({ data }) => {
    const user = await dashboard.requireUserSemGang(getRequest());
    const { atualizarFichaRPG } = await import("./perfil.server");
    return atualizarFichaRPG(user, data);
  });
