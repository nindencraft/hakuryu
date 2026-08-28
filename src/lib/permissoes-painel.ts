export const PERMISSOES_PAINEL = [
  { chave: "acessar_painel", rotulo: "Acessar Painel", descricao: "Permite entrar e permanecer no painel mesmo sem um cargo-base configurado como Membro ou superior." },
  { chave: "avaliar_estatisticas", rotulo: "Avaliar Estatísticas", descricao: "Permite avaliar e atualizar os atributos de combate dos membros autorizados." },
  { chave: "editar_ficha_rpg", rotulo: "Editar ficha RPG", descricao: "Permite editar a ficha RPG global de qualquer membro e sincronizá-la nos perfis e painéis." },
  { chave: "advertencia_dar", rotulo: "Advertência: dar", descricao: "Habilita a abertura do fluxo de punição; marque também Warn ou Ban para definir os tipos permitidos." },
  { chave: "advertencia_warn", rotulo: "Advertência: aplicar Warn", descricao: "Permite registrar uma advertência do tipo Warn." },
  { chave: "advertencia_ban", rotulo: "Advertência: aplicar Ban", descricao: "Permite banir membros respeitando a hierarquia de cargos." },
  { chave: "advertencia_remover", rotulo: "Advertência: remover do log", descricao: "Permite revogar registros de Warn ou Ban e restaurar o acesso após revogar um Ban." },
  { chave: "adicionar_membro", rotulo: "Adicionar Membro ao Painel", descricao: "Permite cadastrar integrantes do servidor Discord na gang." },
  { chave: "alterar_cargo", rotulo: "Alterar Cargo", descricao: "Permite atribuir somente os cargos listados em 'Cargos que este cargo pode atribuir'." },
  { chave: "treino_agendar", rotulo: "Treino: agendar", descricao: "Permite criar/agendar treinos." },
  { chave: "treino_deletar", rotulo: "Treino: deletar", descricao: "Permite deletar treinos pelo botão X." },
  { chave: "treino_gerenciar", rotulo: "Treino: gerenciar", descricao: "Permite ao criador controlar presença, encerrar e adiar os próprios treinos." },
  { chave: "divisao_criar", rotulo: "Divisão: criar", descricao: "Permite criar uma divisão." },
  { chave: "divisao_deletar", rotulo: "Divisão: deletar", descricao: "Permite deletar uma divisão." },
  { chave: "divisao_gerenciar_lider", rotulo: "Divisão: gerenciar líder", descricao: "Permite alterar a liderança da divisão, quando a regra hierárquica permitir." },
  { chave: "divisao_gerenciar_vice", rotulo: "Divisão: gerenciar vice-líder", descricao: "Permite gerenciar o vice-líder da própria divisão." },
  { chave: "divisao_gerenciar_membro", rotulo: "Divisão: gerenciar membros", descricao: "Permite adicionar ou remover membros da divisão." },
  { chave: "divisao_definir_vice", rotulo: "Divisão: definir vice-líder", descricao: "Permite escolher o vice-líder da divisão." },
  { chave: "divisao_definir_membros", rotulo: "Divisão: definir membros", descricao: "Permite adicionar membros à divisão." },
  { chave: "alianca_criar", rotulo: "Alianças: criar", descricao: "Permite criar uma aliança ou relação diplomática." },
  { chave: "alianca_editar", rotulo: "Alianças: editar", descricao: "Permite editar uma aliança existente." },
  { chave: "alianca_solicitar_amistoso", rotulo: "Alianças: solicitar amistoso", descricao: "Permite solicitar treino amistoso a outra gang." },
  { chave: "alianca_solicitar_guerra", rotulo: "Alianças: solicitar guerra", descricao: "Permite solicitar uma guerra a outra gang." },
  { chave: "alianca_deletar", rotulo: "Alianças: deletar", descricao: "Permite deletar uma aliança ou relação." },
  { chave: "solicitacoes_ver", rotulo: "Solicitações: ver", descricao: "Exibe a aba de solicitações e permite visualizar os pedidos." },
  { chave: "solicitacoes_deletar", rotulo: "Solicitações: deletar", descricao: "Permite excluir solicitações do histórico." },
  { chave: "solicitacoes_responder", rotulo: "Solicitações: responder", descricao: "Permite aceitar ou recusar solicitações recebidas." },
  { chave: "logs_criar", rotulo: "Logs: criar", descricao: "Permite registrar logs de amistosos e guerras." },
  { chave: "logs_deletar", rotulo: "Logs: deletar", descricao: "Permite excluir logs." },
  { chave: "configuracoes_criar_cargos", rotulo: "Configurações: criar cargos", descricao: "Permite criar, editar e remover cargos personalizados." },
  { chave: "configuracoes_inatividade", rotulo: "Configurações: alerta de inatividade", descricao: "Permite ajustar a janela e o percentual dos alertas de inatividade." },
  { chave: "configuracoes_canais", rotulo: "Configurações: alterar canais", descricao: "Permite alterar os IDs dos canais da gang." },
] as const;

/**
 * Chaves antigas permanecem aceitas para que cargos já configurados não parem
 * de funcionar depois da migração. Elas não aparecem como opções novas na UI.
 */
export const PERMISSOES_PAINEL_LEGADAS = [
  "gerenciar_membros",
  "gerenciar_eventos",
  "gerenciar_divisoes",
  "gerenciar_parcerias",
  "gerenciar_advertencias",
  "avaliar_atributos",
  "ver_logs",
  "gerenciar_recrutamento",
] as const;

export type PermissaoPainel =
  | (typeof PERMISSOES_PAINEL)[number]["chave"]
  | (typeof PERMISSOES_PAINEL_LEGADAS)[number];

export const CHAVES_PERMISSOES_PAINEL = [
  ...PERMISSOES_PAINEL.map((permissao) => permissao.chave),
  ...PERMISSOES_PAINEL_LEGADAS,
] as readonly string[];

export function normalizarPermissoesPainel(valores: readonly string[] | null | undefined): PermissaoPainel[] {
  const recebidas = new Set((valores ?? []).map((valor) => String(valor).trim()));
  return CHAVES_PERMISSOES_PAINEL.filter((chave) => recebidas.has(chave)) as PermissaoPainel[];
}

export function permissaoPainelRotulo(chave: string): string {
  return PERMISSOES_PAINEL.find((permissao) => permissao.chave === chave)?.rotulo ?? chave;
}
