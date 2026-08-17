import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";
import { GangAvatar } from "@/components/hakuryu/diplomacia";
import { formatarData, formatarHorario, useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { solicitacoesQuery } from "@/lib/queries";
import { cancelarSolicitacao, responderSolicitacao } from "@/lib/dashboard.functions";
import { podeGerenciarParcerias } from "@/lib/permissions";
import { ROTULO_SOLICITACAO, type SolicitacaoGang } from "@/lib/types";

export const Route = createFileRoute("/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações — Hakuryū Dashboard" },
      {
        name: "description",
        content:
          "Solicitações de aliança, guerra e treino amistoso entre as gangs registradas no painel.",
      },
      { property: "og:title", content: "Solicitações — Hakuryū Dashboard" },
      {
        property: "og:description",
        content: "Aceite ou recuse propostas de aliança, guerra e treino de outras gangs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  return (
    <DashboardShell>
      <Solicitacoes />
    </DashboardShell>
  );
}

function Solicitacoes() {
  const { data, isPending, error } = useQuery(solicitacoesQuery);
  const lista = data?.solicitacoes ?? [];
  const recebidas = lista.filter((s) => s.direcao === "recebida");
  const enviadas = lista.filter((s) => s.direcao === "enviada");

  return (
    <>
      <PageTitle
        kanji="要請"
        title="Solicitações"
        subtitle="Propostas de aliança, guerra e treino amistoso entre gangs."
      />

      {error ? (
        <EmptyState title="Não consegui carregar as solicitações" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : data?.tabelaAusente ? (
        <EmptyState
          title="Tabelas de diplomacia não encontradas"
          description="Rode o script sql/diplomacia.sql no banco para habilitar as solicitações."
        />
      ) : lista.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação"
          description="Abra a aba Alianças, escolha uma gang registrada e envie a primeira proposta."
        />
      ) : (
        <div className="space-y-10">
          <Secao titulo="Recebidas" lista={recebidas} />
          <Secao titulo="Enviadas" lista={enviadas} />
        </div>
      )}
    </>
  );
}

function Secao({ titulo, lista }: { titulo: string; lista: SolicitacaoGang[] }) {
  if (lista.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-muted-foreground">{titulo}</h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        {lista.map((s) => (
          <CardSolicitacao key={s.id} solicitacao={s} />
        ))}
      </ul>
    </section>
  );
}

function statusBadge(status: string) {
  if (status === "Pendente") return <Badge variant="secondary">Pendente</Badge>;
  if (status === "Aceita") return <Badge className="bg-primary/20 text-primary">Aceita</Badge>;
  if (status === "Recusada") return <Badge variant="destructive">Recusada</Badge>;
  return <Badge variant="outline">Encerrada</Badge>;
}

function CardSolicitacao({ solicitacao: s }: { solicitacao: SolicitacaoGang }) {
  const user = useSessionUser();
  const podeAgir = podeGerenciarParcerias(user);

  const responder = useAcao<{ id: number; aceitar: boolean }>(responderSolicitacao, {
    sucesso: "Solicitação respondida.",
    invalidar: [["solicitacoes"], ["gangs-registradas"], ["guerras"], ["treinos"], ["parcerias"]],
  });
  const cancelar = useAcao<{ id: number }>(cancelarSolicitacao, {
    sucesso: "Solicitação cancelada.",
    invalidar: [["solicitacoes"], ["gangs-registradas"]],
  });

  const comEvento = s.tipo !== "Alianca";

  return (
    <li className="card-gold flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <GangAvatar nome={s.gang.nome} guildId={s.gang.guild_id} iconHash={s.gang.icon_hash} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg text-foreground">{s.gang.nome}</p>
          <p className="text-sm text-muted-foreground">
            {ROTULO_SOLICITACAO[s.tipo] ?? s.tipo} · {formatarData(s.criado_em)}
          </p>
        </div>
        {statusBadge(s.status)}
      </div>

      {s.motivo ? <p className="text-sm">{s.motivo}</p> : null}

      {comEvento ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Info rotulo="Data" valor={formatarData(s.data_evento)} />
          <Info rotulo="Horário" valor={formatarHorario(s.horario)} />
          <Info rotulo="Local" valor={s.local ?? "—"} />
          <Info
            rotulo="Membros"
            valor={`${s.membros_origem ?? "—"} × ${s.membros_destino ?? "—"}`}
          />
        </dl>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Enviada por {s.criado_por_nome ?? "—"}
        {s.respondido_por_nome ? ` · respondida por ${s.respondido_por_nome}` : ""}
      </p>

      {s.status === "Pendente" && podeAgir ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {s.direcao === "recebida" ? (
            <>
              <Button size="sm" onClick={() => responder.mutate({ id: s.id, aceitar: true })}>
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => responder.mutate({ id: s.id, aceitar: false })}
              >
                Recusar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => cancelar.mutate({ id: s.id })}>
              Cancelar solicitação
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  );
}
