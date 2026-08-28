# Alterações desta rodada

## Permissão Editar ficha RPG

Foi adicionada à matriz de cargos personalizados a permissão **Editar ficha RPG** (`editar_ficha_rpg`). Ela aparece automaticamente no editor da aba **Configurações** junto das demais permissões.

A regra server-side e a interface agora permitem editar a ficha RPG quando o operador é **Super Owner**, dono da gang, possui a permissão personalizada `editar_ficha_rpg`, ou possui um dos cargos padrão **Líder**, **Vice-Líder** ou **Líder de Divisão**. A gravação continua usando a ficha global, sincronizando o perfil do jogador e os registros de membro nas gangs.

## Tema escuro persistente

Foi criado um botão global, fixado no canto inferior direito, disponível em todas as páginas do site. Ele alterna entre tema claro e escuro, atualiza o ícone e salva a escolha no `localStorage` com a chave `hakuryu-theme`. Ao recarregar ou abrir outra página, a preferência é restaurada automaticamente.

O tema escuro foi conectado ao documento raiz para evitar o flash de tema incorreto durante o carregamento. A paleta escura existente foi ativada para o fundo, cartões, popovers, sidebar, bordas, inputs, gradientes e textos. Fundos claros fixos nas telas públicas, perfil, recrutamento, explorador, seleção de gang, login e bloqueio também foram substituídos por tokens adaptáveis. A logo existente foi preservada, pois já possui contraste adequado sobre o fundo escuro.

## Banco de dados

A migração principal `sql/migracao_permissoes_ficha_treinos.sql` foi atualizada para aceitar `editar_ficha_rpg` na constraint `cargos_painel_personalizados_permissoes_validas`.

Para um banco que já recebeu a migração anterior, execute apenas:

```sql
-- sql/migracao_editar_ficha_rpg.sql
```

Essa migração remove e recria a constraint com as permissões novas e legadas. Os cargos padrão não precisam ser gravados na tabela, pois a autorização padrão é resolvida diretamente pelo servidor.

## Arquivos alterados ou adicionados

| Arquivo | Alteração |
|---|---|
| `src/lib/permissoes-painel.ts` | Nova chave e descrição `editar_ficha_rpg` |
| `src/lib/permissions.ts` | Helper client-safe `podeEditarFichaRPG` |
| `src/lib/session.server.ts` | Helper server-side com defaults de Super Owner, dono, Líder, Vice-Líder e Líder de Divisão |
| `src/lib/dashboard.server.ts` | Guard do endpoint de edição da ficha |
| `src/routes/membros.tsx` | Botão condicionado à nova regra de permissão |
| `src/routes/__root.tsx` | Bootstrap persistente do tema e botão global |
| `src/components/hakuryu/ThemeToggle.tsx` | Novo controle de alternância e persistência do tema |
| `src/styles.css` | Ativação do color scheme escuro e tokens já existentes |
| `src/components/hakuryu/DashboardShell.tsx` | Cartões e bloqueios adaptáveis ao tema |
| `src/components/hakuryu/HubLayout.tsx` | Login e header públicos adaptáveis ao tema |
| `src/components/hakuryu/Explorador.tsx` | Cartões e estados adaptáveis ao tema |
| `src/components/hakuryu/PerfilJogador.tsx` | Cartões do perfil adaptáveis ao tema |
| `src/components/hakuryu/Recrutamento.tsx` | Cartões de recrutamento adaptáveis ao tema |
| `src/routes/index.tsx` | Anúncios e estados vazios adaptáveis ao tema |
| `src/routes/selecionar-gang.tsx` | Cartão principal adaptável ao tema |
| `sql/migracao_permissoes_ficha_treinos.sql` | Inclusão da nova chave na constraint |
| `sql/migracao_editar_ficha_rpg.sql` | Migração incremental para bancos existentes |

## Validações

A checagem TypeScript foi concluída sem erros. Os testes automatizados foram concluídos com **19 arquivos e 55 testes aprovados**. O build de produção também foi concluído com sucesso.
