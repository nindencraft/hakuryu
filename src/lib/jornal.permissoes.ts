export function podePublicarNoticia(input: {
  isSuperOwner: boolean;
  jornalistaAtivo: boolean;
}): boolean {
  return input.isSuperOwner || input.jornalistaAtivo;
}
