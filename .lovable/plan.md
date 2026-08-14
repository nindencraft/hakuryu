# Aba Logs (Amistosos e Guerras) + Gangs Inimigas

## O que muda para o usuário

### 1. Alianças passam a ter dois grupos
- Ao adicionar/editar uma gang, além do status atual, existe um campo **Relação**: `Aliada` ou `Inimiga`.
- A página passa a mostrar duas seções: **GANGS ALIADAS** e **GANGS INIMIGAS**, cada uma com seus cartões (logo, representante, contato, quem fechou, X para deletar).
- Continua restrito a Líder e Vice-Líder criar/editar/deletar.

### 2. Nova aba "Logs" na barra lateral
- Duas abas internas: **Amistosos** e **Guerras**.
- Cada log aparece como um placar estilo futebol:

```text
   [logo Hakuryū]        3  x  1        [logo da outra gang]
      Hakuryū                                Gang X
```

- As logos vêm dos ícones dos servidores do Discord: a nossa usa a **Guild ID** salva em Configurações, e a adversária usa a guild da aliança/inimiga cadastrada. Se não houver ícone, mostra a inicial do nome.
- Cada cartão tem **Detalhes**, que abre/expande as **observações** escritas sobre o treino ou a guerra, mais data e quem registrou.
- Botão **Criar log** com: tipo (Treino Amistoso / Guerra), gang adversária (lista de **aliadas** se amistoso, de **inimigas** se guerra), pontuação nossa, pontuação deles, data e observações.
- Deletar log pelo mesmo "X" usado nas outras abas.
- Quem pode criar/deletar: Dono, Líder, Vice-Líder e Capitães (mesma regra de quem gerencia treinos). Todos os membros podem visualizar.
- Ao criar um log, um embed é postado no canal do Discord configurado (reutiliza o canal de treinos; se você quiser um canal próprio de logs, adiciono o campo em Configurações).

## Banco de dados (você roda o SQL)

Como o banco é seu, vou gerar um arquivo `sql/logs_partidas.sql` para colar no SQL Editor do Supabase, contendo:
- `CREATE TABLE public.logs_partidas` (id, tipo, adversario_id, adversario_nome, adversario_guild_id, adversario_icon_hash, pontos_nos, pontos_eles, data_partida, observacoes, criado_por, criado_por_nome), com GRANTs, RLS e políticas no mesmo padrão das outras tabelas.
- Atualização do `parcerias_status_check` (ou uso de uma marca em `observacoes`, caso a constraint não possa mudar) para aceitar a relação `Inimiga`.
- `NOTIFY pgrst, 'reload schema';`

O mesmo conteúdo é adicionado ao `schema_hakuryu.sql` para novas clonagens.

## Detalhes técnicos

- `src/lib/types.ts`: novo tipo `LogPartida`, opções `TIPO_LOG_OPCOES` (`Amistoso`, `Guerra`) e `RELACAO_GANG_OPCOES` (`Aliada`, `Inimiga`); `Parceria` ganha `relacao`.
- `src/lib/dashboard.server.ts`: `loadLogs`, `salvarLog`, `deletarLog` (com `assert` de permissão), tratando tabela ausente como as parcerias fazem; a relação Aliada/Inimiga é persistida na coluna própria quando existir e, como fallback, na marca `[ALIANCA|...]` já usada em `observacoes`.
- `src/lib/discord.server.ts`: `fetchGuildInfo(guildId)` (bot token) para pegar o ícone da nossa guild; resultado em cache curto.
- `src/lib/dashboard.functions.ts` + `src/lib/queries.ts`: server fns e `logsQuery`.
- Nova rota `src/routes/logs.tsx` com `head()` próprio, cartões de placar, filtro por tipo e diálogos de criação/exclusão; link novo em `DashboardShell`.
- `src/routes/parcerias.tsx`: campo Relação no formulário e separação em duas seções.
- Sem mudanças no fluxo de treinos existente.
