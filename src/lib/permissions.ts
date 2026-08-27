export type SessionUserView = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  roles: string[];
  isOwner: boolean;
  isSuperOwner: boolean;
  nomeRp: string | null;
  permissoes: string[];
  cargosAtribuiveis: string[];
};

export const CARGOS_PERMITIDOS = [
  "Lider",
  "Vice-Lider",
  "Líder de Divisão",
  "Vice-Líder de Divisão",
  "Staff",
  "Recrutador",
  "Membro",
  "Em Analise",
];

export const CARGOS_DIVISAO = ["Líder de Divisão", "Vice-Líder de Divisão"];

const ROTULOS: Record<string, string> = {
  "Líder de Divisão": "Capitão de Divisão",
  "Vice-Líder de Divisão": "Vice-Capitão",
};

export function rotuloCargo(cargo: string): string {
  return ROTULOS[cargo] ?? cargo;
}

export function parseCargos(valor: string | null | undefined): string[] {
  return (valor ?? "").split(",").map((c) => c.trim()).filter(Boolean);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function temCargo(user: SessionUserView | null, cargo: string): boolean {
  return !!user && user.roles.some((role) => normalize(role) === normalize(cargo));
}

export function temPermissao(user: SessionUserView | null, ...chaves: string[]): boolean {
  return !!user && (user.isOwner || chaves.some((chave) => user.permissoes.includes(chave)));
}

export function podeAcessar(user: SessionUserView | null): boolean {
  return !!user && (user.isOwner || user.permissoes.includes("acessar_painel") || CARGOS_PERMITIDOS.some((cargo) => temCargo(user, cargo)));
}

/** Permissão ampla legada, mantida apenas para ações administrativas de membros. */
export function podeGerenciarMembros(user: SessionUserView | null): boolean {
  return !!user && (user.isOwner || user.permissoes.includes("gerenciar_membros") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider"));
}

export function podeAdicionarMembro(user: SessionUserView | null): boolean {
  return temPermissao(user, "adicionar_membro") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_membros");
}

export function podeAlterarCargo(user: SessionUserView | null): boolean {
  return temPermissao(user, "alterar_cargo") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_membros");
}

export function podeGerenciarTreinos(user: SessionUserView | null): boolean {
  return temPermissao(user, "treino_agendar", "treino_deletar", "treino_gerenciar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeAgendarTreino(user: SessionUserView | null): boolean {
  return temPermissao(user, "treino_agendar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeGerenciarTreino(user: SessionUserView | null): boolean {
  return temPermissao(user, "treino_gerenciar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeDeletarTreino(user: SessionUserView | null): boolean {
  return temPermissao(user, "treino_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeAdvertir(user: SessionUserView | null): boolean {
  return temPermissao(user, "advertencia_dar", "advertencia_warn", "advertencia_ban") || temCargo(user, "Staff") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeAplicarWarn(user: SessionUserView | null): boolean {
  return temPermissao(user, "advertencia_warn") || temCargo(user, "Staff") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeAplicarBan(user: SessionUserView | null): boolean {
  return temPermissao(user, "advertencia_ban") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeRevogarPunicao(user: SessionUserView | null): boolean {
  return temPermissao(user, "advertencia_remover") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_advertencias");
}

export function podeVerRegistroPunicoes(user: SessionUserView | null): boolean {
  return podeAdvertir(user) || !!user?.permissoes.includes("advertencia_remover");
}

export function cargosAtribuiveis(user: SessionUserView | null): string[] {
  if (!user) return [];
  if (user.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || user.permissoes.includes("gerenciar_membros")) {
    return CARGOS_PERMITIDOS.filter((cargo) => !CARGOS_DIVISAO.includes(cargo));
  }
  if (user.permissoes.includes("alterar_cargo")) {
    return user.cargosAtribuiveis.length ? user.cargosAtribuiveis : ["Membro", "Em Analise"];
  }
  if (temCargo(user, "Recrutador")) return ["Membro", "Em Analise"];
  return [];
}

export function podeCriarDivisao(user: SessionUserView | null): boolean {
  return temPermissao(user, "divisao_criar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_divisoes");
}

export function podeGerenciarDivisao(user: SessionUserView | null, divisao: { id?: number; lider_id: string | null; vice_lider_id: string | null }, minhaDivisaoId?: number | null): boolean {
  if (!user) return false;
  if (podeCriarDivisao(user) || user.isOwner || temPermissao(user, "divisao_gerenciar_lider", "divisao_gerenciar_vice", "divisao_gerenciar_membro", "divisao_definir_vice", "divisao_definir_membros")) return true;
  if (user.id === divisao.lider_id || user.id === divisao.vice_lider_id) return true;
  const lidera = temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lidera && minhaDivisaoId != null && minhaDivisaoId === divisao.id;
}

export function podeDefinirLiderancaDivisao(user: SessionUserView | null, divisao: { id?: number; lider_id: string | null; vice_lider_id: string | null }, minhaDivisaoId?: number | null): boolean {
  if (!user) return false;
  if (podeCriarDivisao(user) || user.isOwner || user.id === divisao.lider_id || temPermissao(user, "divisao_gerenciar_lider", "divisao_gerenciar_vice", "divisao_definir_vice")) return true;
  return temCargo(user, "Líder de Divisão") && minhaDivisaoId != null && minhaDivisaoId === divisao.id;
}

export function podeGerenciarDivisoes(user: SessionUserView | null): boolean {
  return podeCriarDivisao(user) || temPermissao(user, "divisao_gerenciar_lider", "divisao_gerenciar_vice", "divisao_gerenciar_membro", "divisao_definir_vice", "divisao_definir_membros");
}

export function podeGerenciarParcerias(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_criar", "alianca_editar", "alianca_deletar", "alianca_solicitar_amistoso", "alianca_solicitar_guerra") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeCriarAlianca(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_criar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeEditarAlianca(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_editar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeDeletarAlianca(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeSolicitarAmistoso(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_solicitar_amistoso") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeSolicitarGuerra(user: SessionUserView | null): boolean {
  return temPermissao(user, "alianca_solicitar_guerra") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeVerSolicitacoes(user: SessionUserView | null): boolean {
  return temPermissao(user, "solicitacoes_ver", "gerenciar_parcerias") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeResponderSolicitacoes(user: SessionUserView | null): boolean {
  return temPermissao(user, "solicitacoes_responder") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeDeletarSolicitacoes(user: SessionUserView | null): boolean {
  return temPermissao(user, "solicitacoes_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_parcerias");
}

export function podeCriarLog(user: SessionUserView | null): boolean {
  return temPermissao(user, "logs_criar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeDeletarLog(user: SessionUserView | null): boolean {
  return temPermissao(user, "logs_deletar") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider") || !!user?.permissoes.includes("gerenciar_eventos");
}

export function podeConfigurarCargos(user: SessionUserView | null): boolean {
  return temPermissao(user, "configuracoes_criar_cargos") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeConfigurarInatividade(user: SessionUserView | null): boolean {
  return temPermissao(user, "configuracoes_inatividade") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeConfigurarCanais(user: SessionUserView | null): boolean {
  return temPermissao(user, "configuracoes_canais") || !!user?.isOwner || temCargo(user, "Lider") || temCargo(user, "Vice-Lider");
}

export function podeAvaliarAtributos(user: SessionUserView | null, alvoDivisaoId: number | null, minhaDivisaoId: number | null): boolean {
  if (!user) return false;
  if (temPermissao(user, "avaliar_estatisticas", "avaliar_atributos") || temCargo(user, "Lider") || temCargo(user, "Vice-Lider")) return true;
  const lidera = temCargo(user, "Líder de Divisão") || temCargo(user, "Vice-Líder de Divisão");
  return lidera && alvoDivisaoId != null && alvoDivisaoId === minhaDivisaoId;
}

export function podeGerenciarRecrutamento(user: SessionUserView | null): boolean {
  return !!user && (user.isOwner || user.permissoes.includes("gerenciar_recrutamento"));
}

export function nomeExibicao(user: SessionUserView): string {
  return user.nomeRp || user.globalName || user.username;
}

export function discordAvatarUrl(discordId: string, avatarHash: string | null | undefined, size = 128): string {
  return avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}` : "https://cdn.discordapp.com/embed/avatars/0.png";
}

export function cargoPrincipal(user: SessionUserView | null): string | null {
  if (!user) return null;
  return CARGOS_PERMITIDOS.find((cargo) => temCargo(user, cargo)) ?? null;
}

export function cargoPrimario(cargos: string[]): string {
  return CARGOS_PERMITIDOS.find((cargo) => cargos.includes(cargo)) ?? cargos[0] ?? "Em Analise";
}
