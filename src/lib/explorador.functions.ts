import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import * as dashboard from "./dashboard.server";
import type { EntradaServidorExplorador, StatusExplorador } from "./explorador";

async function requireSuperOwner() {
  const user = await dashboard.requireUserSemGang(getRequest());
  if (!user.isSuperOwner) throw new Error("Apenas o Super Owner pode moderar servidores.");
  return user;
}

export const fetchServidoresExploradorPublicos = createServerFn({ method: "GET" }).handler(async () => {
  const { listarServidoresExploradorPublicos } = await import("./explorador.server");
  return listarServidoresExploradorPublicos();
});

export const fetchMeuServidorExplorador = createServerFn({ method: "GET" }).handler(async () => {
  const user = await dashboard.requireUserSemGang(getRequest());
  const { obterMeuServidorExplorador } = await import("./explorador.server");
  return obterMeuServidorExplorador(user.id);
});

export const salvarMeuServidorExplorador = createServerFn({ method: "POST" })
  .inputValidator((input: EntradaServidorExplorador) => input)
  .handler(async ({ data }) => {
    const user = await dashboard.requireUserSemGang(getRequest());
    const { salvarMeuServidorExplorador: salvar } = await import("./explorador.server");
    return salvar(user, data);
  });

export const fetchServidoresExploradorAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperOwner();
  const { listarServidoresExploradorAdmin } = await import("./explorador.server");
  return listarServidoresExploradorAdmin();
});

export const moderarServidorExplorador = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; status: StatusExplorador; motivo?: string | null }) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const { moderarServidorExplorador: moderar } = await import("./explorador.server");
    return moderar(data.id, data.status, data.motivo);
  });

export const excluirServidorExploradorAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    await requireSuperOwner();
    const { excluirServidorExploradorAdmin: excluir } = await import("./explorador.server");
    return excluir(data.id);
  });

export const excluirServidorExplorador = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    const user = await dashboard.requireUserSemGang(getRequest());
    const { excluirServidorExploradorAutorizado: excluir } = await import("./explorador.server");
    return excluir(user, data.id);
  });
