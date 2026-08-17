# Etapa 1 — Terminar a migração do banco (multi-gang)

Objetivo: toda tabela de dados passar a ter `gang_id`, os dados atuais irem para a gang existente, e as configurações antigas (`dashboard_config`) virarem `gang_config`.

## O que já está pronto no seu banco
`gangs`, `gang_config`, e `gang_id` em: `membros` (PK composta), `divisoes`, `punicoes`, `presencas_treino`, `participacoes_guerra`, `membro_atributos`, `historico_atributos_membro`, `avaliacoes_treino`, `avaliacoes_lideranca`, `votos_recrutamento`.

## O que ainda falta
Sem `gang_id` (vão misturar dados entre gangs): `treinos`, `parcerias`, `logs_partidas`, `guerras`, `inimigos`, `config_cargos`, `treinos_internos`, `treinos_amistosos`.
Além disso, várias colunas `gang_id` estão como NULL-ável e sem índice.

## Passo a passo no SQL Editor do Supabase

### 1. Garantir que a sua gang atual existe
```sql
insert into public.gangs (nome, guild_id, ativo, lider_id)
values ('Hakuryū', 'SEU_GUILD_ID_AQUI', true, 'SEU_DISCORD_ID')
on conflict (guild_id) do nothing;

select id, nome, guild_id from public.gangs;  -- anote o id (ex.: 1)
```

### 2. Adicionar `gang_id` nas tabelas que faltam
```sql
alter table public.treinos            add column if not exists gang_id bigint;
alter table public.parcerias          add column if not exists gang_id bigint;
alter table public.logs_partidas      add column if not exists gang_id bigint;
alter table public.guerras            add column if not exists gang_id bigint;
alter table public.inimigos           add column if not exists gang_id bigint;
alter table public.config_cargos      add column if not exists gang_id bigint;
alter table public.treinos_internos   add column if not exists gang_id bigint;
alter table public.treinos_amistosos  add column if not exists gang_id bigint;
```

### 3. Backfill: mandar tudo que já existe para a gang atual
Troque `1` pelo id anotado no passo 1.
```sql
update public.treinos            set gang_id = 1 where gang_id is null;
update public.parcerias          set gang_id = 1 where gang_id is null;
update public.logs_partidas      set gang_id = 1 where gang_id is null;
update public.guerras            set gang_id = 1 where gang_id is null;
update public.inimigos           set gang_id = 1 where gang_id is null;
update public.config_cargos      set gang_id = 1 where gang_id is null;
update public.treinos_internos   set gang_id = 1 where gang_id is null;
update public.treinos_amistosos  set gang_id = 1 where gang_id is null;

-- tabelas que já tinham a coluna, mas com linhas antigas em NULL
update public.membros                     set gang_id = 1 where gang_id is null;
update public.divisoes                    set gang_id = 1 where gang_id is null;
update public.punicoes                    set gang_id = 1 where gang_id is null;
update public.presencas_treino            set gang_id = 1 where gang_id is null;
update public.participacoes_guerra        set gang_id = 1 where gang_id is null;
update public.membro_atributos            set gang_id = 1 where gang_id is null;
update public.historico_atributos_membro  set gang_id = 1 where gang_id is null;
update public.avaliacoes_treino           set gang_id = 1 where gang_id is null;
update public.avaliacoes_lideranca        set gang_id = 1 where gang_id is null;
update public.votos_recrutamento          set gang_id = 1 where gang_id is null;
```

### 4. Tornar obrigatório + chave estrangeira
```sql
do $$
declare t text;
begin
  foreach t in array array[
    'treinos','parcerias','logs_partidas','guerras','inimigos','config_cargos',
    'treinos_internos','treinos_amistosos','punicoes','presencas_treino',
    'participacoes_guerra','historico_atributos_membro','avaliacoes_treino',
    'avaliacoes_lideranca','votos_recrutamento'
  ] loop
    execute format('alter table public.%I alter column gang_id set not null', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (gang_id) references public.gangs(id) on delete cascade',
      t, t || '_gang_id_fkey');
    execute format('create index if not exists %I on public.%I (gang_id)', 'idx_' || t || '_gang', t);
  end loop;
end $$;
```
(Se alguma constraint já existir, o erro é só de duplicidade — pode ignorar rodando as linhas uma a uma.)

### 5. Chaves únicas que precisam virar "por gang"
`config_cargos` hoje tem PK só em `funcao`, então duas gangs não conseguem ter cargos diferentes:
```sql
alter table public.config_cargos drop constraint config_cargos_pkey;
alter table public.config_cargos add primary key (gang_id, funcao);
```
Divisões: evitar nomes repetidos dentro da mesma gang.
```sql
create unique index if not exists uq_divisoes_gang_nome
  on public.divisoes (gang_id, nome_divisao);
```

### 6. Migrar as configurações antigas para `gang_config`
```sql
insert into public.gang_config (gang_id, chave, valor)
select 1, chave, valor from public.dashboard_config
where chave <> 'guild_id'
on conflict (gang_id, chave) do update set valor = excluded.valor;
```
`dashboard_config` fica só para coisas globais (lista de super owners). Não apague ainda.

### 7. Recarregar o cache do PostgREST
```sql
notify pgrst, 'reload schema';
```

## Depois disso
O banco fica pronto, mas o código ainda lê tudo sem filtrar por gang. A etapa seguinte (código) é passar `gangId` para todas as funções de `dashboard.server.ts` e aplicar `.eq("gang_id", gangId)` — sem isso uma gang continua vendo os dados da outra.

## Duas confirmações antes de eu mexer no código
- Posso sobrescrever o projeto aqui na Lovable com o código do ZIP que você mandou (ele está mais novo que o daqui)?
- Alianças e logs passam a ser por gang (é o que o SQL acima faz) — confirma?
