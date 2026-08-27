# Alterações implementadas no Hakuryū Dashboard

## Resumo

Esta versão implementa a edição administrativa da ficha RPG pelo **Super Owner**, com persistência global por jogador e sincronização automática dos registros de membro em todas as gangs. Também foi adicionada uma matriz granular de permissões para cargos personalizados, incluindo subtópicos de punição, cargos atribuíveis, treinos, divisões, alianças, solicitações, logs e configurações.

## Ficha RPG global

A tela **Membros** agora apresenta o botão **Editar ficha RPG** exclusivamente para o Super Owner. O formulário reutiliza a validação canônica do perfil e grava os campos em `perfis_jogador`; em seguida, replica os mesmos valores em todas as linhas de `membros` com o mesmo `discord_id`. Assim, o perfil do jogador e os demais painéis passam a consultar a mesma ficha.

## Permissões por cargo

O editor de cargos personalizados em **Configurações** passou a oferecer as permissões abaixo, com descrições e seleção independente:

| Área | Permissões implementadas |
|---|---|
| Acesso | Acessar Painel |
| Estatísticas | Avaliar Estatísticas |
| Punições | Dar Advertência, aplicar Warn, aplicar Ban e remover punição do log |
| Membros | Adicionar Membro ao Painel e Alterar Cargo |
| Treinos | Agendar, deletar e gerenciar |
| Divisões | Criar, deletar, gerenciar líder, gerenciar vice-líder, gerenciar membros, definir vice-líder e definir membros |
| Alianças | Criar, editar, solicitar amistoso, solicitar guerra e deletar |
| Solicitações | Ver, deletar e responder |
| Logs | Criar e deletar |
| Configurações | Criar cargos, alterar alerta de inatividade e alterar canais |

Um cargo personalizado também pode receber a lista explícita dos cargos-base que está autorizado a atribuir. O backend valida essa lista e impede atribuições acima da posição do operador ou a cargos que não foram selecionados.

## Membros, Warn e Ban

A tela de membros foi limitada aos tipos **Warn** e **Ban**. Banidos aparecem em uma seção própria abaixo de **Em Análise**, perdem o acesso ao painel independentemente de seus cargos e só retornam mediante o botão **Revogar banimento** no histórico de punições. O backend impede que o seletor comum de status retire um Ban.

A aplicação de Ban exige que o cargo-base do operador seja superior ao cargo-base principal do alvo. Warn não altera o status do integrante. A revogação remove o registro específico e restaura o status para `Ativo` somente quando não existir outro Ban ativo para o mesmo membro na gang.

## Treinos e atividade

O formulário de criação não utiliza mais os campos `obrigatório` e `interno`. No lugar deles, é possível selecionar múltiplas tags entre **Gladiador**, **Equipes**, **Todos x Todos**, **Teórico** e **Prático**. As tags são exibidas como badges no cartão do treino e são gravadas na coluna `tipos`.

O campo legado `tipo` passa a usar `Treino` para os novos registros, preservando `Amistoso` e `Guerra` quando existirem dados antigos compatíveis. A classificação da atividade continua limitada a **Treino**, **Amistoso** e **Guerra**. Os controles de presença, encerramento e adiamento só aparecem e só funcionam para quem criou o treino; a exclusão usa a permissão independente `Treino: deletar`.

## Divisões, alianças, solicitações e logs

As ações visuais e server-side foram separadas por subtópico. A aba **Solicitações** não é exibida para quem não possui `Solicitações: ver`, e o backend também rejeita acesso direto à consulta. Alianças distinguem criação, edição, exclusão, solicitação de amistoso e solicitação de guerra. Logs distinguem criação e exclusão. Divisões distinguem criação, exclusão, liderança, vice-liderança e membros.

## Arquivos modificados

| Arquivo | Finalidade |
|---|---|
| `sql/migracao_permissoes_ficha_treinos.sql` | Cria ficha global, cargos granulares, cargos atribuíveis, configuração de inatividade, coluna de tags e remove a constraint legada de tipos de treino |
| `src/lib/permissoes-painel.ts` | Define a matriz de permissões novas e compatibilidade legada |
| `src/lib/permissions.ts` | Regras client-safe de autorização, cargos atribuíveis, hierarquia e diplomacia |
| `src/lib/session.server.ts` | Permissões, cargos atribuíveis e tipos de punição no servidor |
| `src/lib/cargos-painel.server.ts` | Persistência e resolução dos cargos atribuíveis |
| `src/lib/dashboard.server.ts` | Guards, ficha global, Ban/Warn, revogação, treinos, divisões, alianças, logs e configurações |
| `src/lib/dashboard.functions.ts` | Contratos server-side das novas mutações e campos |
| `src/lib/diplomacia.server.ts` | Guards granulares de alianças e solicitações |
| `src/lib/types.ts` | Tipos, tags de treino e opções Warn/Ban |
| `src/routes/configuracoes.tsx` | Editor de permissões e cargos atribuíveis |
| `src/routes/membros.tsx` | Ficha administrativa, Warn/Ban, seção Banidos e revogação |
| `src/routes/treinos.tsx` | Tags múltiplas e controles do criador |
| `src/routes/divisoes.tsx` | Controles granulares de divisões |
| `src/routes/parcerias.tsx` | Controles granulares de alianças |
| `src/routes/solicitacoes.tsx` | Controles separados de resposta, cancelamento e exclusão |
| `src/routes/logs.tsx` | Controles separados de criação e exclusão |
| `src/components/hakuryu/DashboardShell.tsx` | Navegação condicionada por permissão e bloqueio visual de Ban |
| `src/routes/api/public/gangs/selecionar.ts` | Impede selecionar uma gang que baniu o usuário |
| `src/routeTree.gen.ts` | Registro da rota Atividade que já existia no código, mas estava ausente na árvore gerada |
| `src/components/hakuryu/CampoImagemR2.tsx` | Correção de optional property para compilação estrita |
| `src/components/hakuryu/Explorador.tsx` | Correção de motivo opcional no fluxo de recusa |

## Ordem de aplicação do banco

No banco que já possui a estrutura multigang do dump anexado, execute somente:

```sql
-- SQL Editor do Supabase
-- sql/migracao_permissoes_ficha_treinos.sql
```

Em uma instalação que ainda esteja apenas no schema simples, aplique primeiro o `migracao_multigang.sql` já existente no projeto e depois a migração acima. A migração nova é idempotente para as tabelas e colunas adicionadas. Ela também remove `treinos_tipo_check`, constraint antiga que impediria valores como `Gladiador` ou `Prático` no campo legado `tipo`.

## Validações executadas

A checagem TypeScript foi concluída sem erros com `npx tsc --noEmit --pretty false`. Os testes automatizados foram concluídos com **18 arquivos e 49 testes aprovados** usando Vitest. O build de produção foi concluído com sucesso usando `pnpm run build`.

> Antes de publicar, execute a migração no banco de produção e teste pelo menos estes fluxos: editar ficha como Super Owner; salvar um cargo com permissões e cargos atribuíveis; aplicar Warn; aplicar Ban por cargo superior; tentar Ban por cargo igual ou inferior; revogar o Ban; criar treino com várias tags; e verificar que Solicitações desaparece sem a permissão de visualização.

## Pacote

O arquivo `StreamlittoWeb_alterado.zip` contém o projeto completo sem `node_modules`, `.output` e `dist`, para facilitar o envio e a substituição dos arquivos no ambiente de desenvolvimento.
