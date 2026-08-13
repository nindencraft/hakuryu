# Plano: Dashboard Web da Gang (ex-Streamlit)

## Visão geral
Recriar o dashboard atual do Streamlit como um site web moderno (React + TypeScript + Tailwind CSS), conectado ao mesmo banco de dados Supabase que o bot do Discord já utiliza. O acesso será via login do Discord e só permitirá usuários que estejam no servidor da gang com o cargo de "membro oficial". O visual seguirá a identidade da gang: dragão branco com detalhes dourados, estética japonês/dracônica.

## Fases do projeto

### 1. Entrega e análise do dashboard Streamlit
- O usuário envia o arquivo/código do dashboard Streamlit.
- Mapear todas as telas, formulários, tabelas e comandos disponíveis hoje.
- Identificar quais ações são apenas leitura de dados e quais disparam comandos no bot.
- Listar as tabelas/colunas do Supabase que o dashboard já usa.

### 2. Setup do backend
- Habilitar Lovable Cloud (Supabase) no projeto.
- Conectar ao projeto Supabase existente do bot usando as credenciais atuais (URL, publishable key, service role key).
- Garantir que as tabelas do Supabase tenham as permissões (GRANTs) e políticas RLS corretas para o novo site.
- Criar/ajustar tabela de roles (`user_roles`) se o dashboard precisar de permissões diferenciadas (ex: oficiais vs. membros).

### 3. Autenticação com Discord
- Implementar login via Discord usando o fluxo OAuth da Lovable/Supabase.
- Após o login, verificar no servidor da gang via API do Discord se o usuário:
  - Está no servidor correto;
  - Possui o cargo de "membro oficial".
- Usuários sem o cargo são bloqueados com mensagem clara.
- Sessão persistente e logout.

### 4. Design system
- Definir tokens de cor: branco, dourado, cinza escuro e toques de vermelho/coral se necessário.
- Escolher tipografia com estilo japonês/dracônico (sem serif genérica, com peso e traço marcantes).
- Criar componentes base: botões dourados, cards com bordas sutis, tabelas, formulários, modais, badges de rank.
- Aplicar o tema no modo claro (base branca) com acentos dourados.

### 5. Funcionalidades principais (replicadas do Streamlit)
Com base no código que será enviado, implementar as telas equivalentes, por exemplo:
- **Gerenciamento de membros**: visualizar lista, alterar rank, aplicar advertências/avisos, histórico de punições.
- **Treinos**: criar/agendar treinos, listar próximos treinos, confirmar presença/faltas.
- **Alianças**: cadastrar novas alianças, listar alianças ativas, detalhes.
- **Painel inicial**: estatísticas rápidas da gang (total de membros, avisos pendentes, próximos treinos, alianças).
- Outras telas identificadas na análise do Streamlit.

### 6. Integração com o bot do Discord
- Criar server functions (`createServerFn`) para executar ações que hoje o dashboard faz no bot.
- Onde o bot já expõe endpoints ou reage a inserções no Supabase, reutilizar esse mecanismo.
- Onde não existir, criar novas funções seguras que escrevem no Supabase e/ou chamam a API do Discord via token do bot (armazenado como secret).
- Validar permissões do usuário antes de executar qualquer comando administrativo.

### 7. Testes e ajustes
- Validar login com Discord e verificação de cargo.
- Testar cada fluxo de leitura e escrita no Supabase.
- Verificar responsividade em desktop e mobile.
- Revisar permissões RLS e GRANTs.

### 8. Publicação
- Publicar o site.
- Entregar URLs de preview e produção.
- Instruir sobre como atualizar secrets/credenciais no futuro.

## Detalhes técnicos
- Framework: TanStack Start (React 19 + Vite), já presente no projeto.
- Estilo: Tailwind CSS v4 com tokens semânticos customizados em `src/styles.css`.
- Backend: Supabase via Lovable Cloud; server functions para lógica segura.
- Auth: OAuth Discord através do Supabase Auth + verificação de cargo via API do Discord.
- Dados: reutilizar o mesmo Supabase do bot; ajustar RLS/políticas conforme necessário.

## Próximos passos imediatos
1. Enviar o arquivo/código do dashboard Streamlit para análise.
2. Confirmar se o bot do Discord já tem um token de bot registrado e se pode ser compartilhado como secret.
3. Aprovar este plano para iniciar a implementação.
