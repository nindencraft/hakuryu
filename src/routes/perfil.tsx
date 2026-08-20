import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PerfilJogador } from "@/components/hakuryu/PerfilJogador";
import { CabecalhoHub, FundoHub, TelaHubCarregando, TelaHubLogin } from "@/components/hakuryu/HubLayout";
import { gangsDisponiveisQuery, meuPerfilQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/perfil")({ component: PerfilPage });

function PerfilPage() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const perfil = useQuery({ ...meuPerfilQuery, enabled: Boolean(sessao.data?.user) });
  const usuario = sessao.data?.user;
  if (sessao.isPending) return <TelaHubCarregando />;
  if (!sessao.data?.configurado) return <TelaHubLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  if (!usuario) return <TelaHubLogin />;

  return <FundoHub><CabecalhoHub usuario={usuario} permitido={Boolean(sessao.data.permitido)} quantidadeDeGangs={gangs.data?.length ?? 0} abaAtiva="perfil" /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-11">{perfil.isPending ? <TelaHubCarregando /> : null}{perfil.error ? <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive">Não foi possível carregar seu perfil: {perfil.error.message}</div> : null}{perfil.data ? <PerfilJogador perfil={perfil.data} /> : null}</main></FundoHub>;
}
