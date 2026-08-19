-- ============================================================
-- Recursos de eventos Roblox e banner global
-- Execute este script uma única vez no SQL Editor do Supabase.
-- ============================================================

-- Link opcional do servidor privado Roblox de cada treino.
ALTER TABLE public.treinos
  ADD COLUMN IF NOT EXISTS link_servidor_privado TEXT;

-- Link opcional associado aos registros de guerras e amistosos.
ALTER TABLE public.logs_partidas
  ADD COLUMN IF NOT EXISTS link_servidor_privado TEXT;

-- Link enviado junto da proposta de guerra ou treino amistoso.
ALTER TABLE public.gang_solicitacoes
  ADD COLUMN IF NOT EXISTS link_servidor_privado TEXT;

-- O banner global usa as chaves banner_imagem_url e banner_discord_url
-- em dashboard_config; não requer uma tabela nova.
NOTIFY pgrst, 'reload schema';

