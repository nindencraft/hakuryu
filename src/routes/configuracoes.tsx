import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, PageTitle } from "@/components/hakuryu/ui-bits";
import { useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { configuracoesQuery } from "@/lib/queries";
import { salvarConfiguracoes } from "@/lib/dashboard.functions";
import { CARGOS_PERMITIDOS, podeGerenciarMembros } from "@/lib/permissions";
import { CANAIS_CONFIG } from "@/lib/types";

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
  const autorizado = podeGerenciarMembros(user);
  const { data, isPending, error } = useQuery({ ...configuracoesQuery, enabled: autorizado });

  const [cargos, setCargos] = useState<Record<string, string>>({});
  const [canais, setCanais] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState("");

  useEffect(() => {
    if (!data) return;
    setCargos(data.cargos);
    setCanais(data.canais);
    setOwners(data.owners.join(", "));
  }, [data]);

  const acao = useAcao<{
    cargos: Record<string, string>;
    canais: Record<string, string>;
    owners: string;
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
          autorizado && data && !data.tabelaAusente ? (
            <Button
              disabled={acao.isPending}
              onClick={() => acao.mutate({ cargos, canais, owners })}
            >
              Salvar alterações
            </Button>
          ) : null
        }
      />

      {!autorizado ? (
        <EmptyState
          title="Acesso restrito"
          description="Apenas Líder, Vice-Líder e o dono podem alterar as configurações."
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
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card-gold p-5">
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
          </section>

          <div className="space-y-5">
            <section className="card-gold p-5">
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
            </section>

            <section className="card-gold p-5">
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
            </section>
          </div>
        </div>
      )}
    </>
  );
}
