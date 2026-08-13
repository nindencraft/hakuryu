# Plano: Como editar o `.env` e clonar o banco de dados para outro servidor

## Objetivo
Deixar o dashboard Hakuryū pronto para ser copiado para outra gang/servidor sem editar código, apenas trocando variáveis de ambiente e importando o schema do banco em um novo projeto Supabase.

## Parte 1 — Editar as configurações no `.env`

1. Na raiz do projeto existe o arquivo `.env.example`. Faça uma cópia dele com o nome `.env`.
2. Preencha cada variável conforme explicado abaixo.
3. Quando publicar pelo Lovable, as variáveis do `.env` são lidas automaticamente (ou podem ser cadastradas como segredos no painel do projeto).

### Variáveis e onde pegar cada valor

| Variável | O que é | Onde pegar |
|---|---|---|
| `HAKURYU_SUPABASE_URL` | URL do projeto Supabase | Supabase > Project Settings > API > URL |
| `HAKURYU_SUPABASE_SERVICE_ROLE_KEY` | Service Role Key do Supabase | Supabase > Project Settings > API > service_role key |
| `DISCORD_CLIENT_ID` | Client ID do aplicativo OAuth do Discord | Discord Developer Portal > OAuth2 > Client ID |
| `DISCORD_CLIENT_SECRET` | Client Secret do aplicativo OAuth | Discord Developer Portal > OAuth2 > Client Secret |
| `DISCORD_REDIRECT_URI` | URL fixa de callback OAuth | Use a URL publicada do novo site + `/api/public/auth/discord/callback`. Exemplo: `https://nomedoprojeto.lovable.app/api/public/auth/discord/callback` |
| `DISCORD_BOT_TOKEN` | Token do bot do Discord | Discord Developer Portal > Bot > Token |
| `DISCORD_GUILD_ID` | ID do servidor do Discord (fallback) | Discord > Configurações do servidor > Widget > Server ID |
| `DISCORD_OWNER_ID` | ID do dono do painel (fallback) | Discord > clique com o botão direito no usuário > Copiar ID de usuário |
| `HAKURYU_SESSION_SECRET` | Chave secreta para assinar cookies | Gere um valor aleatório forte, por exemplo com: `openssl rand -hex 32` |

### Observações importantes

- `DISCORD_REDIRECT_URI` deve ser exatamente igual à URL cadastrada no Discord Developer Portal em "Redirects".
- `DISCORD_GUILD_ID` e `DISCORD_OWNER_ID` podem ser ajustados depois dentro do painel, na aba "Configurações", sem precisar mexer no `.env`.
- O bot do Discord precisa estar no servidor com permissões de gerenciar cargos, canais e membros.

## Parte 2 — Clonar o banco de dados no Supabase

### Opção A: Usar o SQL abaixo em um projeto Supabase novo

1. Crie um novo projeto no Supabase.
2. Vá em "SQL Editor" > "New query".
3. Cole o script abaixo e execute.
4. O schema estará pronto para receber os dados.

```sql
-- ============================================================
-- Schema Hakuryū Dashboard
-- Cole isto no SQL Editor de um projeto Supabase novo
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

-- Recarrega o cache do schema para o PostgREST enxergar as novas tabelas
NOTIFY pgrst, 'reload schema';
```

### Opção B: Copiar os dados do banco antigo também

Se quiser levar os dados (membros, treinos, divisões, etc.) para o novo projeto:

1. No Supabase antigo, vá em "Database" > "Backups" e faça um backup, ou use o botão "Export" nas tabelas.
2. Outra forma: no SQL Editor do Supabase antigo, rode `pg_dump` via ferramenta externa (ex: `pg_dump -h <host> -U postgres -d postgres > backup.sql`) e depois importe no novo projeto.
3. No novo projeto, vá em "Database" > "Migrations" ou "SQL Editor" e importe o arquivo `.sql`.

### Depois de criar as tabelas

1. Acesse o dashboard publicado do novo projeto.
2. Faça login com o Discord.
3. Vá na aba "Configurações" e preencha:
   - ID do servidor do Discord (Guild ID)
   - IDs dos cargos (Líder, Vice-Líder, Capitão, etc.)
   - IDs dos canais (treinos, alianças, advertências)
   - IDs dos donos do painel
4. Pronto. O painel já vai ler o novo servidor e permitir que os membros dele façam login.

## Fora do escopo deste plano

- Migração automática de dados entre gangs.
- Multi-tenancy (vários servidores no mesmo banco).
- Alterar nomes internos dos cargos no código.

## Resultado esperado

O usuário consegue copiar o projeto, preencher o `.env` com os dados do novo servidor, importar o schema SQL em um Supabase novo, e publicar o dashboard sem precisar editar código.
