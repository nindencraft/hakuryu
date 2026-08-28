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
