import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, MemberAvatar, PageTitle } from "@/components/hakuryu/ui-bits";
import { formatarData, formatarHorario, useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { divisoesQuery, treinosQuery } from "@/lib/queries";
import {
  ausentarSe,
  atualizarPresenca,
  criarTreino,
  deletarTreino,
  fetchMinhaInscricao,
  fetchPresencas,
  inscreverSe,
} from "@/lib/dashboard.functions";
import { podeGerenciarTreinos } from "@/lib/permissions";
import { PRESENCA_OPCOES, TIPO_TREINO_OPCOES, type PresencaTreino, type Treino } from "@/lib/types";

export const Route = createFileRoute("/treinos")({
  head: () => ({
    meta: [
      { title: "Treinos — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Mural de treinos da gang Hakuryū: agendamentos, inscrições e presença.",
      },
      { property: "og:title", content: "Treinos — Hakuryū Dashboard" },
      { property: "og:description", content: "Agendamentos, inscrições e presença da Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreinosPage,
});

function TreinosPage() {
  return (
    <DashboardShell>
      <Treinos />
    </DashboardShell>
  );
}

function Treinos() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarTreinos(user);
  const { data, isPending, error } = useQuery(treinosQuery);
  const [criando, setCriando] = useState(false);
  const [presencaDe, setPresencaDe] = useState<Treino | null>(null);
  const [deletando, setDeletando] = useState<Treino | null>(null);

  const deletarAcao = useAcao<{ treinoId: number }>(deletarTreino, {
    sucesso: "Treino removido.",
    invalidar: [["treinos"]],
  });

  const treinos = [...(data ?? [])].sort((a, b) => b.data_treino.localeCompare(a.data_treino));

  return (
    <>
      <PageTitle
        kanji="稽古"
        title="Treinos"
        subtitle="Mural de treinos, inscrições e controle de presença."
        actions={
          podeGerenciar ? (
            <Button onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Novo treino
            </Button>
          ) : null
        }
      />

      {error ? (
        <EmptyState title="Sem conexão com o banco" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : treinos.length === 0 ? (
        <EmptyState title="Nenhum treino cadastrado" description="Crie o primeiro treino da gang." />
      ) : (
        <div className="space-y-8">
          <ul className="grid gap-4 lg:grid-cols-2">
            {abertos.map((t) => (
              <TreinoCard
                key={t.id_treino}
                treino={t}
                podeGerir={podeGerirTreino(t)}
                onPresenca={() => setPresencaDe(t)}
                onDeletar={() => setDeletando(t)}
                onAdiar={() => setAdiando(t)}
                onEncerrar={() => encerrarAcao.mutate({ treinoId: t.id_treino })}
              />
            ))}
          </ul>

          {finalizados.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-lg text-muted-foreground">Treinos finalizados</h2>
              <ul className="grid gap-4 opacity-80 lg:grid-cols-2">
                {finalizados.map((t) => (
                  <TreinoCard
                    key={t.id_treino}
                    treino={t}
                    podeGerir={podeGerirTreino(t)}
                    onPresenca={() => setPresencaDe(t)}
                    onDeletar={() => setDeletando(t)}
                    onAdiar={() => setAdiando(t)}
                    onEncerrar={() => encerrarAcao.mutate({ treinoId: t.id_treino })}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <AdiarTreinoDialog treino={adiando} onClose={() => setAdiando(null)} />


      <CriarTreinoDialog open={criando} onClose={() => setCriando(false)} />
      <PresencaDialog treino={presencaDe} onClose={() => setPresencaDe(null)} />

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar treino?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletando?.titulo}” e suas presenças serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletando) deletarAcao.mutate({ treinoId: deletando.id_treino });
                setDeletando(null);
              }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TreinoCard({
  treino,
  podeGerenciar,
  onPresenca,
  onDeletar,
}: {
  treino: Treino;
  podeGerenciar: boolean;
  onPresenca: () => void;
  onDeletar: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["inscricao", treino.id_treino],
    queryFn: () => fetchMinhaInscricao({ data: { treinoId: treino.id_treino } }),
  });
  const inscrito = data?.inscricao === "Confirmado";

  const inscrever = useAcao<{ treinoId: number }>(inscreverSe, {
    sucesso: "Inscrição confirmada.",
    invalidar: [["treinos"], ["inscricao", treino.id_treino]],
  });
  const ausentar = useAcao<{ treinoId: number }>(ausentarSe, {
    sucesso: "Ausência registrada.",
    invalidar: [["treinos"], ["inscricao", treino.id_treino]],
  });

  return (
    <li className="card-gold flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl text-foreground">{treino.titulo}</h2>
          <p className="text-sm text-muted-foreground">
            {formatarData(treino.data_treino)} às {formatarHorario(treino.horario)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-primary/40">
            {treino.tipo}
          </Badge>
          {treino.status ? <Badge variant="secondary">{treino.status}</Badge> : null}
        </div>
      </div>

      {treino.descricao ? (
        <p className="text-sm text-muted-foreground">{treino.descricao}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Local</dt>
          <dd>{treino.local ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Divisão</dt>
          <dd>{treino.divisao_responsavel ?? "Todas"}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Badge variant="secondary">{treino.inscritos} inscritos</Badge>
        <div className="flex-1" />
        <Button
          size="sm"
          variant={inscrito ? "secondary" : "default"}
          disabled={inscrever.isPending}
          onClick={() => inscrever.mutate({ treinoId: treino.id_treino })}
        >
          {inscrito ? "Inscrito" : "Vou participar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={ausentar.isPending}
          onClick={() => ausentar.mutate({ treinoId: treino.id_treino })}
        >
          Não vou
        </Button>
        {podeGerenciar ? (
          <>
            <Button size="sm" variant="ghost" onClick={onPresenca}>
              Presença
            </Button>
            <Button size="sm" variant="ghost" onClick={onDeletar}>
              Deletar
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function CriarTreinoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const divisoes = useQuery(divisoesQuery);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    data_treino: new Date().toISOString().slice(0, 10),
    horario: "20:00",
    tipo: "Interno" as string,
    local: "",
    divisao_responsavel: "Todas",
  });

  const acao = useAcao<typeof form>(criarTreino, {
    sucesso: "Treino criado.",
    invalidar: [["treinos"]],
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo treino</DialogTitle>
          <DialogDescription>Agende um treino para a gang.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={form.data_treino}
                onChange={(e) => setForm({ ...form, data_treino: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Horário</Label>
              <Input
                id="hora"
                type="time"
                value={form.horario}
                onChange={(e) => setForm({ ...form, horario: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_TREINO_OPCOES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Divisão responsável</Label>
              <Select
                value={form.divisao_responsavel}
                onValueChange={(v) => setForm({ ...form, divisao_responsavel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas</SelectItem>
                  {(divisoes.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.nome_divisao}>
                      {d.nome_divisao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="local">Local</Label>
            <Input
              id="local"
              value={form.local}
              onChange={(e) => setForm({ ...form, local: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.titulo || acao.isPending}
            onClick={() => acao.mutate(form, { onSuccess: onClose })}
          >
            Criar treino
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresencaDialog({ treino, onClose }: { treino: Treino | null; onClose: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["presencas", treino?.id_treino],
    queryFn: () => fetchPresencas({ data: { treinoId: treino!.id_treino } }),
    enabled: !!treino,
  });

  const acao = useAcao<{ treinoId: number; membroId: string; presenca: string }>(
    atualizarPresenca,
    {
      sucesso: "Presença atualizada.",
      invalidar: [["presencas", treino?.id_treino ?? 0], ["treinos"]],
    },
  );

  const lista = (data ?? []) as PresencaTreino[];

  return (
    <Dialog open={!!treino} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Presença — {treino?.titulo}</DialogTitle>
          <DialogDescription>Marque a presença dos inscritos.</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <Skeleton className="h-32" />
        ) : lista.length === 0 ? (
          <EmptyState title="Ninguém inscrito" description="Ainda não há inscrições no treino." />
        ) : (
          <ul className="space-y-2">
            {lista.map((p) => (
              <li
                key={p.membro_id}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-2"
              >
                <MemberAvatar
                  discordId={p.membro_id}
                  avatarHash={p.avatar_hash}
                  size={36}
                  alt={`Avatar de ${p.discord_username ?? p.membro_id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.nome_rp || p.discord_username || p.membro_id}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.inscricao ?? "Sem inscrição"}
                  </p>
                </div>
                <Select
                  value={p.presenca}
                  onValueChange={(v) =>
                    treino &&
                    acao.mutate({
                      treinoId: treino.id_treino,
                      membroId: p.membro_id,
                      presenca: v,
                    })
                  }
                >
                  <SelectTrigger className="w-36" aria-label="Presença">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESENCA_OPCOES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
