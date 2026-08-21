export type ContextoExclusaoRecrutamento = {
  gangId: number | null | undefined;
  isSuperOwner: boolean | undefined;
  podeGerenciarRecrutamento: boolean;
};

export function podeExcluirRecrutamentoPublico(
  contexto: ContextoExclusaoRecrutamento,
  gangIdDaPublicacao: number,
) {
  return Boolean(
    contexto.isSuperOwner
    || (contexto.gangId === gangIdDaPublicacao && contexto.podeGerenciarRecrutamento),
  );
}

export function podeExcluirServidorExploradorPublico(
  contexto: { discordId: string | undefined; isSuperOwner: boolean | undefined },
  responsavelDiscordId: string,
) {
  return Boolean(contexto.isSuperOwner || contexto.discordId === responsavelDiscordId);
}
