-- ============================================================
-- Hakuryū — Migração multi-gang (Etapa 1: banco de dados)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
--
-- ANTES DE RODAR:
--   1) Ajuste as duas variáveis do bloco abaixo (nome/guild/líder da SUA gang atual).
--   2) Faça um backup (Supabase > Database > Backups) por segurança.
--
-- O script é idempotente: pode ser rodado mais de uma vez sem quebrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Garante que a gang atual existe e descobre o id dela
-- ------------------------------------------------------------
do $$
declare
  v_nome     text := 'Hakuryū';                 -- << nome da sua gang
  v_guild_id text := 'SEU_GUILD_ID_AQUI';       -- << ID do servidor Discord
  v_lider    text := 'SEU_DISCORD_ID_AQUI';     -- << Discord ID do líder (pode deixar como está)
begin
  if not exists (select 1 from public.gangs) then
    insert into public.gangs (nome, guild_id, ativo, lider_id)
    values (v_nome, v_guild_id, true, nullif(v_lider, 'SEU_DISCORD_ID_AQUI'))
    on conflict (guild_id) do nothing;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Adiciona gang_id nas tabelas que ainda não têm
-- ------------------------------------------------------------
alter table public.treinos            add column if not exists gang_id bigint;
alter table public.parcerias          add column if not exists gang_id bigint;
alter table public.logs_partidas      add column if not exists gang_id bigint;
alter table public.guerras            add column if not exists gang_id bigint;
alter table public.inimigos           add column if not exists gang_id bigint;
alter table public.config_cargos      add column if not exists gang_id bigint;
alter table public.treinos_internos   add column if not exists gang_id bigint;
alter table public.treinos_amistosos  add column if not exists gang_id bigint;

-- ------------------------------------------------------------
-- 3. Backfill: todo dado antigo passa a pertencer à gang mais antiga
-- ------------------------------------------------------------
do $$
declare
  g bigint;
  t text;
begin
  select id into g from public.gangs order by id limit 1;
  if g is null then
    raise exception 'Nenhuma gang cadastrada. Preencha o bloco 1 antes de continuar.';
  end if;

  foreach t in array array[
    'treinos','parcerias','logs_partidas','guerras','inimigos','config_cargos',
    'treinos_internos','treinos_amistosos','membros','divisoes','punicoes',
    'presencas_treino','participacoes_guerra','membro_atributos',
    'historico_atributos_membro','avaliacoes_treino','avaliacoes_lideranca',
    'votos_recrutamento'
  ] loop
    execute format('update public.%I set gang_id = %s where gang_id is null', t, g);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. gang_id vira obrigatório, com FK e índice
-- ------------------------------------------------------------
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

    if not exists (
      select 1 from pg_constraint
      where conname = t || '_gang_id_fkey'
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (gang_id) references public.gangs(id) on delete cascade',
        t, t || '_gang_id_fkey');
    end if;

    execute format('create index if not exists %I on public.%I (gang_id)', 'idx_' || t || '_gang', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Unicidade passa a ser por gang
-- ------------------------------------------------------------
do $$
begin
  -- config_cargos: PK (funcao) -> (gang_id, funcao)
  if exists (
    select 1 from pg_constraint
    where conname = 'config_cargos_pkey'
      and conrelid = 'public.config_cargos'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table public.config_cargos drop constraint config_cargos_pkey;
    alter table public.config_cargos add primary key (gang_id, funcao);
  end if;
end $$;

create unique index if not exists uq_divisoes_gang_nome
  on public.divisoes (gang_id, nome_divisao);

create unique index if not exists uq_gangs_guild
  on public.gangs (guild_id);

-- ------------------------------------------------------------
-- 6. Configurações antigas (dashboard_config) -> gang_config
-- ------------------------------------------------------------
do $$
declare g bigint;
begin
  select id into g from public.gangs order by id limit 1;

  insert into public.gang_config (gang_id, chave, valor)
  select g, chave, valor
  from public.dashboard_config
  where chave <> 'guild_id'
  on conflict (gang_id, chave) do update set valor = excluded.valor;
end $$;

-- dashboard_config continua existindo apenas para configurações globais
-- (ex.: owner_ids do Super Owner). Não apague.

-- ------------------------------------------------------------
-- 7. Recarrega o cache de schema do PostgREST
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 8. Conferência
-- ------------------------------------------------------------
select table_name
from information_schema.columns
where table_schema = 'public' and column_name = 'gang_id'
order by table_name;

select id, nome, guild_id, ativo, lider_id from public.gangs order by id;
