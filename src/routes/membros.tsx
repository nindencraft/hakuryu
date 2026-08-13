import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/membros")({
  head: () => ({
    meta: [
      { title: "Membros — Hakuryū Dashboard" },
      { name: "description", content: "Gestão de membros da gang Hakuryū: cargos, avisos e status." },
      { property: "og:title", content: "Membros — Hakuryū Dashboard" },
      { property: "og:description", content: "Gestão de membros da gang Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembrosPage,
});

function MembrosPage() {
  return (
    <DashboardShell>
      <PageTitle kanji="隊員" title="Membros" subtitle="Cargos, avisos e status dos integrantes." />
      <EmptyState title="Tela em finalização" description="A tabela de membros com filtros e ações será ligada aos dados na próxima etapa." />
    </DashboardShell>
  );
}
