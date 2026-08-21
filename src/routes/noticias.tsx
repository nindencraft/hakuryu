import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { CabecalhoHub, FundoHub, TelaHubCarregando, TelaHubLogin } from "@/components/hakuryu/HubLayout";
import { NoticiasRecentes } from "@/components/hakuryu/Noticias";
import { Badge } from "@/components/ui/badge";
import { gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/noticias")({ component: NoticiasPage });

function NoticiasPage() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const usuario = sessao.data?.user;

  if (sessao.isPending) return <TelaHubCarregando />;
  if (!sessao.data?.configurado) return <TelaHubLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  if (!usuario) return <TelaHubLogin />;

  return (
    <FundoHub>
      <CabecalhoHub
        usuario={usuario}
        permitido={Boolean(sessao.data.permitido)}
        gangId={sessao.data.gangId}
        quantidadeDeGangs={gangs.data?.length ?? 0}
        abaAtiva="noticias"
      />
      <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-8 sm:px-8 sm:py-11">
        <section className="flex flex-col gap-4 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="border-primary/40">Jornal Hakuryū</Badge>
            <p className="font-jp mt-5 text-xs tracking-[0.2em] text-primary">新聞 · NOTÍCIAS</p>
            <h1 className="font-display mt-2 text-3xl leading-tight text-foreground sm:text-4xl">Acompanhe a comunidade em página inteira.</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              Reportagens, comunicados e acontecimentos publicados pela equipe de jornal do Hakuryū.
            </p>
          </div>
          <Newspaper className="h-10 w-10 text-primary/70" aria-hidden />
        </section>
        <NoticiasRecentes permitirCriar ampla />
      </main>
    </FundoHub>
  );
}
