-- ============================================================
-- Schema Hakuryū Dashboard
-- Cole isto no SQL Editor de um projeto Supabase novo
-- para clonar a estrutura do banco de dados.
-- ============================================================

-- Tabela de configurações do painel
CREATE TABLE IF NOT EXISTS public.dashboard_config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_config TO authenticated;
GRANT ALL ON public.dashboard_config TO service_role;
ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar config"
  ON public.dashboard_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar config"
  ON public.dashboard_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar config"
  ON public.dashboard_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar config"
  ON public.dashboard_config FOR DELETE TO authenticated USING (true);

-- Tabela de divisões
CREATE TABLE IF NOT EXISTS public.divisoes (
  id SERIAL PRIMARY KEY,
  nome_divisao TEXT NOT NULL,
  logo_url TEXT,
  discord_role_id TEXT,
  funcao_principal TEXT,
  lider_id TEXT,
  vice_lider_id TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.divisoes TO authenticated;
GRANT ALL ON public.divisoes TO service_role;
ALTER TABLE public.divisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar divisoes"
  ON public.divisoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar divisoes"
  ON public.divisoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar divisoes"
  ON public.divisoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar divisoes"
  ON public.divisoes FOR DELETE TO authenticated USING (true);

-- Tabela de membros
CREATE TABLE IF NOT EXISTS public.membros (
  discord_id TEXT PRIMARY KEY,
  discord_username TEXT,
  nome_roblox TEXT,
  nome_rp TEXT,
  genero TEXT,
  altura_jogo NUMERIC,
  estilo_luta_principal TEXT,
  cargo TEXT,
  status TEXT DEFAULT 'Em Analise',
  data_entrada TIMESTAMPTZ DEFAULT now(),
  avatar_hash TEXT,
  divisao_id INTEGER REFERENCES public.divisoes(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.membros TO authenticated;
GRANT ALL ON public.membros TO service_role;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar membros"
  ON public.membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar membros"
  ON public.membros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar membros"
  ON public.membros FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar membros"
  ON public.membros FOR DELETE TO authenticated USING (true);

-- Tabela de treinos
CREATE TABLE IF NOT EXISTS public.treinos (
  id_treino SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_treino TEXT NOT NULL,
  horario TEXT,
  tipo TEXT,
  local TEXT,
  divisao_responsavel TEXT,
  status TEXT DEFAULT 'Aberto',
  criado_por TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treinos TO authenticated;
GRANT ALL ON public.treinos TO service_role;
ALTER TABLE public.treinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar treinos"
  ON public.treinos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar treinos"
  ON public.treinos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar treinos"
  ON public.treinos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar treinos"
  ON public.treinos FOR DELETE TO authenticated USING (true);

-- Tabela de presenças/inscrições em treinos
CREATE TABLE IF NOT EXISTS public.presencas_treino (
  treino_id INTEGER NOT NULL REFERENCES public.treinos(id_treino) ON DELETE CASCADE,
  membro_id TEXT NOT NULL REFERENCES public.membros(discord_id) ON DELETE CASCADE,
  inscricao TEXT,
  presenca TEXT DEFAULT 'Pendente',
  PRIMARY KEY (treino_id, membro_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas_treino TO authenticated;
GRANT ALL ON public.presencas_treino TO service_role;
ALTER TABLE public.presencas_treino ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar presencas"
  ON public.presencas_treino FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar presencas"
  ON public.presencas_treino FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar presencas"
  ON public.presencas_treino FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar presencas"
  ON public.presencas_treino FOR DELETE TO authenticated USING (true);

-- Tabela de punições/advertências
CREATE TABLE IF NOT EXISTS public.punicoes (
  id_punicao SERIAL PRIMARY KEY,
  membro_id TEXT NOT NULL REFERENCES public.membros(discord_id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  motivo TEXT,
  staff_id TEXT,
  data_aplicacao TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.punicoes TO authenticated;
GRANT ALL ON public.punicoes TO service_role;
ALTER TABLE public.punicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar punicoes"
  ON public.punicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar punicoes"
  ON public.punicoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar punicoes"
  ON public.punicoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar punicoes"
  ON public.punicoes FOR DELETE TO authenticated USING (true);

-- Tabela de alianças/parcerias
CREATE TABLE IF NOT EXISTS public.parcerias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tag TEXT,
  contato TEXT,
  status TEXT NOT NULL DEFAULT 'Ativa',
  link_servidor TEXT,
  observacoes TEXT,
  data_inicio DATE,
  icon_hash TEXT,
  representante_id TEXT,
  representante_nome TEXT,
  representante_avatar TEXT,
  fechado_por TEXT,
  fechado_por_nome TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcerias TO authenticated;
GRANT ALL ON public.parcerias TO service_role;
ALTER TABLE public.parcerias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar aliancas"
  ON public.parcerias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar aliancas"
  ON public.parcerias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar aliancas"
  ON public.parcerias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar aliancas"
  ON public.parcerias FOR DELETE TO authenticated USING (true);

-- Tabela opcional: participações em guerra
CREATE TABLE IF NOT EXISTS public.participacoes_guerra (
  id SERIAL PRIMARY KEY,
  membro_id TEXT NOT NULL REFERENCES public.membros(discord_id) ON DELETE CASCADE,
  data_guerra TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participacoes_guerra TO authenticated;
GRANT ALL ON public.participacoes_guerra TO service_role;
ALTER TABLE public.participacoes_guerra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar participacoes"
  ON public.participacoes_guerra FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar participacoes"
  ON public.participacoes_guerra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar participacoes"
  ON public.participacoes_guerra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar participacoes"
  ON public.participacoes_guerra FOR DELETE TO authenticated USING (true);

-- Tabela de logs de partidas (amistosos e guerras)
CREATE TABLE IF NOT EXISTS public.logs_partidas (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'Amistoso',
  adversario_id INTEGER,
  adversario_nome TEXT NOT NULL,
  adversario_guild_id TEXT,
  adversario_icon_hash TEXT,
  pontos_nos INTEGER NOT NULL DEFAULT 0,
  pontos_eles INTEGER NOT NULL DEFAULT 0,
  data_partida DATE DEFAULT now(),
  observacoes TEXT,
  criado_por TEXT,
  criado_por_nome TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_partidas TO authenticated;
GRANT ALL ON public.logs_partidas TO service_role;
ALTER TABLE public.logs_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar logs"
  ON public.logs_partidas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar logs"
  ON public.logs_partidas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem atualizar logs"
  ON public.logs_partidas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuarios autenticados podem deletar logs"
  ON public.logs_partidas FOR DELETE TO authenticated USING (true);

-- Recarrega o cache do schema para o PostgREST enxergar as novas tabelas
NOTIFY pgrst, 'reload schema';


-- ===== Diplomacia entre gangs =====
-- ============================================================
-- Diplomacia entre gangs: relações (aliada/inimiga) e solicitações
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gang_relacoes (
  id SERIAL PRIMARY KEY,
  gang_a_id INTEGER NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  gang_b_id INTEGER NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Aliada', 'Inimiga')),
  definido_por TEXT,
  definido_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (gang_a_id < gang_b_id),
  UNIQUE (gang_a_id, gang_b_id)
);

CREATE TABLE IF NOT EXISTS public.gang_solicitacoes (
  id SERIAL PRIMARY KEY,
  gang_origem_id INTEGER NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  gang_destino_id INTEGER NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Alianca', 'Guerra', 'Treino')),
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Aceita', 'Recusada', 'Encerrada')),
  motivo TEXT,
  data_evento DATE,
  horario TEXT,
  local TEXT,
  membros_origem INTEGER,
  membros_destino INTEGER,
  criado_por TEXT,
  criado_por_nome TEXT,
  respondido_por TEXT,
  respondido_por_nome TEXT,
  respondido_em TIMESTAMPTZ,
  treino_origem_id INTEGER,
  treino_destino_id INTEGER,
  encerrar_origem BOOLEAN NOT NULL DEFAULT false,
  encerrar_destino BOOLEAN NOT NULL DEFAULT false,
  representante_id TEXT,
  representante_nome TEXT,
  representante_avatar TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gang_solicitacoes_destino_idx
  ON public.gang_solicitacoes (gang_destino_id, status);
CREATE INDEX IF NOT EXISTS gang_solicitacoes_origem_idx
  ON public.gang_solicitacoes (gang_origem_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gang_relacoes TO authenticated;
GRANT ALL ON public.gang_relacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gang_solicitacoes TO authenticated;
GRANT ALL ON public.gang_solicitacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gang_relacoes_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gang_solicitacoes_id_seq TO authenticated, service_role;

ALTER TABLE public.gang_relacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Relacoes visiveis" ON public.gang_relacoes;
CREATE POLICY "Relacoes visiveis" ON public.gang_relacoes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Relacoes gravaveis" ON public.gang_relacoes;
CREATE POLICY "Relacoes gravaveis" ON public.gang_relacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Solicitacoes visiveis" ON public.gang_solicitacoes;
CREATE POLICY "Solicitacoes visiveis" ON public.gang_solicitacoes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Solicitacoes gravaveis" ON public.gang_solicitacoes;
CREATE POLICY "Solicitacoes gravaveis" ON public.gang_solicitacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Link permanente do servidor de cada gang (gerado pelo bot).
ALTER TABLE public.gangs ADD COLUMN IF NOT EXISTS convite TEXT;
