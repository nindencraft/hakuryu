import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/divisoes")({
  head: () => ({
    meta: [
      { title: "Divisões — Hakuryū Dashboard" },
      { name: "description", content: "Divisões da gang Hakuryū, lideranças e composição de equipes." },
      { property: "og:title", content: "Divisões — Hakuryū Dashboard" },
      { property: "og:description", content: "Divisões, lideranças e composição de equipes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DivisoesPage,
});

function DivisoesPage() {
  return (
    <DashboardShell>
      <PageTitle kanji="部隊" title="Divisões" subtitle="Lideranças e composição de cada divisão." />
      <EmptyState title="Tela em finalização" description="A gestão de divisões será ligada aos dados na próxima etapa." />
    </DashboardShell>
  );
}
