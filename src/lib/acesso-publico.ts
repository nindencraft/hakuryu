/**
 * Protege consultas abertas do Hub: exige sessão Discord válida, mas nunca
 * exige gang selecionada, cargo de Membro ou permissão do painel.
 */
export function exigirSessaoPublica<T>(usuario: T | null | undefined): T {
  if (!usuario) throw new Error("NAO_AUTENTICADO");
  return usuario;
}
