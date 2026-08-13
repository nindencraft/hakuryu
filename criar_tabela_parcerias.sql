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

COMMENT ON COLUMN public.parcerias.icon_hash IS 'Hash do icone do servidor Discord aliado';
COMMENT ON COLUMN public.parcerias.representante_id IS 'ID do Discord do representante da gang aliada';
COMMENT ON COLUMN public.parcerias.representante_nome IS 'Nome de exibicao do representante';
COMMENT ON COLUMN public.parcerias.representante_avatar IS 'Hash do avatar do representante';
COMMENT ON COLUMN public.parcerias.fechado_por IS 'ID do Discord do usuario que fechou a alianca';
COMMENT ON COLUMN public.parcerias.fechado_por_nome IS 'Nome de exibicao de quem fechou a alianca';

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
