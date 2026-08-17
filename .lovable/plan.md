# Multi-gang: avaliação e plano de migração

## O que eu encontrei

Comparei o projeto que está aqui na Lovable com o ZIP que você mandou e com o novo `schema_database.txt`.

**O código da Lovable está desatualizado.** O ZIP tem coisas que não existem aqui: `src/lib/gangs.server.ts`, `MemberAttributeRadar.tsx` (stats), sessão com `gangId`/`guildId`, `settings.server.ts` com `gang_config` e o callback do Discord já listando as gangs do usuário. Então o passo zero é trazer o ZIP para o projeto (sem `.git`, sem `.output`/`.wrangler`).

**O que você já fez (e está certo):**
- Banco: tabela `gangs` (id, nome, guild_id, ativo, lider_id) e `gang_config` (por gang), `gang_id` espalhado em `membros`, `divisoes`, `punicoes`, `presencas_treino`, `membro_atributos`, etc. PK composta `membros(discord_id, gang_id)`.
- `gangs.server.ts` completo: criar/atualizar/desativar gang, `listarGangsDoUsuario(guildIds)`, `gangDoServidor`.
- Sessão já carrega `gangId` + `guildId` com compatibilidade retroativa.
- Callback já pede scope `guilds`, lista as guilds do usuário e cruza com `gangs`.
- Stats/atributos (radar, histórico) já implementados.

**Os buracos que faltam fechar:**
1. `dashboard.server.ts` (1487 linhas) e `dashboard.functions.ts` **não filtram por `gang_id` em lugar nenhum** — todo `select/insert/update/delete` ainda é global. Hoje, com duas gangs no banco, uma veria os dados da outra.
2. Não existe tela de seleção de gang. O callback só resolve automaticamente quando o usuário tem exatamente 1 gang; com 2+ ele entra sem gang e o painel quebra silenciosamente.
3. Super Owner ainda não consegue escolher gang nem cadastrar gang — não há UI nem server functions para isso.
4. `discord.server.ts` e várias partes ainda usam `guildIdAtivo()` (guild única vinda de `dashboard_config`/env) em vez da guild da gang ativa na sessão.
5. Tabelas que ainda **não** têm `gang_id`: `parcerias`, `logs_partidas`, `treinos`, `treinos_internos`, `treinos_amistosos`, `guerras`, `inimigos`, `config_cargos`. Alianças e logs vão misturar entre gangs.
6. `SUPER_OWNER_IDS` está fixo no código; o gate "bot está no servidor" ainda não é verificado (hoje se usa a lista de guilds do usuário, o que não permite o Super Owner entrar num server onde ele não está).

## Plano por etapa

### Etapa 0 — Sincronizar o código
Copiar o ZIP por cima de `src/` (exceto `.git`, `.output`, `.wrangler`, `node_modules`) para o projeto passar a refletir o que você já fez.

### Etapa 1 — Fechar o banco
Migração SQL adicionando `gang_id bigint NOT NULL REFERENCES gangs(id)` em `parcerias`, `logs_partidas`, `treinos`, `guerras`, `inimigos`, `config_cargos` (+ backfill para a gang existente e índices por `gang_id`).

### Etapa 2 — Contexto de gang no servidor
- `requireUser(request)` passa a devolver `{ user, gang }` e a validar que a gang existe/está ativa.
- Toda função de `dashboard.server.ts` recebe `gangId` e aplica `.eq("gang_id", gangId)` em leitura e escrita. Isso é o grosso do trabalho.
- `discord.server.ts` passa a receber a `guild_id` da gang ativa em vez de `guildIdAtivo()`.
- `settings.server.ts`: `loadConfiguracoes`/`salvar` só por `gang_config`; `dashboard_config` fica só para coisas globais (super owners).

### Etapa 3 — Login e troca de gang
- Callback: com o token do usuário lista as guilds dele; cruza com `gangs` ativas **e** com a lista de guilds onde o bot está (`GET /users/@me/guilds` com o token do bot). Para Super Owner, o conjunto passa a ser "todas as gangs onde o bot está", ignorando se ele é membro.
- Nova tela `/gangs` (seletor): cards com ícone/nome do servidor; escolher grava `gangId` na sessão (novo endpoint `POST /api/public/gang/selecionar`). Se só houver uma, entra direto.
- Header/sidebar ganha um botão "Trocar de gang".
- Se o usuário não tem nenhuma gang, tela explicando que o bot precisa ser adicionado.

### Etapa 4 — Painel do Super Owner
Nova aba `/admin` (visível só para Super Owner):
- Lista de gangs registradas com nome, servidor, líder, ativo, nº de membros, data de criação.
- Registrar gang: nome + guild ID (valida que o bot está no servidor) + escolher o líder (busca membro do servidor pelo Discord) → grava em `gangs` e dá o cargo de Líder.
- Ações: renomear, trocar líder, ativar/desativar, entrar na gang (impersonar contexto para administrar).

### Etapa 5 — Permissões
`permissions.ts`/`session.server.ts` ganham `ehSuperOwner` acima de tudo, e `podeAdministrarGangs()`. Cargos continuam lidos do Discord da guild da gang ativa.

### Etapa 6 — Ajustes de UI
Todas as páginas (`membros`, `treinos`, `divisoes`, `parcerias`, `logs`, `configuracoes`) passam a exibir a gang ativa no topo e invalidar as queries do TanStack Query quando a gang muda (chave de query com `gangId`).

## Ordem sugerida
0 → 1 → 2 → 3 → 4 → 5 → 6. As etapas 1 e 2 são as críticas: sem elas, o multi-gang vaza dados entre servidores.

## Decisões que preciso de você
- Confirmar que posso sobrescrever o código atual do projeto com o do ZIP.
- Super Owner: manter fixo no código, ou migrar para uma tabela `super_owners` no banco?
- Alianças/logs: cada gang tem as suas (recomendado) ou continuam globais?
