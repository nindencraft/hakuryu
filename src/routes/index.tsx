import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hakuryū Dashboard — Painel da Gang" },
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
  component: VisaoGeral,
});

function VisaoGeral() {
  return (
    <DashboardShell>
      <PageTitle
        kanji="白竜"
        title="Visão Geral"
        subtitle="Resumo da gang: membros, treinos e atividade recente."
      />
      <EmptyState
        title="Métricas em finalização"
        description="Os indicadores serão ligados ao banco assim que as credenciais forem configuradas."
      />
    </DashboardShell>
  );
}
