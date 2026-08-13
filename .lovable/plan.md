# Plano: Template de configuração para novo servidor

## Objetivo
Deixar o projeto pronto para ser "clonado" em outro servidor/gang sem misturar dados: o usuário copia o banco de dados para um novo Supabase e só troca as variáveis de ambiente.

## O que será feito

### 1. Criar `.env.example` documentado
Arquivo na raiz listando todas as variáveis obrigatórias e opcionais, com explicação de onde pegar cada uma no portal do Discord e do Supabase.

Variáveis incluídas:
- `HAKURYU_SUPABASE_URL`
- `HAKURYU_SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` (se ainda não existir, adicionar suporte)
- `DISCORD_GUILD_ID` (fallback; pode ser sobrescrito no painel)
- `DISCORD_OWNER_ID` (fallback; pode ser sobrescrito no painel)
- `HAKURYU_SESSION_SECRET`

### 2. Tornar `DISCORD_GUILD_ID` e `DISCORD_OWNER_ID` opcionais no `config.server.ts`
Hoje elas são lidas mas não são mais obrigatórias porque o painel já permite configurar guild e donos extras. O servidor não deve falhar na inicialização se elas estiverem vazias.

### 3. Adicionar `DISCORD_REDIRECT_URI` configurável
Hoje o callback monta o redirect URI dinamicamente a partir do `request.url`. Isso funciona, mas para publicação/clonagem é mais seguro permitir fixar a URL no `.env` e validar no callback.

### 4. Criar `SETUP.md` (ou seção no README)
Passo a passo resumido:
1. Criar novo projeto no Supabase e rodar as migrations/tabelas.
2. Criar aplicativo + bot no Discord.
3. Preencher `.env` com os dados do novo servidor.
4. Convidar o bot para o novo servidor com permissões de cargo/canal.
5. Publicar.

## Fora do escopo deste plano
- Multi-tenancy automático (um único banco para várias guilds). A estratégia é clonar o banco por servidor.
- Alterar nomes internos dos cargos (`Lider`, `Vice-Lider`, etc.); os IDs dos cargos no Discord continuam mapeáveis via Configurações.

## Resultado esperado
Qualquer pessoa consegue pegar o projeto, copiar o banco, preencher o `.env.example` renomeado para `.env` e publicar para uma gang diferente sem editar código.
