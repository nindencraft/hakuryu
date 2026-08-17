# Diplomacia entre gangs: registro, solicitações e guerras

## 1. Aba Alianças ganha "Gangs Registradas"

Abaixo das seções atuais (Gangs aliadas / Gangs inimigas), uma nova seção lista **todas as gangs registradas no sistema**, exceto a sua:

```text
Gangs Registradas
🔎 Pesquisar uma gang...
[ Todas ] [ 🟢 Neutras ] [ 🤝 Aliadas ] [ ⚔️ Inimigas ]

🏛️ Solaris    Status: Neutra    👥 42 membros
🌙 Lunaris    Status: Aliada
```

Cada card mostra o ícone do servidor Discord, o nome, o status atual da relação e a
quantidade de membros registrados. Ao clicar, abre um painel com as ações permitidas:

- 🤝 Solicitar Aliança — some se já for Aliada, ou se houver guerra ativa
- ⚔️ Declarar Guerra — some se já for Inimiga
- 🏋️ Solicitar Treino — sempre disponível (amistoso)

Cada ação abre um formulário: aliança e guerra pedem **motivo**; treino e guerra pedem
**data, horário, local e nº de membros de cada lado**. A solicitação vai para a liderança
da outra gang.

Quem pode solicitar/responder: Dono, Líder e Vice-Líder (mesma regra de alianças).

## 2. Nova aba "Solicitações"

Aba própria na barra lateral, com contador de pendências. Dois grupos: **Recebidas** e
**Enviadas**, cada uma listando tipo, gang, motivo, quem enviou e a data.

- Recebidas pendentes têm [Aceitar] [Recusar].
- Aceitar **aliança** → as duas gangs viram Aliadas (relação simétrica) e a gang entra
  automaticamente na lista de Gangs Aliadas dos dois painéis.
- Aceitar **treino** → cria automaticamente um treino do tipo **Amistoso** nas duas gangs,
  com a gang adversária marcada, na data/horário/local combinados. Aparece na aba Treinos
  normalmente.
- Aceitar **guerra** → as duas gangs viram Inimigas e a guerra fica **ativa**.
- Recusar apenas encerra a solicitação (fica no histórico).

## 3. Aviso de guerra na Visão Geral

Guerras aceitas e ainda não encerradas aparecem no topo da tela principal:

```text
        [logo A]   ⚔️   [logo B]
        Gang A          Gang B
        GUERRA ATIVA
              [ Detalhes ]
```

Detalhes expande: quem solicitou, quem aceitou, membros requisitados de cada lado, local,
data e horário. Liderança pode **Encerrar guerra** (volta a relação para Neutra e permite
registrar o resultado na aba Logs).

## 4. Banco de dados (você roda o SQL)

Gero `sql/diplomacia.sql` (e adiciono ao `schema_hakuryu.sql`) com duas tabelas no padrão
já usado (GRANTs + RLS + políticas):

- `gang_relacoes` — par de gangs (sempre gravado com o menor id primeiro para garantir
  unicidade), `tipo` (`Aliada` | `Inimiga`), quem definiu e quando.
- `gang_solicitacoes` — `gang_origem_id`, `gang_destino_id`, `tipo`
  (`Alianca` | `Guerra` | `Treino`), `motivo`, `status`
  (`Pendente` | `Aceita` | `Recusada` | `Encerrada`), `data_evento`, `horario`, `local`,
  `membros_origem`, `membros_destino`, `criado_por`/`_nome`, `respondido_por`/`_nome`,
  `respondido_em`, `treino_origem_id`, `treino_destino_id`.

Enquanto o SQL não for rodado, as novas seções mostram o mesmo aviso amigável de
"tabela não encontrada" já usado em Alianças e Logs.

## 5. Detalhes técnicos

- `src/lib/diplomacia.server.ts`: `listarGangsRegistradas` (com relação + contagem de
  membros por gang), `criarSolicitacao`, `responderSolicitacao`, `listarSolicitacoes`,
  `listarGuerrasAtivas`, `encerrarGuerra` — todas com `assert` de permissão e escopo por
  `gang_id`. Aceite de treino reaproveita a criação de treino existente.
- `src/lib/dashboard.functions.ts` + `queries.ts`: server fns e query options novos.
- `src/lib/types.ts`: `GangRegistrada`, `SolicitacaoGang`, `GuerraAtiva` e as constantes
  de tipo/status.
- Novo `src/routes/solicitacoes.tsx`; alterações em `src/routes/parcerias.tsx`,
  `src/routes/index.tsx` (ou a Visão Geral do painel) e `DashboardShell.tsx` (link + badge).
- Ícones das gangs vêm do Discord pelo `guild_id` já salvo em `gangs`, com fallback na
  inicial do nome.
- Embeds no Discord: aviso no canal de alianças configurado ao receber/aceitar uma
  solicitação, reaproveitando `discord.server.ts`.

## Sugestões incluídas

- Guerra com estado "ativa/encerrada" para o placar da aba Logs poder ser vinculado depois.
- Solicitação pendente bloqueia duplicatas do mesmo tipo entre as mesmas gangs.
- Histórico de solicitações respondidas fica visível na aba Solicitações.
