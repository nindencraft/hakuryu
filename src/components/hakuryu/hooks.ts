import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { sessionQuery } from "@/lib/queries";
import type { SessionUserView } from "@/lib/permissions";

export function useSessionUser(): SessionUserView | null {
  const { data } = useQuery(sessionQuery);
  return data?.user ?? null;
}

/** Executa uma server function, mostra toast e revalida as consultas afetadas. */
export function useAcao<TInput>(
  fn: (args: { data: TInput }) => Promise<unknown>,
  options: { sucesso: string; invalidar?: (string | number)[][]; aoConcluir?: () => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: () => {
      toast.success(options.sucesso);
      for (const key of options.invalidar ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      options.aoConcluir?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível concluir a ação.");
    },
  });
}

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "—";
  const d = new Date(valor.length <= 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

export function formatarHorario(valor: string | null | undefined): string {
  if (!valor) return "—";
  return valor.slice(0, 5);
}
