import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, MemberAvatar, PageTitle } from "@/components/hakuryu/ui-bits";
import { formatarData, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atividadeQuery, membrosQuery } from "@/lib/queries";
import { ESTADO_ATIVIDADE } from "@/lib/atividade";
import type { RegistroAtividade, ResumoAtividade } from "@/lib/types";

export const Route = createFileRoute("/atividade")({
  head: () => ({ meta: [{ title: "Atividade — Hakuryū Dashboard" }] }),
  component: AtividadePage,
});

function AtividadePage() {
  return (
    <DashboardShell>
      <Atividade />
    </DashboardShell>
  );
}

function intervaloDoPeriodo(periodo: string, inicio: string, fim: string) {
  if (periodo === "personalizado") return { inicio: inicio || null, fim: fim || null };
  const dias = Number(periodo);
  const final = new Date();
  const inicial = new Date(final);
  inicial.setDate(final.getDate() - dias);
  return {
    inicio: inicial.toISOString().slice(0, 10),
    fim: final.toISOString().slice(0, 10),
  };
}

function Atividade() {
  const user = useSessionUser();
  const [periodo, setPeriodo] = useState("30");
  const [membroId, setMembroId] = useState("todos");
  const [tipoEvento, setTipoEvento] = useState("todos");
  const [inicioPersonalizado, setInicioPersonalizado] = useState("");
  const [fimPersonalizado, setFimPersonalizado] = useState("");
  const intervalo = useMemo(
    () => intervaloDoPeriodo(periodo, inicioPersonalizado, fimPersonalizado),
    [periodo, inicioPersonalizado, fimPersonalizado],
  );
  const filtros = useMemo(
    () => ({ membroId: membroId === "todos" ? null : membroId, tipoEvento: tipoEvento === "todos" ? null : tipoEvento, ...intervalo }),
    [membroId, tipoEvento, intervalo],
  );
  const atividade = useQuery(atividadeQuery(filtros));
  const membros = useQuery(membrosQuery);
  const registros = atividade.data?.registros ?? [];
  const resumos = atividade.data?.resumos ?? [];
  const inativos = resumos.filter((item) => item.inativo);

  return (
    <>
      <PageTitle
        kanji="活動"
        title="Atividade"
        subtitle="Registro de treinos e eventos encerrados, com presença, ausências e justificativas avaliadas."
      />

      <section className="card-gold mb-6 grid gap-4 p-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="personalizado">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Jogador</Label>
          <Select value={membroId} onValueChange={setMembroId}>
            <SelectTrigger><SelectValue placeholder="Todos os membros" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os membros</SelectItem>
              {(membros.data ?? []).map((membro) => (
                <SelectItem key={membro.discord_id} value={membro.discord_id}>
                  {membro.nome_rp || membro.discord_username || membro.discord_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo de evento</Label>
          <Select value={tipoEvento} onValueChange={setTipoEvento}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="Treino">Treinos</SelectItem>
              <SelectItem value="Amistoso">Amistosos</SelectItem>
              <SelectItem value="Guerra">Guerras</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "personalizado" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>De</Label><Input type="date" value={inicioPersonalizado} onChange={(e) => setInicioPersonalizado(e.target.value)} /></div>
            <div className="space-y-2"><Label>Até</Label><Input type="date" value={fimPersonalizado} onChange={(e) => setFimPersonalizado(e.target.value)} /></div>
          </div>
        ) : (
          <div className="flex items-end">
            <p className="text-sm text-muted-foreground">Exibindo eventos encerrados de {formatarData(intervalo.inicio ?? "")} até {formatarData(intervalo.fim ?? "")}.</p>
          </div>
        )}
      </section>

      {atividade.isPending ? <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-52" /></div> : null}
      {atividade.error ? <EmptyState title="Não foi possível carregar a atividade" description={atividade.error.message} /> : null}
      {!atividade.isPending && !atividade.error ? (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl">Resumo por jogador</h2>
                <p className="text-sm text-muted-foreground">🟢 Presente · 🔴 Ausente · 🟡 Justificado</p>
              </div>
              <Badge variant={inativos.length ? "destructive" : "secondary"}>
                {inativos.length} alerta{inativos.length === 1 ? "" : "s"} de inatividade
              </Badge>
            </div>
            {resumos.length === 0 ? (
              <EmptyState title="Nenhum registro no período" description="Os registros aparecem depois que os eventos são encerrados." />
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {resumos.map((resumo) => <ResumoCard key={resumo.membro_id} resumo={resumo} />)}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-display text-xl">Registros de presença</h2>
            {registros.length === 0 ? (
              <EmptyState title="Sem eventos encerrados" description="Encerre um treino para consolidar as presenças e ausências na atividade." />
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {registros.map((registro) => <RegistroCard key={`${registro.treino_id}-${registro.membro_id}`} registro={registro} />)}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {user?.isSuperOwner ? (
        <p className="mt-6 text-xs text-muted-foreground">Como Super Owner, você pode reabrir um evento encerrado diretamente na aba Treinos.</p>
      ) : null}
    </>
  );
}

function ResumoCard({ resumo }: { resumo: ResumoAtividade }) {
  return (
    <li className={`rounded-lg border p-4 ${resumo.inativo ? "border-red-500/50 bg-red-500/10" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <MemberAvatar discordId={resumo.membro_id} avatarHash={resumo.avatar_hash} size={42} alt={`Avatar de ${resumo.discord_username ?? resumo.membro_id}`} />
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{resumo.nome_rp || resumo.discord_username || resumo.membro_id}</p><p className="text-xs text-muted-foreground">{resumo.percentual_presenca}% de participação no período</p></div>
        {resumo.inativo ? <Badge variant="destructive">Inativo</Badge> : <Badge variant="secondary">Regular</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">🟢 <strong>{resumo.presente}</strong><span className="block text-xs">Presente</span></div>
        <div className="rounded bg-red-500/10 p-2 text-red-700 dark:text-red-300">🔴 <strong>{resumo.ausente}</strong><span className="block text-xs">Ausente</span></div>
        <div className="rounded bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">🟡 <strong>{resumo.justificado}</strong><span className="block text-xs">Justificado</span></div>
      </div>
    </li>
  );
}

function RegistroCard({ registro }: { registro: RegistroAtividade }) {
  const estilo = registro.status === "Presente" ? "border-emerald-500/60 bg-emerald-500/10" : registro.status === "Justificado" ? "border-amber-500/60 bg-amber-500/10" : "border-red-500/60 bg-red-500/10";
  const icone = ESTADO_ATIVIDADE[registro.status].icone;
  return (
    <li className={`rounded-lg border p-4 ${estilo}`}>
      <div className="flex items-center gap-3"><MemberAvatar discordId={registro.membro_id} avatarHash={registro.avatar_hash} size={40} alt="" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{registro.nome_rp || registro.discord_username || registro.membro_id}</p><p className="text-xs text-muted-foreground">{registro.titulo_evento} · {formatarData(registro.data_evento)}</p></div><span className="text-xl" aria-label={registro.status}>{icone}</span></div>
      <div className="mt-3 flex items-center justify-between gap-2"><Badge variant="outline">{registro.tipo_evento}</Badge><span className="text-sm font-medium">{registro.status}</span></div>
      {registro.justificativa ? <p className="mt-3 text-sm text-muted-foreground"><strong>Motivo:</strong> {registro.justificativa} ({registro.justificativa_status})</p> : null}
    </li>
  );
}
