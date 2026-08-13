# Alianças (antiga aba Parcerias)

## O que muda

**1. Renomear a aba**
"Parcerias" vira "Alianças" em toda a interface (menu lateral, título da página, textos e título da guia do navegador). O endereço da página continua o mesmo para não quebrar links.

**2. Adicionar aliança pelo link do servidor**
Botão "Adicionar aliança" abre um formulário onde basta colar o **link de convite do Discord** da gang aliada (ex.: `discord.gg/abc123`). O sistema consulta o Discord e preenche automaticamente:

- Ícone/foto do servidor aliado
- Nome do servidor
- Link de contato (o próprio convite)

Campos preenchidos à mão:

- Representante deles (nome/usuário do contato)
- Status da aliança (Ativa, Em negociação, Pausada, Encerrada)
- Observações

Quem fechou a aliança e a data são gravados automaticamente com base em quem está logado.

Se o link estiver inválido ou expirado, aparece um aviso e dá para preencher nome e ícone manualmente.

**3. Lista em formato de cards, no estilo da lista de membros**
Cada aliança mostra: avatar redondo do servidor (com moldura dourada), nome do servidor, tag/representante, status como badge, quem fechou a aliança e desde quando, botão "Abrir servidor" e um **X no canto superior direito** para deletar (com confirmação).

**4. Permissões**
Somente **Dono, Líder e Vice-Líder** podem adicionar, editar ou deletar alianças. Os demais cargos apenas visualizam. A regra é aplicada tanto na interface quanto no servidor.

**5. Treino amistoso com gang aliada**
No formulário de treino, ao escolher o tipo **Amistoso**, aparece um seletor com as alianças ativas ("Contra qual gang?"). A gang escolhida aparece no card do treino como badge (ex.: "Amistoso vs. [Nome da gang]") e na lista de treinos finalizados.

## Detalhes técnicos

- **Resolver convite**: `GET https://discord.com/api/v10/invites/{code}?with_counts=true` (endpoint público, sem token) devolve `guild.id`, `guild.name`, `guild.icon`. Ícone montado via `cdn.discordapp.com/icons/{guild_id}/{icon}.png`. Nova função em `src/lib/discord.server.ts`: `resolverConvite(url)`.
- **Persistência sem migração**: a tabela `parcerias` existente é reaproveitada — `nome` = nome do servidor, `tag` = ID do servidor, `link_servidor` = convite, `contato` = representante, `data_inicio` = data do acordo. Os campos novos (hash do ícone e quem fechou) são gravados em `observacoes` com um marcador no fim do texto, mesmo padrão já usado para adiamento de treino, e são separados na leitura. Se depois você quiser colunas próprias (`icon_hash`, `fechado_por`), o código passa a usá-las automaticamente quando existirem.
- **Aliado do treino**: guardado como marcador `[ALIADO|nome]` no fim de `descricao` do treino (mesma técnica do adiamento), evitando alterar o schema usado pelo bot.
- **Server functions** em `src/lib/dashboard.server.ts`: `resolverConviteAliado`, `salvarAlianca`, `deletarAlianca`, todas com `assert(podeGerenciarMembros(user))`; `loadParcerias` passa a devolver os campos extras.
- **Permissões**: `podeGerenciarParcerias` já resolve para Dono/Líder/Vice-Líder — confirmado, sem mudança.
- Arquivos tocados: `src/routes/parcerias.tsx`, `src/routes/treinos.tsx`, `src/components/hakuryu/DashboardShell.tsx` (rótulo do menu), `src/lib/discord.server.ts`, `src/lib/dashboard.server.ts`, `src/lib/dashboard.functions.ts`, `src/lib/types.ts`, `src/lib/queries.ts`.
