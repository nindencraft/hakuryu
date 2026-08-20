import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Shield, Users } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, PageTitle, StatCard } from "@/components/hakuryu/ui-bits";
import { formatarData, formatarHorario } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvisosDeGuerra } from "@/components/hakuryu/diplomacia";
import { divisoesQuery, membrosQuery, treinosQuery } from "@/lib/queries";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel da Gang — Hakuryū" },
      {
        name: "description",
        content: "Painel de gestão da gang Hakuryū: membros, treinos, divisões e parcerias.",
      },
      { property: "og:title", content: "Hakuryū Dashboard — Painel da Gang" },
      {
        property: "og:description",
        content: "Painel de gestão da gang Hakuryū: membros, treinos, divisões e parcerias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoGeralPage,
});

function VisaoGeralPage() {
  return (
    <DashboardShell>
      <VisaoGeral />
    </DashboardShell>
  );
}

function VisaoGeral() {
  const membros = useQuery(membrosQuery);
  const treinos = useQuery(treinosQuery);
  const divisoes = useQuery(divisoesQuery);
  const erro = membros.error ?? treinos.error ?? divisoes.error;
  const carregando = membros.isPending || treinos.isPending || divisoes.isPending;
  const ativos = (membros.data ?? []).filter(
    (m) => (m.status ?? "").toLowerCase() === "ativo" || !m.status,
  ).length;
  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = (treinos.data ?? [])
    .filter((t) => t.data_treino >= hoje)
    .sort((a, b) => a.data_treino.localeCompare(b.data_treino))
    .slice(0, 5);

  return (
    <>
      <PageTitle
        kanji="白竜"
        title="Visão Geral"
        subtitle="Resumo da gang: membros, treinos e atividade recente."
      />
      <AvisosDeGuerra />
      {erro ? (
        <EmptyState title="Sem conexão com o banco" description={erro.message} />
      ) : carregando ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Membros ativos"
              value={ativos}
              hint={`${membros.data?.length ?? 0} cadastrados no total`}
              icon={<Users className="h-6 w-6" />}
            />
            <StatCard
              label="Treinos cadastrados"
              value={treinos.data?.length ?? 0}
              hint={`${proximos.length} agendados à frente`}
              icon={<CalendarDays className="h-6 w-6" />}
            />
            <StatCard
              label="Divisões"
              value={divisoes.data?.length ?? 0}
              hint="Estrutura interna da gang"
              icon={<Shield className="h-6 w-6" />}
            />
          </div>
          <GoldRule />
          <section aria-labelledby="proximos-treinos">
            <h2 id="proximos-treinos" className="font-display mb-4 text-2xl text-foreground">
              Próximos treinos
            </h2>
            {proximos.length === 0 ? (
              <EmptyState
                title="Nenhum treino agendado"
                description="Cadastre um treino na aba Treinos para aparecer aqui."
              />
            ) : (
              <ul className="space-y-3">
                {proximos.map((treino) => (
                  <li
                    key={treino.id_treino}
                    className="card-gold flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg text-foreground">
                        {treino.titulo}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatarData(treino.data_treino)} às {formatarHorario(treino.horario)}
                        {treino.local ? ` · ${treino.local}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/40">
                        {treino.tipo}
                      </Badge>
                      <Badge variant="secondary">{treino.inscritos} inscritos</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
