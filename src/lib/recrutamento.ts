export type EntradaRecrutamentoGang = {
  imagemUrl: string;
  descricao: string;
  linkServidorManual: string;
  ativo: boolean;
};

export function linkPublicoRecrutamento(
  linkServidorManual: string | null | undefined,
  conviteAutomaticoUrl: string | null | undefined,
): string | null {
  return linkServidorManual?.trim() || conviteAutomaticoUrl?.trim() || null;
}

export function descricaoRecrutamentoValida(descricao: string): boolean {
  const tamanho = descricao.trim().length;
  return tamanho >= 10 && tamanho <= 500;
}
