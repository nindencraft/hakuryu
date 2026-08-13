import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/parcerias")({
  head: () => ({
    meta: [
      { title: "Parcerias — Hakuryū Dashboard" },
      { name: "description", content: "Alianças e parcerias da gang Hakuryū com outros grupos." },
      { property: "og:title", content: "Parcerias — Hakuryū Dashboard" },
      { property: "og:description", content: "Alianças e parcerias com outros grupos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParceriasPage,
});

function ParceriasPage() {
  return (
    <DashboardShell>
      <PageTitle kanji="同盟" title="Parcerias" subtitle="Alianças ativas e negociações em andamento." />
      <EmptyState title="Tela em finalização" description="A gestão de parcerias será ligada aos dados na próxima etapa." />
    </DashboardShell>
  );
}
