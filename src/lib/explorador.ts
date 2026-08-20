export const CATEGORIAS_EXPLORADOR = ["roleplay", "comunidade"] as const;
export type CategoriaExplorador = (typeof CATEGORIAS_EXPLORADOR)[number];

export const STATUS_EXPLORADOR = ["pendente", "aprovado", "pausado", "recusado"] as const;
export type StatusExplorador = (typeof STATUS_EXPLORADOR)[number];

export type EntradaServidorExplorador = {
  categoria: CategoriaExplorador;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  discordUrl: string;
  etiquetas: string[];
  solicitarPublicacao: boolean;
};

export function categoriaExploradorOuErro(valor: string): CategoriaExplorador {
  if ((CATEGORIAS_EXPLORADOR as readonly string[]).includes(valor)) return valor as CategoriaExplorador;
  throw new Error("Escolha Roleplay ou Comunidade.");
}

export function statusExploradorOuErro(valor: string): StatusExplorador {
  if ((STATUS_EXPLORADOR as readonly string[]).includes(valor)) return valor as StatusExplorador;
  throw new Error("Status de moderação inválido.");
}

/** Normaliza as etiquetas sem alterar a ordem escolhida pelo responsável. */
export function normalizarEtiquetas(etiquetas: string[]): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const valor of etiquetas) {
    const limpa = valor.trim().replace(/\s+/g, " ");
    const chave = limpa.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!limpa || vistas.has(chave)) continue;
    if (limpa.length < 2 || limpa.length > 24) {
      throw new Error("Cada etiqueta deve ter entre 2 e 24 caracteres.");
    }
    vistas.add(chave);
    resultado.push(limpa);
  }
  if (resultado.length > 5) throw new Error("Use no máximo cinco etiquetas.");
  return resultado;
}
