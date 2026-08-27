import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, PageTitle } from "@/components/hakuryu/ui-bits";
import { useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cargosPainelPersonalizadosQuery, configInatividadeQuery, configuracoesQuery } from "@/lib/queries";
import {
  excluirCargoPainelPersonalizado,
  salvarCargoPainelPersonalizado,
  salvarConfigInatividade,
  salvarConfiguracoes,
} from "@/lib/dashboard.functions";
import {
  CARGOS_DIVISAO,
  CARGOS_PERMITIDOS,
  podeConfigurarCanais,
  podeConfigurarCargos,
  podeConfigurarInatividade,
} from "@/lib/permissions";
import { PERMISSOES_PAINEL } from "@/lib/permissoes-painel";
import { CANAIS_CONFIG, CANAL_DIVULGACAO_CONFIG } from "@/lib/types";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Hakuryū Dashboard" },
      {
        name: "description",
        content:
          "Personalize IDs de cargos, donos do painel e canais do Discord para treinos, alianças e advertências.",
      },
      { property: "og:title", content: "Configurações — Hakuryū Dashboard" },
      {
        property: "og:description",
        content: "Ajustes de cargos, donos e canais do painel Hakuryū.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  return (
    <DashboardShell>
      <Configuracoes />
    </DashboardShell>
  );
}

function Configuracoes() {
  const user = useSessionUser();
  const podeCargos = podeConfigurarCargos(user);
  const podeCanais = podeConfigurarCanais(user);
  const podeInatividade = podeConfigurarInatividade(user);
  const autorizado = podeCargos || podeCanais || podeInatividade;
  const { data, isPending, error } = useQuery({ ...configuracoesQuery, enabled: autorizado });
  const cargosPersonalizados = useQuery({ ...cargosPainelPersonalizadosQuery, enabled: podeCargos });

  const [cargos, setCargos] = useState<Record<string, string>>({});
  const [canais, setCanais] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState("");
  const [guildId, setGuildId] = useState("");

  useEffect(() => {
    if (!data) return;
    setCargos(data.cargos);
    setCanais(data.canais);
    setOwners(data.owners.join(", "));
    setGuildId(data.guildId);
  }, [data]);

  const acao = useAcao<{
    cargos: Record<string, string>;
    canais: Record<string, string>;
    owners: string;
    guildId: string;
  }>(salvarConfiguracoes, {
    sucesso: "Configurações salvas.",
    invalidar: [["configuracoes"], ["session"]],
  });

  return (
    <>
      <PageTitle
        kanji="設定"
        title="Configurações"
        subtitle="IDs de cargos, donos do painel e canais de log no Discord."
        actions={
          (podeCargos || podeCanais) && data && !data.tabelaAusente ? (
            <Button
              disabled={acao.isPending}
              onClick={() => acao.mutate({ cargos, canais, owners, guildId })}
            >
              Salvar alterações
            </Button>
          ) : null
        }
      />

      {!autorizado ? (
        <EmptyState
          title="Acesso restrito"
          description="Seu cargo não possui nenhuma permissão de configuração nesta gang."
        />
      ) : error ? (
        <EmptyState title="Sem conexão com o banco" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : data.tabelaAusente ? (
        <EmptyState
          title="Tabela de configurações não encontrada"
          description="Crie a tabela dashboard_config (chave TEXT PRIMARY KEY, valor TEXT) no banco da gang para habilitar esta aba."
        />
      ) : (
        <>
        <div className="grid gap-5 lg:grid-cols-2">
            {podeCargos ? <section className="card-gold p-5 lg:col-span-2">
            <h2 className="font-display text-xl">Servidor do Discord</h2>
            <p className="text-sm text-muted-foreground">
              ID da guild que o painel vai ler. Só quem está nesse servidor consegue entrar.
            </p>
            <GoldRule className="my-4" />
            <Label htmlFor="guild-id" className="sr-only">
              ID do servidor
            </Label>
            <Input
              id="guild-id"
              inputMode="numeric"
              placeholder="123456789012345678"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
            </section> : null}

          {podeCargos ? <section className="card-gold p-5">
            <h2 className="font-display text-xl">Cargos do Discord</h2>
            <p className="text-sm text-muted-foreground">
              ID do cargo correspondente a cada função do painel. Deixe vazio para o bot procurar
              pelo nome.
            </p>
            <GoldRule className="my-4" />
            <div className="space-y-3">
              {CARGOS_PERMITIDOS.map((nome) => (
                <div key={nome} className="space-y-1.5">
                  <Label htmlFor={`cargo-${nome}`}>{nome}</Label>
                  <Input
                    id={`cargo-${nome}`}
                    inputMode="numeric"
                    placeholder="ID do cargo"
                    value={cargos[nome] ?? ""}
                    onChange={(e) => setCargos({ ...cargos, [nome]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </section> : null}

          <div className="space-y-5">
            {podeCanais ? <section className="card-gold p-5">
              <h2 className="font-display text-xl">Canais de publicação</h2>
              <p className="text-sm text-muted-foreground">
                Cada evento do painel é anunciado no canal informado.
              </p>
              <GoldRule className="my-4" />
              <div className="space-y-3">
                {CANAIS_CONFIG.map(({ chave, rotulo }) => (
                  <div key={chave} className="space-y-1.5">
                    <Label htmlFor={chave}>{rotulo}</Label>
                    <Input
                      id={chave}
                      inputMode="numeric"
                      placeholder="ID do canal"
                      value={canais[chave] ?? ""}
                      onChange={(e) => setCanais({ ...canais, [chave]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </section> : null}

            {user?.isSuperOwner && podeCanais ? (
              <section className="card-gold p-5">
                <h2 className="font-display text-xl">Divulgação global</h2>
                <p className="text-sm text-muted-foreground">
                  Somente o Super Owner define o canal que receberá as divulgações enviadas para
                  todas as gangs.
                </p>
                <GoldRule className="my-4" />
                <div className="space-y-1.5">
                  <Label htmlFor={CANAL_DIVULGACAO_CONFIG.chave}>
                    {CANAL_DIVULGACAO_CONFIG.rotulo}
                  </Label>
                  <Input
                    id={CANAL_DIVULGACAO_CONFIG.chave}
                    inputMode="numeric"
                    placeholder="ID do canal"
                    value={canais[CANAL_DIVULGACAO_CONFIG.chave] ?? ""}
                    onChange={(e) =>
                      setCanais({ ...canais, [CANAL_DIVULGACAO_CONFIG.chave]: e.target.value })
                    }
                  />
                </div>
              </section>
            ) : null}

            {podeCargos ? <section className="card-gold p-5">
              <h2 className="font-display text-xl">Donos do painel</h2>
              <p className="text-sm text-muted-foreground">
                IDs do Discord com acesso total, separados por vírgula.
              </p>
              <GoldRule className="my-4" />
              <Label htmlFor="owners" className="sr-only">
                IDs dos donos
              </Label>
              <Input
                id="owners"
                placeholder="123456789012345678, 987654321098765432"
                value={owners}
                onChange={(e) => setOwners(e.target.value)}
              />
            </section> : null}
          </div>
        </div>
        {podeInatividade ? <ConfigInatividadeCard /> : null}
        {podeCargos ? <GerenciadorCargosPersonalizados
          cargos={cargosPersonalizados.data ?? []}
          carregando={cargosPersonalizados.isPending}
        /> : null}
        </>
      )}
    </>
  );
}

function ConfigInatividadeCard() {
  const { data, isPending } = useQuery(configInatividadeQuery);
  const [dias, setDias] = useState("30");
  const [percentual, setPercentual] = useState("50");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!data) return;
    setDias(String(data.dias_limite));
    setPercentual(String(data.percentual_minimo));
    setAtivo(data.alerta_ativo);
  }, [data]);

  const acao = useAcao<{ dias_limite: number; percentual_minimo: number; alerta_ativo: boolean }>(
    salvarConfigInatividade,
    { sucesso: "Alertas de inatividade salvos.", invalidar: [["config-inatividade"], ["atividade"]] },
  );

  return (
    <section className="card-gold mt-5 p-5">
      <h2 className="font-display text-xl">Alertas de inatividade</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Um membro entra em alerta quando não possui presença ou justificativa válida no período recente, ou fica abaixo do percentual mínimo configurado.
      </p>
      <GoldRule className="my-4" />
      {isPending ? <Skeleton className="h-28" /> : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="atividade-dias">Janela de análise (dias)</Label>
            <Input id="atividade-dias" type="number" min="7" max="365" value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atividade-percentual">Participação mínima (%)</Label>
            <Input id="atividade-percentual" type="number" min="0" max="100" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
          </div>
          <div className="flex items-end gap-3 pb-2">
            <Checkbox id="atividade-alerta" checked={ativo} onCheckedChange={(valor) => setAtivo(valor === true)} />
            <Label htmlFor="atividade-alerta" className="cursor-pointer">Ativar alertas de inatividade</Label>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={acao.isPending || isPending}
          onClick={() => acao.mutate({ dias_limite: Number(dias), percentual_minimo: Number(percentual), alerta_ativo: ativo })}
        >
          Salvar alertas
        </Button>
      </div>
    </section>
  );
}

type CargoInterno = {
  id: number;
  nome: string;
  discordRoleId: string;
  permissoes: string[];
  cargosAtribuiveis: string[];
  criadoEm: string;
};

const CARGOS_ATRIBUIVEIS_OPCOES = CARGOS_PERMITIDOS.filter((cargo) => !CARGOS_DIVISAO.includes(cargo));
const FORMULARIO_VAZIO = { id: null as number | null, nome: "", discordRoleId: "", permissoes: [] as string[], cargosAtribuiveis: [] as string[] };

function GerenciadorCargosPersonalizados({ cargos, carregando }: { cargos: CargoInterno[]; carregando: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);

  const salvar = useAcao(salvarCargoPainelPersonalizado, {
    sucesso: "Cargo personalizado salvo.",
    invalidar: [["cargos-painel-personalizados"], ["session"]],
    aoConcluir: () => {
      setAberto(false);
      setFormulario(FORMULARIO_VAZIO);
    },
  });
  const excluir = useAcao(excluirCargoPainelPersonalizado, {
    sucesso: "Cargo personalizado removido.",
    invalidar: [["cargos-painel-personalizados"], ["session"]],
  });

  const abrirCriacao = () => {
    setFormulario(FORMULARIO_VAZIO);
    setAberto(true);
  };
  const abrirEdicao = (cargo: CargoInterno) => {
    setFormulario({
      id: cargo.id,
      nome: cargo.nome,
      discordRoleId: cargo.discordRoleId,
      permissoes: cargo.permissoes,
      cargosAtribuiveis: cargo.cargosAtribuiveis ?? [],
    });
    setAberto(true);
  };
  const alternarPermissao = (chave: string, marcada: boolean) => {
    setFormulario((atual) => ({
      ...atual,
      permissoes: marcada
        ? Array.from(new Set([...atual.permissoes, chave]))
        : atual.permissoes.filter((permissao) => permissao !== chave),
    }));
  };
  const alternarCargoAtribuivel = (cargo: string, marcado: boolean) => {
    setFormulario((atual) => ({
      ...atual,
      cargosAtribuiveis: marcado
        ? Array.from(new Set([...atual.cargosAtribuiveis, cargo]))
        : atual.cargosAtribuiveis.filter((item) => item !== cargo),
    }));
  };

  return (
    <section className="card-gold mt-5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl">Cargos personalizados do painel</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Crie permissões adicionais para cargos que já existem no Discord. Estes cargos somam acesso e não substituem Líder, Vice-Líder, Membro, Staff ou as regras atuais.
          </p>
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button onClick={abrirCriacao}>Adicionar novo cargo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{formulario.id ? "Editar cargo personalizado" : "Adicionar cargo personalizado"}</DialogTitle>
              <DialogDescription>
                O cargo do Discord precisa existir no servidor. Copie o ID dele com o modo desenvolvedor do Discord ativado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="cargo-personalizado-nome">Nome no painel</Label>
                <Input
                  id="cargo-personalizado-nome"
                  maxLength={60}
                  placeholder="Ex.: Organizador de Eventos"
                  value={formulario.nome}
                  onChange={(event) => setFormulario({ ...formulario, nome: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-personalizado-discord">ID do cargo Discord</Label>
                <Input
                  id="cargo-personalizado-discord"
                  inputMode="numeric"
                  placeholder="123456789012345678"
                  value={formulario.discordRoleId}
                  onChange={(event) => setFormulario({ ...formulario, discordRoleId: event.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label>Permissões no painel</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PERMISSOES_PAINEL.map((permissao) => (
                    <label
                      key={permissao.chave}
                      className="flex cursor-pointer gap-3 rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={formulario.permissoes.includes(permissao.chave)}
                        onCheckedChange={(marcada) => alternarPermissao(permissao.chave, marcada === true)}
                      />
                      <span>
                        <strong className="block text-foreground">{permissao.rotulo}</strong>
                        <span className="text-xs text-muted-foreground">{permissao.descricao}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Cargos que este cargo pode atribuir</Label>
                  <p className="mt-1 text-xs text-muted-foreground">A lista limita o seletor de cargo. Cargos de divisão ficam fora deste fluxo.</p>
                </div>
                <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2">
                  {CARGOS_ATRIBUIVEIS_OPCOES.map((cargo) => (
                    <label key={cargo} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formulario.cargosAtribuiveis.includes(cargo)}
                        onCheckedChange={(marcado) => alternarCargoAtribuivel(cargo, marcado === true)}
                      />
                      {cargo}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button
                disabled={salvar.isPending}
                onClick={() => salvar.mutate(formulario)}
              >
                {salvar.isPending ? "Salvando..." : "Salvar cargo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <GoldRule className="my-4" />
      {carregando ? (
        <Skeleton className="h-28" />
      ) : cargos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cargo personalizado foi criado para esta gang.</p>
      ) : (
        <div className="space-y-3">
          {cargos.map((cargo) => (
            <article key={cargo.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-medium">{cargo.nome}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Discord: {cargo.discordRoleId}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {cargo.permissoes
                      .map((chave) => PERMISSOES_PAINEL.find((permissao) => permissao.chave === chave)?.rotulo ?? chave)
                      .join(" · ")}
                  </p>
                  {cargo.cargosAtribuiveis?.length ? <p className="mt-1 text-xs text-muted-foreground">Pode atribuir: {cargo.cargosAtribuiveis.join(", ")}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => abrirEdicao(cargo)}>Editar</Button>
                  <Button variant="destructive" size="sm" disabled={excluir.isPending} onClick={() => excluir.mutate({ id: cargo.id })}>Excluir</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
