import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/treinos")({
  head: () => ({
    meta: [
      { title: "Treinos — Hakuryū Dashboard" },
      { name: "description", content: "Agenda de treinos da gang Hakuryū, inscrições e presenças." },
      { property: "og:title", content: "Treinos — Hakuryū Dashboard" },
      { property: "og:description", content: "Agenda de treinos, inscrições e presenças." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreinosPage,
});

function TreinosPage() {
  return (
    <DashboardShell>
      <PageTitle kanji="訓練" title="Treinos" subtitle="Agenda, inscrições e chamada de presença." />
      <EmptyState title="Tela em finalização" description="A agenda de treinos será ligada aos dados na próxima etapa." />
    </DashboardShell>
  );
}
