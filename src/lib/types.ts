export type Membro = {
  discord_id: string;
  discord_username: string | null;
  nome_roblox: string | null;
  nome_rp: string | null;
  genero: string | null;
  altura_jogo: number | null;
  estilo_luta_principal: string | null;
  cargo: string;
  divisao: string | null;
  divisao_id: number | null;
  status: string;
  data_entrada: string | null;
  avatar_hash: string | null;
  warns: number;
  stats: { internos: number; amistosos: number; guerras: number };
};

export type Adiamento = { por: string | null; em: string | null; antes: string | null };

export type Treino = {
  id_treino: number;
  titulo: string;
  descricao: string | null;
  data_treino: string;
  horario: string | null;
  tipo: string;
  local: string | null;
  divisao_responsavel: string | null;
  status: string | null;
  criado_por: string | null;
  inscritos: number;
  adiamento: Adiamento | null;
};


export type PresencaTreino = {
  membro_id: string;
  discord_username: string | null;
  nome_rp: string | null;
  avatar_hash: string | null;
  inscricao: string | null;
  presenca: string;
};

export type Divisao = {
  id: number;
  nome_divisao: string;
  logo_url: string | null;
  discord_role_id: string | null;
  funcao_principal: string | null;
  lider_id: string | null;
  vice_lider_id: string | null;
  lider_nome: string | null;
  lider_discord: string | null;
  vice_nome: string | null;
  vice_discord: string | null;
  membros: { discord_id: string; discord_username: string | null; nome_rp: string | null; avatar_hash: string | null }[];
};

export type Punicao = {
  id_punicao?: number;
  membro_id: string;
  tipo: string;
  motivo: string | null;
  staff_id?: string | null;
  staff_nome?: string | null;
  data_aplicacao?: string | null;
};

export type Parceria = {
  id: number;
  nome: string;
  tag: string | null;
  contato: string | null;
  status: string;
  link_servidor: string | null;
  observacoes: string | null;
  data_inicio: string | null;
};

export const PRESENCA_OPCOES = ["Pendente", "Presente", "Ausente", "Justificado"] as const;
export const TIPO_TREINO_OPCOES = ["Interno", "Amistoso", "Obrigatório"] as const;
export const TIPO_PUNICAO_OPCOES = ["Warn", "Mute", "Kick", "Ban"] as const;
export const STATUS_PARCERIA_OPCOES = ["Ativa", "Em negociação", "Pausada", "Encerrada"] as const;

