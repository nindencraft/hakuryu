# Corrigir o /registrar do bot após a migração multi-gang

## O que está acontecendo

O comando faz `interaction.response.defer()` logo no início e só responde depois, no `followup`. Quando algo estoura entre os dois pontos, o Discord fica eternamente em "pensando" — foi exatamente o que aconteceu.

O `membros.py` enviado ainda está escrito para o schema antigo, de uma gang só:

- `INSERT INTO membros (...)` não envia `gang_id`, mas hoje a coluna é `bigint NOT NULL` e a chave primária virou `(discord_id, gang_id)`. O insert falha, a exceção sobe e nenhum `followup` é enviado.
- `SELECT 1 FROM membros WHERE discord_id = $1` não filtra por gang: um membro de outro servidor bloquearia o registro aqui.
- `tem_permissao` lê `config_cargos WHERE funcao = $1` sem `gang_id`, e a tabela agora tem chave `(gang_id, funcao)` — pode comparar o cargo de outra gang.
- `/ficha` seleciona a coluna `divisao`, que não existe mais em `membros` (hoje é `divisao_id`) — esse comando também está quebrado.
- `/remover-registro` e `/atualizar-avatar` também escrevem/apagam por `discord_id` sozinho, o que atinge outras gangs.

## O que será feito

Entrego uma versão corrigida do `membros.py` para você substituir no projeto do bot (o bot roda fora deste projeto Lovable, então o arquivo vem pronto para download).

1. **Resolver a gang pelo servidor**: helper que busca `gangs` pelo `guild_id` da interação (ativa). Se o servidor não tiver gang registrada, o comando responde com uma mensagem clara em vez de travar.
2. **Escopo por gang em tudo**: `config_cargos`, `membros` (SELECT/INSERT/UPDATE/DELETE) passam a filtrar e gravar `gang_id`.
3. **Nunca mais "pensando" infinito**: todo comando é envolvido em `try/except`, e qualquer erro vira um `followup` com a mensagem do erro (além do log no console).
4. **Remover a opção "divisão" do `/registrar**`: sai o parâmetro, sai o campo do embed. A divisão continua sendo definida pelo dashboard.
5. **Corrigir `/ficha**`: passa a ler o nome da divisão via `divisao_id` (join com `divisoes`), com "Nenhuma" quando não houver.
6. **Registrar como "Em Analise"**: alinhado com o dashboard, o novo membro entra com cargo/status "Em Analise" em vez de "Recruta"/"Ativo".

## Detalhes técnicos

- Arquivo alvo: `membros.py` do bot (cog `Membros`), entregue como artefato para download; nada no projeto web muda.
- Helper novo: `async def gang_da_guild(interaction)` → `SELECT id FROM gangs WHERE guild_id = $1 AND ativo = true`.
- `INSERT INTO membros (..., gang_id) VALUES (..., $N)`; buscas passam a usar `WHERE discord_id = $1 AND gang_id = $2`.
- `status` precisa respeitar o CHECK atual (`Ativo`, `Inativo`, `Suspenso`, `Banido`) — se usarmos "Em Analise" no cargo, o `status` fica `Ativo`.