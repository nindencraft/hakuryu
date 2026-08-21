/**
 * Regra única de entrada na gang ativa.
 * O Super Owner não depende da consulta transitória de cargos do Discord;
 * os demais usuários continuam exigindo um ID de cargo configurado, seja da
 * consulta atual ou do último conjunto de IDs confirmado na sessão assinada.
 */
export function acessoGangPermitido(
  gangId: number | null,
  isSuperOwner: boolean,
  temCargoConfiguradoComAcesso: boolean,
  liderRegistrado = false,
): boolean {
  return gangId == null || isSuperOwner || liderRegistrado || temCargoConfiguradoComAcesso;
}
