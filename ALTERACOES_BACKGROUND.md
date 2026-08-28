# Correção visual dos backgrounds

Foram gerados três assets novos para o tema escuro, todos sem linhas laterais, bordas, molduras ou divisões visíveis:

| Arquivo | Uso | Proporção |
|---|---|---|
| `src/assets/hakuryu-dark-bg-desktop.png` | Fundo principal em telas desktop | 16:9 |
| `src/assets/hakuryu-dark-bg-mobile.png` | Fundo principal em celulares | 9:16 |
| `src/assets/hakuryu-dark-bg-sidebar.png` | Sidebar desktop e drawer mobile | 3:4 |

O CSS agora troca automaticamente o asset principal conforme a largura da tela. Em mobile, a arte vertical é usada com `background-size: cover`, `background-position: center top` e `background-attachment: scroll`, evitando o recorte incorreto e a faixa lateral mostrada na captura.

A sidebar também recebe sua própria arte vertical no tema escuro. O fundo claro legado continua sendo usado quando o tema claro está ativo; no tema escuro, os assets novos substituem os backgrounds legados por meio de classes CSS com prioridade explícita.

Os componentes afetados são o hub público, login, seleção de gang, tela de bloqueio, shell do painel, sidebar desktop e drawer mobile.

Validação: TypeScript sem erros, 19 arquivos de teste e 55 testes aprovados, e build de produção concluído com sucesso. Os backgrounds gerados foram incluídos no pacote final.

## Correção adicional da sidebar

A sidebar e o drawer mobile agora possuem uma superfície própria, isolada e opaca (`hakuryu-sidebar-surface`) com a cor sólida do token `--sidebar`. O background visual permanece contido dentro dessa superfície e não pode atravessar para o conteúdo da página. A imagem interna duplicada do drawer foi removida; o background é aplicado diretamente no próprio painel.

A correção vale para o tema claro e para o escuro, em desktop e mobile. TypeScript, 19 arquivos de teste com 55 testes e o build de produção foram executados com sucesso.

## Correção da rolagem do dashboard

O shell autenticado agora ocupa a altura dinâmica da viewport (`h-dvh`) e bloqueia a rolagem do wrapper externo. A sidebar desktop permanece em uma coluna fixa com rolagem própria, enquanto a área principal recebe `overflow-y-auto` e `overscroll-contain`. Dessa forma, ao descer a página, a lateral não acompanha o conteúdo nem termina no meio da viewport. No mobile, o conteúdo continua rolando normalmente e o drawer permanece controlado pelo Sheet.

## Correções de avatares e datas em Atividade

Os avatares agora suportam hashes estáticos e animados do Discord, tentam primeiro a URL global, depois a URL de avatar específico da guild ativa e finalmente exibem o avatar padrão correspondente ao ID. Isso evita imagens quebradas quando o hash armazenado veio de `Guild Member.avatar` ou quando o membro não possui avatar personalizado.

A página Atividade agora usa a data do próprio evento (`treinos.data_treino`), normalizada para `YYYY-MM-DD`, como fonte da data exibida, filtrada e ordenada. A data de avaliação ou criação do registro de presença não é usada como data do evento.

Validação final: TypeScript aprovado, 20 arquivos de teste aprovados com 59 testes e build de produção concluído.

## Correções mobile e sincronização de avatares

O tema claro do dashboard mobile agora usa a arte clara do projeto e uma camada de leitura baseada em `--background`, sem herdar a arte escura. O bootstrap de tema também remove explicitamente a classe `dark` quando o tema claro está salvo.

O drawer mobile recebeu uma superfície própria, opaca e isolada, continua acima do overlay do Radix e agora renderiza os links usando a sessão já carregada pelo shell, evitando que uma segunda consulta deixe o menu vazio.

O Discord continua sendo a fonte dinâmica dos avatares. O sistema busca o avatar global atual durante o carregamento dos membros, salva somente o novo `avatar_hash` na tabela `membros` quando ele mudou e usa a CDN do Discord para renderizar a imagem. Hashes antigos específicos da guild são migrados pelo endpoint global quando possível, inclusive para membros que já saíram do servidor. Nenhuma imagem é armazenada.

As consultas de membros, divisões e Atividade são atualizadas periodicamente, permitindo refletir uma troca de foto automaticamente sem excluir e recadastrar o membro.
