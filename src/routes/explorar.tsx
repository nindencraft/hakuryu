import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";

import { ModeracaoExplorador, GestorMeuServidorExplorador, VitrineExplorador } from "@/components/hakuryu/Explorador";
import { CabecalhoHub, FundoHub, TelaHubCarregando, TelaHubLogin } from "@/components/hakuryu/HubLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { gangsDisponiveisQuery, servidoresExploradorPublicosQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/explorar")({ component: ExplorarPage });

function ExplorarPage() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const servidores = useQuery(servidoresExploradorPublicosQuery);
  const usuario = sessao.data?.user;
  if (sessao.isPending) return <TelaHubCarregando />;
  if (!sessao.data?.configurado) return <TelaHubLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  if (!usuario) return <TelaHubLogin />;

  return <FundoHub><CabecalhoHub usuario={usuario} permitido={Boolean(sessao.data.permitido)} quantidadeDeGangs={gangs.data?.length ?? 0} abaAtiva="explorar" /><main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-8 sm:py-11"><section className="border-b border-primary/20 pb-7"><Badge variant="outline" className="border-primary/40">Roleplays e Comunidades</Badge><p className="font-jp mt-5 text-xs tracking-[0.2em] text-primary">白竜 · EXPLORADOR</p><h1 className="font-display mt-2 text-3xl leading-tight text-foreground sm:text-4xl">Descubra seu próximo lugar em Gakuran.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Encontre servidores aprovados pela administração Hakuryū ou apresente sua própria comunidade para a vitrine.</p></section><GestorMeuServidorExplorador />{servidores.isPending ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-80" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div> : null}{servidores.error ? <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive">Não foi possível carregar o Explorador: {servidores.error.message}</div> : null}{!servidores.isPending && !servidores.error ? <VitrineExplorador servidores={servidores.data ?? []} /> : null}<ModeracaoExplorador /><p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Compass className="h-3.5 w-3.5" /> Publicações são revisadas antes de aparecerem no Explorador.</p></main></FundoHub>;
}
