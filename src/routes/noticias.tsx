import { createFileRoute } from '@tanstack/react-router'
import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { NoticiasRecentes } from "@/components/hakuryu/Noticias";
import { PageTitle } from "@/components/hakuryu/ui-bits";

export const Route = createFileRoute("/noticias")({ component: NoticiasPage });

function NoticiasPage() {
  return (
    <DashboardShell>
      <PageTitle kanji="新聞" title="Notícias" subtitle="Reportagens e comunicados publicados pela equipe de jornal." />
      <NoticiasRecentes permitirCriar />
    </DashboardShell>
  );
}
