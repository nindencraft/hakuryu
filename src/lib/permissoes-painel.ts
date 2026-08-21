export const PERMISSOES_PAINEL = [
  { chave: "gerenciar_membros", rotulo: "Gerenciar membros", descricao: "Cadastrar, remover, editar status e atribuir cargos de membros." },
  { chave: "gerenciar_eventos", rotulo: "Gerenciar eventos", descricao: "Criar, editar, encerrar e registrar treinos, guerras e amistosos." },
  { chave: "gerenciar_divisoes", rotulo: "Gerenciar divisões", descricao: "Criar e administrar divisões e suas lideranças." },
  { chave: "gerenciar_parcerias", rotulo: "Gerenciar diplomacia", descricao: "Criar e responder alianças, guerras e demais solicitações." },
  { chave: "gerenciar_advertencias", rotulo: "Gerenciar advertências", descricao: "Aplicar, consultar e revogar advertências dos membros." },
  { chave: "avaliar_atributos", rotulo: "Avaliar atributos", descricao: "Registrar os atributos de combate de integrantes." },
  { chave: "ver_logs", rotulo: "Ver registros", descricao: "Consultar o histórico de logs e resultados de partidas." },
  { chave: "gerenciar_recrutamento", rotulo: "Gerenciar recrutamento", descricao: "Criar, editar, ativar e pausar o anúncio de recrutamento da gang." },
] as const;

export type PermissaoPainel = (typeof PERMISSOES_PAINEL)[number]["chave"];

export const CHAVES_PERMISSOES_PAINEL = PERMISSOES_PAINEL.map((permissao) => permissao.chave);

export function normalizarPermissoesPainel(valores: readonly string[] | null | undefined): PermissaoPainel[] {
  const recebidas = new Set((valores ?? []).map((valor) => String(valor).trim()));
  return CHAVES_PERMISSOES_PAINEL.filter((chave) => recebidas.has(chave));
}
