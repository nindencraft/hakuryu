# Plano: Template de configuração para novo servidor

## Objetivo
Permitir clonar o dashboard para outro servidor/gang trocando apenas as variáveis de ambiente, sem editar código.

## Escopo aprovado

### 1. Criar `.env.example`
Arquivo na raiz listando todas as variáveis obrigatórias e opcionais, com explicação de onde pegar cada uma no portal do Discord e do Supabase.

Variáveis incluídas:
- `HAKURYU_SUPABASE_URL`
- `HAKURYU_SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` (nova — URL fixa do callback OAuth)
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID` (fallback; pode ser sobrescrito no painel)
- `DISCORD_OWNER_ID` (fallback; pode ser sobrescrito no painel)
- `HAKURYU_SESSION_SECRET`

### 2. Usar `DISCORD_REDIRECT_URI` no callback do Discord
Atualizar `src/lib/config.server.ts` para ler a nova variável e atualizar `src/routes/api/public/auth/discord/callback.ts` para usar o valor do `.env` quando presente. Se não estiver configurado, mantém o comportamento atual (montar a URL dinamicamente a partir do `request.url`).

## Fora do escopo deste plano
- Alterar outras partes do código.
- Implementar multi-tenancy automático.
- Mudar nomes internos dos cargos.

## Resultado esperado
O usuário consegue copiar o projeto, preencher o `.env.example` renomeado para `.env` com os dados do novo servidor (incluindo o domínio publicado), e publicar sem tocar em código.
