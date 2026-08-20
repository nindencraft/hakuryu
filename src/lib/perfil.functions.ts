import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as dashboard from "./dashboard.server";

export const fetchMeuPerfil = createServerFn({ method: "GET" }).handler(async () => {
  const user = await dashboard.requireUserSemGang(getRequest());
  const { obterPerfilJogador } = await import("./perfil.server");
  return obterPerfilJogador(user);
});
