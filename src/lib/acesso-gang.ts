export function acessoGangPermitido(
  gangId: number | null,
  isSuperOwner: boolean,
  temCargoConfiguradoComAcesso: boolean,
): boolean {
  return gangId == null || isSuperOwner || temCargoConfiguradoComAcesso;
}
