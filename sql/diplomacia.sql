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

-- Encerramento de guerra em duas mãos: só encerra quando as duas gangs pedem.
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS encerrar_origem BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS encerrar_destino BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

-- Representante indicado na solicitação (aparece no card da gang aliada/inimiga).
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS representante_id TEXT;
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS representante_nome TEXT;
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS representante_avatar TEXT;

NOTIFY pgrst, 'reload schema';
