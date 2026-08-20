import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";

import { CabecalhoHub, FundoHub, TelaHubCarregando, TelaHubLogin } from "@/components/hakuryu/HubLayout";
import { GestorMeuRecrutamento, VitrineRecrutamento } from "@/components/hakuryu/Recrutamento";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { recrutamentosPublicosQuery, gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/recrutamento")({ component: RecrutamentoPage });

function RecrutamentoPage() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const recrutamentos = useQuery(recrutamentosPublicosQuery);
  const usuario = sessao.data?.user;

  if (sessao.isPending) return <TelaHubCarregando />;
  if (!sessao.data?.configurado) return <TelaHubLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  if (!usuario) return <TelaHubLogin />;

  return (
    <FundoHub>
      <CabecalhoHub
        usuario={usuario}
        permitido={Boolean(sessao.data.permitido)}
        quantidadeDeGangs={gangs.data?.length ?? 0}
        abaAtiva="recrutamento"
      />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-8 sm:py-11">
        <section className="border-b border-primary/20 pb-7">
          <Badge variant="outline" className="border-primary/40">Vagas abertas</Badge>
          <p className="font-jp mt-5 text-xs tracking-[0.2em] text-primary">白竜 · RECRUTAMENTO</p>
          <h1 className="font-display mt-2 text-3xl leading-tight text-foreground sm:text-4xl">Encontre uma gang para chamar de sua.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Conheça as gangs registradas no Hakuryū que estão procurando novos membros.
          </p>
        </section>

        <GestorMeuRecrutamento />

        {recrutamentos.isPending ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : null}
        {recrutamentos.error ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os recrutamentos: {recrutamentos.error.message}
          </div>
        ) : null}
        {!recrutamentos.isPending && !recrutamentos.error ? (
          <VitrineRecrutamento recrutamentos={recrutamentos.data ?? []} />
        ) : null}

        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" /> Cada gang gerencia o próprio anúncio dentro do Hakuryū.
        </p>
      </main>
    </FundoHub>
  );
}
