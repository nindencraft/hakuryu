export const ATRIBUTO_MEMBRO_CHAVES = [
  "movimentacao",
  "parry",
  "reacao",
  "ofensiva",
  "defensiva",
  "nocao_jogo",
] as const;

export type AtributoMembroChave = (typeof ATRIBUTO_MEMBRO_CHAVES)[number];

export type AtributosMembroValores = Record<AtributoMembroChave, number>;

export type MembroAtributos = AtributosMembroValores & {
  atualizado_em: string | null;
  atualizado_por: string | null;
  atualizado_por_nome: string | null;
};

export type HistoricoAtributosMembro = AtributosMembroValores & {
  id: number;
  membro_id: string;
  avaliado_em: string | null;
  avaliado_por: string | null;
  avaliado_por_nome: string | null;
};

export const ATRIBUTOS_MEMBRO = [
  { chave: "movimentacao", rotulo: "Movimentação" },
  { chave: "parry", rotulo: "Parry" },
  { chave: "reacao", rotulo: "Reação" },
  { chave: "ofensiva", rotulo: "Ofensiva" },
  { chave: "defensiva", rotulo: "Defensiva" },
  { chave: "nocao_jogo", rotulo: "Noção de jogo" },
] as const satisfies ReadonlyArray<{ chave: AtributoMembroChave; rotulo: string }>;

export const NIVEIS_ATRIBUTO = [
  { valor: 1, rotulo: "Muito ruim", cor: "#ef4444" },
  { valor: 2, rotulo: "Ruim", cor: "#f97316" },
  { valor: 3, rotulo: "Razoável", cor: "#eab308" },
  { valor: 4, rotulo: "Bom", cor: "#84cc16" },
  { valor: 5, rotulo: "Muito bom", cor: "#22c55e" },
] as const;

export function rotuloNivelAtributo(valor: number): string {
  return NIVEIS_ATRIBUTO.find((nivel) => nivel.valor === valor)?.rotulo ?? "Razoável";
}

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
  atributos: MembroAtributos;
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
  link_servidor_privado: string | null;
  divisao_responsavel: string | null;
  status: string | null;
  criado_por: string | null;
  inscritos: number;
  adiamento: Adiamento | null;
  aliado: string | null;
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
  lider_avatar: string | null;
  vice_nome: string | null;
  vice_discord: string | null;
  vice_avatar: string | null;

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
  icon_hash: string | null;
  representante_id: string | null;
  representante_nome: string | null;
  representante_avatar: string | null;
  fechado_por: string | null;
  fechado_por_nome: string | null;
  /** "Aliada" ou "Inimiga". */
  relacao: string;
};

export type LogPartida = {
  id: number;
  tipo: string;
  adversario_id: number | null;
  adversario_nome: string;
  adversario_guild_id: string | null;
  adversario_icon_hash: string | null;
  pontos_nos: number;
  pontos_eles: number;
  data_partida: string | null;
  link_servidor_privado: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
};

export type GuildAtual = { id: string; nome: string; iconHash: string | null } | null;

export type AliadoResolvido = {
  guild: { id: string | null; nome: string; iconHash: string | null } | null;
  representante: {
    id: string;
    nome: string;
    avatarHash: string | null;
  } | null;
};


export const PRESENCA_OPCOES = ["Pendente", "Presente", "Ausente", "Justificado"] as const;
export const TIPO_TREINO_OPCOES = ["Interno", "Obrigatório"] as const;
export const TIPO_PUNICAO_OPCOES = ["Warn", "Kick", "Ban"] as const;
export const STATUS_PARCERIA_OPCOES = ["Ativa", "Em negociação", "Pausada", "Encerrada"] as const;
export const RELACAO_GANG_OPCOES = ["Aliada", "Inimiga"] as const;
export const TIPO_LOG_OPCOES = ["Amistoso", "Guerra"] as const;


export type ConfiguracoesPainel = {
  cargos: Record<string, string>;
  canais: Record<string, string>;
  owners: string[];
  guildId: string;
  tabelaAusente: boolean;
};

export const CANAIS_CONFIG = [
  { chave: "canal_treinos", rotulo: "Canal de treinos" },
  { chave: "canal_aliancas", rotulo: "Canal de alianças" },
  { chave: "canal_advertencias", rotulo: "Canal de advertências" },
] as const;

/** Configuração administrativa, exibida somente ao Super Owner. */
export const CANAL_DIVULGACAO_CONFIG = {
  chave: "canal_divulgacao",
  rotulo: "Canal de divulgação global",
} as const;

/* ========== Diplomacia entre gangs ========== */

export type RelacaoGang = "Neutra" | "Aliada" | "Inimiga";

export type GangRegistrada = {
  id: number;
  nome: string;
  guild_id: string;
  icon_hash: string | null;
  membros: number;
  treinos: number;
  divisoes: number;
  convite: string | null;
  relacao: RelacaoGang;
  pendencias: { tipo: string; direcao: "enviada" | "recebida" }[];
  desde: string | null;
  representante_id: string | null;
  representante_nome: string | null;
  representante_avatar: string | null;
  solicitado_por_nome: string | null;
  fechado_por_nome: string | null;
};

export type SolicitacaoGang = {
  id: number;
  tipo: string;
  status: string;
  motivo: string | null;
  data_evento: string | null;
  horario: string | null;
  local: string | null;
  link_servidor_privado: string | null;
  membros_origem: number | null;
  membros_destino: number | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  respondido_por_nome: string | null;
  respondido_em: string | null;
  criado_em: string | null;
  representante_id: string | null;
  representante_nome: string | null;
  representante_avatar: string | null;
  direcao: "enviada" | "recebida";
  gang: { id: number; nome: string; guild_id: string | null; icon_hash: string | null };
};

export type GuerraAtiva = {
  id: number;
  motivo: string | null;
  data_evento: string | null;
  horario: string | null;
  local: string | null;
  link_servidor_privado: string | null;
  membros_nos: number | null;
  membros_eles: number | null;
  solicitante_nome: string | null;
  aceito_por_nome: string | null;
  criado_em: string | null;
  pedimos_encerrar: boolean;
  eles_pediram_encerrar: boolean;
  nos: { nome: string; guild_id: string | null; icon_hash: string | null };
  eles: { nome: string; guild_id: string | null; icon_hash: string | null };
};

export const TIPO_SOLICITACAO_OPCOES = ["Alianca", "Guerra", "Treino"] as const;

export const ROTULO_SOLICITACAO: Record<string, string> = {
  Alianca: "Aliança",
  Guerra: "Guerra",
  Treino: "Treino amistoso",
};
