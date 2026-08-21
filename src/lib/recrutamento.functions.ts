import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as svc from "./dashboard.server";
import type { EntradaRecrutamentoGang } from "./recrutamento";

export const fetchRecrutamentosPublicos = createServerFn({ method: "GET" }).handler(async () => {
  await svc.requireUserSemGang(getRequest());
  const { listarRecrutamentosPublicos } = await import("./recrutamento.server");
  return listarRecrutamentosPublicos();
});

export const fetchMeuRecrutamento = createServerFn({ method: "GET" }).handler(async () => {
  const usuario = await svc.requireUser(getRequest());
  if (usuario.gangId == null) throw new Error("Selecione uma gang antes de gerenciar o recrutamento.");
  const { obterRecrutamentoDaGang } = await import("./recrutamento.server");
  return obterRecrutamentoDaGang(usuario.gangId);
});

export const salvarMeuRecrutamento = createServerFn({ method: "POST" })
  .inputValidator((entrada: EntradaRecrutamentoGang) => entrada)
  .handler(async ({ data }) => {
    const usuario = await svc.requireUser(getRequest());
    const { salvarRecrutamentoDaGang } = await import("./recrutamento.server");
    return salvarRecrutamentoDaGang(usuario, data);
  });
