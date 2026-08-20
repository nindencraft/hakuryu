export function podePublicarNoticia(input: {
  isSuperOwner: boolean;
  jornalistaAtivo: boolean;
}): boolean {
  return input.isSuperOwner || input.jornalistaAtivo;
}

export function podeEditarNoticia(input: {
  isSuperOwner: boolean;
  jornalistaAtivo: boolean;
  autorDiscordId: string;
  usuarioDiscordId: string;
}): boolean {
  return input.isSuperOwner || (input.jornalistaAtivo && input.autorDiscordId === input.usuarioDiscordId);
}
