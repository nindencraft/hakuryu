import { queryOptions } from "@tanstack/react-query";

import {
  fetchDivisoes,
  fetchMembros,
  fetchParcerias,
  fetchTreinos,
  fetchLogs,
  fetchGuildAtual,
  fetchGangsDisponiveis,
  fetchConfiguracoes,
  fetchGangsRegistradas,
  fetchSolicitacoes,
  fetchGuerras,
  fetchAnunciosPublicos,
  fetchBannerGlobal,
  getSession,
} from "./dashboard.functions";
import { fetchRecrutamentosPublicos } from "./recrutamento.functions";
import {
  fetchMeuServidorExplorador,
  fetchServidoresExploradorAdmin,
  fetchServidoresExploradorPublicos,
} from "./explorador.functions";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSession(),
  staleTime: 0,
  refetchOnWindowFocus: true,
});

export const bannerGlobalQuery = queryOptions({
  queryKey: ["banner-global"],
  queryFn: () => fetchBannerGlobal(),
  staleTime: 30_000,
});

export const anunciosPublicosQuery = queryOptions({
  queryKey: ["anuncios-comunidade"],
  queryFn: () => fetchAnunciosPublicos(),
  staleTime: 30_000,
});

export const recrutamentosPublicosQuery = queryOptions({
  queryKey: ["recrutamentos-publicos"],
  queryFn: () => fetchRecrutamentosPublicos(),
  staleTime: 30_000,
});

export const servidoresExploradorPublicosQuery = queryOptions({
  queryKey: ["servidores-explorador-publicos"],
  queryFn: () => fetchServidoresExploradorPublicos(),
  staleTime: 30_000,
});

export const meuServidorExploradorQuery = queryOptions({
  queryKey: ["meu-servidor-explorador"],
  queryFn: () => fetchMeuServidorExplorador(),
  staleTime: 0,
});

export const servidoresExploradorAdminQuery = queryOptions({
  queryKey: ["servidores-explorador-admin"],
  queryFn: () => fetchServidoresExploradorAdmin(),
  staleTime: 0,
});

export const gangsDisponiveisQuery = queryOptions({
  queryKey: ["gangs-disponiveis"],
  queryFn: () => fetchGangsDisponiveis(),
  staleTime: 60_000,
});

export const membrosQuery = queryOptions({
  queryKey: ["membros"],
  queryFn: () => fetchMembros(),
  staleTime: 30_000,
});

export const treinosQuery = queryOptions({
  queryKey: ["treinos"],
  queryFn: () => fetchTreinos(),
  staleTime: 30_000,
});

export const divisoesQuery = queryOptions({
  queryKey: ["divisoes"],
  queryFn: () => fetchDivisoes(),
  staleTime: 30_000,
});

export const parceriasQuery = queryOptions({
  queryKey: ["parcerias"],
  queryFn: () => fetchParcerias(),
  staleTime: 30_000,
});

export const configuracoesQuery = queryOptions({
  queryKey: ["configuracoes"],
  queryFn: () => fetchConfiguracoes(),
  staleTime: 10_000,
});

export const logsQuery = queryOptions({
  queryKey: ["logs"],
  queryFn: () => fetchLogs(),
  staleTime: 30_000,
});

export const guildAtualQuery = queryOptions({
  queryKey: ["guild-atual"],
  queryFn: () => fetchGuildAtual(),
  staleTime: 300_000,
});

export const gangsRegistradasQuery = queryOptions({
  queryKey: ["gangs-registradas"],
  queryFn: () => fetchGangsRegistradas(),
  staleTime: 30_000,
});

export const solicitacoesQuery = queryOptions({
  queryKey: ["solicitacoes"],
  queryFn: () => fetchSolicitacoes(),
  staleTime: 15_000,
});

export const guerrasQuery = queryOptions({
  queryKey: ["guerras"],
  queryFn: () => fetchGuerras(),
  staleTime: 30_000,
});
