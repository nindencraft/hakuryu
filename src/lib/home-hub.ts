export type AcaoPainelHome = "abrir-painel" | "escolher-gang" | "aguardar-acesso" | "sem-gang";

export function acaoPainelHome({
  permitido,
  gangId,
  quantidadeDeGangs,
}: {
  permitido: boolean;
  gangId: number | null;
  quantidadeDeGangs: number;
}): AcaoPainelHome {
  if (permitido && gangId != null) return "abrir-painel";
  if (gangId == null && quantidadeDeGangs > 0) return "escolher-gang";
  if (quantidadeDeGangs > 0) return "aguardar-acesso";
  return "sem-gang";
}
