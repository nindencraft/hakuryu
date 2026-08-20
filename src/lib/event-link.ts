export function normalizarLinkEvento(valor: string | undefined, nomeCampo = "O link do servidor privado Roblox"): string | null {
  const link = valor?.trim() ?? "";
  if (!link) return null;

  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Protocolo inválido");
    }
    return url.toString();
  } catch {
    throw new Error(`${nomeCampo} deve ser uma URL válida iniciada por http:// ou https://.`);
  }
}
