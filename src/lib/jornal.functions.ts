import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as jornal from "./jornal.server";

export type { JornalistaAdmin, NoticiaPublica } from "./jornal.server";

export const fetchNoticiasPublicas = createServerFn({ method: "GET" }).handler(async () =>
  jornal.listarNoticiasPublicas(),
);

export const fetchPermissaoJornal = createServerFn({ method: "GET" }).handler(async () =>
  jornal.permissaoJornal(getRequest()),
);

export const publicarNoticia = createServerFn({ method: "POST" })
  .inputValidator((input: { titulo: string; imagemUrl: string; descricao: string }) => input)
  .handler(async ({ data }) => jornal.criarNoticia(getRequest(), data));

export const editarNoticia = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; titulo: string; imagemUrl: string; descricao: string }) => input)
  .handler(async ({ data }) => jornal.editarNoticia(getRequest(), data));

export const excluirNoticia = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }) => jornal.excluirNoticia(getRequest(), data.id));

export const fetchJornalistasAdmin = createServerFn({ method: "GET" }).handler(async () =>
  jornal.listarJornalistasAdmin(getRequest()),
);

export const adicionarJornalistaAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { discordId: string }) => input)
  .handler(async ({ data }) => jornal.adicionarJornalista(getRequest(), data.discordId));

export const removerJornalistaAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { discordId: string }) => input)
  .handler(async ({ data }) => jornal.removerJornalista(getRequest(), data.discordId));

export const adicionarWarnJornalistaAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { jornalistaId: string; motivo: string }) => input)
  .handler(async ({ data }) => jornal.adicionarWarnJornalista(getRequest(), data));

export const removerWarnJornalistaAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { warnId: number }) => input)
  .handler(async ({ data }) => jornal.removerWarnJornalista(getRequest(), data.warnId));
