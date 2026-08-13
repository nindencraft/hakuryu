# Hakuryū Dashboard — versão web (migração do Streamlit)

Recriar o painel `dashboard.py` como site moderno em React + TypeScript + Tailwind, conectado ao mesmo banco Supabase/Postgres que o bot do Discord já usa. Nenhuma funcionalidade atual será removida — tudo que existe hoje será replicado e melhorado.

## Identidade visual
Dragão branco (白竜) com detalhes dourados, estética japonesa.

- Paleta: branco/marfim (#fdfdf7, #f5f0e8), dourado (#d4af37, #b8860b, #8b6508), cinzas (#2a2a2a, #6b5b3e). Sem vermelho.
- Tipografia serifada elegante para títulos (estilo japonês/editorial), sans limpa para corpo.
- Detalhes mantidos do original: divisórias douradas em gradiente, avatares circulares com borda dourada, textura japonesa sutil no fundo, hover dourado nos botões.
- Melhorias: layout responsivo real (funciona no celular), navegação lateral fixa com estado persistente na URL, cards com hierarquia clara, animações suaves, skeletons de carregamento e toasts em vez de recarregar a página inteira.

## Funcionalidades atuais que serão mantidas 1:1

### Login e controle de acesso
- Login com Discord (OAuth).
- Cargos permitidos: Lider, Vice-Lider, Líder de Divisão, Staff, Recrutador, Membro, Em Analise; mais o dono. Quem não tiver cargo vê a tela de bloqueio.
- Perfil do usuário logado na barra lateral (avatar, nome RP, usuário do Discord).
- Permissões por ação:
  - Gerenciar membros: Lider, Vice-Lider, dono.
  - Gerenciar treinos/presença: Lider, Vice-Lider, Líder de Divisão, dono.
  - Gerenciar divisões: Lider, Vice-Lider, dono.

### Visão Geral
- Métricas: membros ativos, treinos cadastrados, número de divisões.
- Lista dos próximos 5 treinos futuros.

### Membros
- Lista completa com avatar do Discord, nome RP, usuário Discord, Roblox, cargo, divisão e contagem de warns.
- Filtros por cargo, status e divisão.
- Detalhes expandidos: gênero, altura no jogo, estilo de luta, status, data de entrada, warns.
- Estatísticas por membro: treinos internos, amistosos e guerras.
- Ações da liderança: advertir, trocar cargo, ver histórico, remover membro.

### Treinos
- Mural com todos os treinos (data, horário, tipo, status, número de inscritos).
- Criar treino: título, descrição, data, horário, tipo (Interno/Amistoso/Obrigatório/Extra), local, divisão responsável.
- Deletar treino.
- Inscrição/ausência do próprio usuário.
- Marcar presença dos inscritos (Pendente / Presente / Ausente / Justificado).

### Divisões
- Criar divisão: nome, ID do cargo no Discord, logo, função principal.
- Listagem com logo circular, líder, vice-líder e lista de membros.
- Gerenciar: definir líder e vice, adicionar membros.
- Deletar divisão.

### Parcerias
- Aba existe hoje apenas como "em breve". Será entregue funcional: cadastro de aliança (nome, tag, contato, status, link do servidor, data), listagem e edição/remoção pela liderança.

## Melhorias sobre o Streamlit
- Ações "Advertir", "Trocar cargo" e "Histórico" ficam completas em modais funcionais (no código atual elas só marcam estado e não têm tela).
- Busca por nome em Membros, além dos filtros.
- Confirmação antes de remover membro, treino ou divisão (hoje apaga direto no clique).
- Atualização de dados sem recarregar a página inteira; botão de atualizar continua disponível.
- Contadores e listas atualizados na hora após cada ação.
- Estado de "sem conexão com o banco" tratado com mensagem clara por seção.

## Detalhes técnicos
- Stack: TanStack Start (React 19, Vite), Tailwind v4 com tokens semânticos em `src/styles.css`.
- Backend: Lovable Cloud conectado ao mesmo projeto Supabase do bot.
- Tabelas usadas: `membros`, `divisoes`, `treinos`, `presencas_treino`, `punicoes`, `participacoes_guerra`, e uma nova para parcerias.
- Todas as leituras/escritas passam por server functions com verificação de cargo no servidor, não só na interface.
- Login Discord via OAuth do Supabase Auth; vínculo com a tabela `membros` pelo `discord_id`.
- Avatares via CDN do Discord, com fallback padrão.
- Rotas: `/` (Visão Geral), `/membros`, `/treinos`, `/divisoes`, `/parcerias`, `/auth`.

## O que preciso de você durante a implementação
1. Credenciais do Supabase existente (URL e chaves) para conectar ao banco do bot.
2. Client ID/Secret da aplicação Discord para o OAuth.
3. ID do servidor da gang e o critério de "dono" usado hoje no `auth.py`.
