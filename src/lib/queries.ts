import { queryOptions } from "@tanstack/react-query";

import {
  fetchDivisoes,
  fetchMembros,
  fetchParcerias,
  fetchTreinos,
  getSession,
} from "./dashboard.functions";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSession(),
  staleTime: 0,
  refetchOnWindowFocus: true,
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
