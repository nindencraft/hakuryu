-- Hakuryū Dashboard — migração incremental da permissão Editar ficha RPG
-- Execute caso o banco já tenha recebido a migração anterior.

ALTER TABLE public.cargos_painel_personalizados
  DROP CONSTRAINT IF EXISTS cargos_painel_personalizados_permissoes_validas;

ALTER TABLE public.cargos_painel_personalizados
  ADD CONSTRAINT cargos_painel_personalizados_permissoes_validas CHECK (
    COALESCE(permissoes, ARRAY[]::TEXT[]) <@ ARRAY[
      'acessar_painel', 'avaliar_estatisticas', 'editar_ficha_rpg',
      'advertencia_dar', 'advertencia_warn', 'advertencia_ban', 'advertencia_remover',
      'adicionar_membro', 'alterar_cargo',
      'treino_agendar', 'treino_deletar', 'treino_gerenciar',
      'divisao_criar', 'divisao_deletar', 'divisao_gerenciar_lider',
      'divisao_gerenciar_vice', 'divisao_gerenciar_membro',
      'divisao_definir_vice', 'divisao_definir_membros',
      'alianca_criar', 'alianca_editar', 'alianca_solicitar_amistoso',
      'alianca_solicitar_guerra', 'alianca_deletar',
      'solicitacoes_ver', 'solicitacoes_deletar', 'solicitacoes_responder',
      'logs_criar', 'logs_deletar',
      'configuracoes_criar_cargos', 'configuracoes_inatividade', 'configuracoes_canais',
      'gerenciar_membros', 'gerenciar_eventos', 'gerenciar_divisoes',
      'gerenciar_parcerias', 'gerenciar_advertencias', 'avaliar_atributos',
      'ver_logs', 'gerenciar_recrutamento'
    ]::TEXT[]
  );

NOTIFY pgrst, 'reload schema';
