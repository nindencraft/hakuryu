import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, MemberAvatar, PageTitle } from "@/components/hakuryu/ui-bits";
import { formatarData, formatarHorario, useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  encerrarTreino,
  reabrirTreino,
  adiarTreino,
} from "@/lib/dashboard.functions";
import { podeAgendarTreino, podeDeletarTreino, podeGerenciarTreino } from "@/lib/permissions";
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
  const podeAgendar = podeAgendarTreino(user);
  const podeGerenciar = podeGerenciarTreino(user);
  const podeDeletar = podeDeletarTreino(user);
  const { data, isPending, error } = useQuery(treinosQuery);
  const [criando, setCriando] = useState(false);
  const [presencaDe, setPresencaDe] = useState<Treino | null>(null);
  const [deletando, setDeletando] = useState<Treino | null>(null);
  const [adiando, setAdiando] = useState<Treino | null>(null);
  const [justificando, setJustificando] = useState<Treino | null>(null);

  const encerrarAcao = useAcao<{ treinoId: number }>(encerrarTreino, {
    sucesso: "Treino encerrado.",
    invalidar: [["treinos"], ["membros"]],
  });

  const deletarAcao = useAcao<{ treinoId: number }>(deletarTreino, {
    sucesso: "Treino removido.",
    invalidar: [["treinos"]],
  });

  const reabrirAcao = useAcao<{ treinoId: number }>(reabrirTreino, {
    sucesso: "Evento reaberto para atualização de presença.",
    invalidar: [["treinos"], ["atividade"]],
  });

  const treinos = [...(data ?? [])].sort((a, b) => b.data_treino.localeCompare(a.data_treino));
  const finalizado = (t: Treino) => t.status === "Encerrado" || t.status === "Cancelado";
  const abertos = treinos.filter((t) => !finalizado(t));
  const finalizados = treinos.filter(finalizado);
  const podeGerirTreino = (t: Treino) =>
    podeGerenciar && t.criado_por === user?.id;

  return (
    <>
      <PageTitle
        kanji="稽古"
        title="Treinos"
        subtitle="Mural de treinos, inscrições e controle de presença."
        actions={
          podeAgendar ? (
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
                podeDeletar={podeDeletar}
                onPresenca={() => setPresencaDe(t)}
                onDeletar={() => setDeletando(t)}
                onAdiar={() => setAdiando(t)}
                onEncerrar={() => encerrarAcao.mutate({ treinoId: t.id_treino })}
                onJustificar={() => setJustificando(t)}
                podeReabrir={!!user?.isSuperOwner}
                onReabrir={() => reabrirAcao.mutate({ treinoId: t.id_treino })}
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
                    podeDeletar={podeDeletar}
                    onPresenca={() => setPresencaDe(t)}
                    onDeletar={() => setDeletando(t)}
                    onAdiar={() => setAdiando(t)}
                    onEncerrar={() => encerrarAcao.mutate({ treinoId: t.id_treino })}
                    onJustificar={() => setJustificando(t)}
                    podeReabrir={!!user?.isSuperOwner}
                    onReabrir={() => reabrirAcao.mutate({ treinoId: t.id_treino })}
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
      <JustificativaDialog treino={justificando} onClose={() => setJustificando(null)} />

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
          podeGerir,
          podeDeletar,
          onPresenca,
          onDeletar,
  onAdiar,
  onEncerrar,
  onJustificar,
  podeReabrir,
  onReabrir,
}: {
  treino: Treino;
  podeGerir: boolean;
  podeDeletar: boolean;
  onPresenca: () => void;
  onDeletar: () => void;
  onAdiar: () => void;
  onEncerrar: () => void;
  onJustificar: () => void;
  podeReabrir: boolean;
  onReabrir: () => void;
}) {
  const encerrado = treino.status === "Encerrado" || treino.status === "Cancelado";
  const { data } = useQuery({
    queryKey: ["inscricao", treino.id_treino],
    queryFn: () => fetchMinhaInscricao({ data: { treinoId: treino.id_treino } }),
  });
  const inscrito = data?.inscricao === "Confirmado" && !data.justificativa;

  const inscrever = useAcao<{ treinoId: number }>(inscreverSe, {
    sucesso: "Inscrição confirmada.",
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
        <div className="flex flex-wrap items-center gap-2">
          {(treino.tipos?.length ? treino.tipos : [treino.tipo]).map((tipo) => (
            <Badge key={tipo} variant="outline" className="border-primary/40">
              {tipo}
            </Badge>
          ))}
          {treino.aliado ? (
            <Badge variant="outline" className="border-primary/40 text-primary">
              vs {treino.aliado}
            </Badge>
          ) : null}
          {treino.status ? <Badge variant="secondary">{treino.status}</Badge> : null}

          {treino.adiamento ? (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Adiado{treino.adiamento.antes ? ` (era ${formatarData(treino.adiamento.antes.slice(0, 10))})` : ""}
            </Badge>
          ) : null}
          {podeDeletar ? (
            <button
              type="button"
              aria-label={`Deletar treino ${treino.titulo}`}
              onClick={onDeletar}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
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

      {treino.link_servidor_privado ? (
        <a
          href={treino.link_servidor_privado}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Entrar no servidor privado Roblox <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Badge variant="secondary">{treino.inscritos} inscritos</Badge>
        <div className="flex-1" />
        <Button
          size="sm"
          variant={inscrito ? "secondary" : "default"}
          disabled={inscrever.isPending || encerrado}
          onClick={() => inscrever.mutate({ treinoId: treino.id_treino })}
        >
          {inscrito ? "Inscrito" : "Vou participar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={encerrado}
          onClick={onJustificar}
        >
          Não vou
        </Button>
        {podeGerir ? (
          <>
            <Button size="sm" variant="ghost" onClick={onPresenca}>
              Presença
            </Button>
            {!encerrado ? (
              <>
                <Button size="sm" variant="ghost" onClick={onAdiar}>
                  Adiar
                </Button>
                <Button size="sm" variant="ghost" onClick={onEncerrar}>
                  Encerrar
                </Button>
              </>
            ) : null}
            {encerrado && podeReabrir ? (
              <Button size="sm" variant="ghost" onClick={onReabrir}>
                Reabrir
              </Button>
            ) : null}
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
    tipos: ["Gladiador"] as string[],
    local: "",
    link_servidor_privado: "",
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
              <Label>Tipos de treino</Label>
              <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2">
                {TIPO_TREINO_OPCOES.map((tipo) => {
                  const selecionado = form.tipos.includes(tipo);
                  return (
                    <label key={tipo} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selecionado}
                        onCheckedChange={(marcado) =>
                          setForm({
                            ...form,
                            tipos: marcado
                              ? Array.from(new Set([...form.tipos, tipo]))
                              : form.tipos.filter((item) => item !== tipo),
                          })
                        }
                      />
                      {tipo}
                    </label>
                  );
                })}
              </div>
              {!form.tipos.length ? <p className="text-xs text-destructive">Selecione ao menos um tipo.</p> : null}
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
          <div className="space-y-2">
            <Label htmlFor="link-servidor-privado">Servidor privado Roblox (opcional)</Label>
            <Input
              id="link-servidor-privado"
              type="url"
              inputMode="url"
              placeholder="https://www.roblox.com/share?..."
              value={form.link_servidor_privado}
              onChange={(e) => setForm({ ...form, link_servidor_privado: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.titulo || !form.tipos.length || acao.isPending}
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
  const user = useSessionUser();
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
  const encerrado = treino?.status === "Encerrado" || treino?.status === "Cancelado";

  return (
    <Dialog open={!!treino} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Presença — {treino?.titulo}</DialogTitle>
          <DialogDescription>
            {encerrado
              ? "O evento está encerrado e o histórico não pode mais ser alterado."
              : "Avalie as inscrições e justificativas enviadas pelos membros."}
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <Skeleton className="h-32" />
        ) : lista.length === 0 ? (
          <EmptyState title="Nenhum membro elegível" description="Não há membros ativos registrados nesta gang." />
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
                  guildId={user?.guildId}
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
                  {p.justificativa ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Justificativa: {p.justificativa} ({p.justificativa_status})
                    </p>
                  ) : null}
                </div>
                <span aria-label={`Estado: ${p.presenca}`} className="text-base">
                  {p.presenca === "Presente" ? "🟢" : p.presenca === "Justificado" ? "🟡" : p.presenca === "Ausente" ? "🔴" : "⚪"}
                </span>
                <Select
                  value={p.presenca}
                  disabled={encerrado || acao.isPending}
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

function JustificativaDialog({ treino, onClose }: { treino: Treino | null; onClose: () => void }) {
  const [justificativa, setJustificativa] = useState("");
  const acao = useAcao<{ treinoId: number; justificativa: string }>(ausentarSe, {
    sucesso: "Justificativa enviada para avaliação da liderança.",
    invalidar: [["treinos"], ["inscricao", treino?.id_treino ?? 0], ["presencas", treino?.id_treino ?? 0]],
  });

  return (
    <Dialog
      open={!!treino}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setJustificativa("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Justificar ausência</DialogTitle>
          <DialogDescription>
            Informe o motivo de não poder participar de “{treino?.titulo}”. A liderança avaliará o pedido antes de registrar a situação final.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="justificativa-ausencia">Motivo da ausência</Label>
          <Textarea
            id="justificativa-ausencia"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder="Explique de forma objetiva o motivo da ausência."
            minLength={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={justificativa.trim().length < 3 || acao.isPending || !treino}
            onClick={() => treino && acao.mutate({ treinoId: treino.id_treino, justificativa }, { onSuccess: onClose })}
          >
            Enviar justificativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdiarTreinoDialog({ treino, onClose }: { treino: Treino | null; onClose: () => void }) {
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const acao = useAcao<{ treinoId: number; data_treino: string; horario: string }>(adiarTreino, {
    sucesso: "Treino adiado.",
    invalidar: [["treinos"]],
  });

  return (
    <Dialog
      open={!!treino}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (treino) {
          setData(treino.data_treino.slice(0, 10));
          setHorario((treino.horario ?? "20:00").slice(0, 5));
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adiar treino</DialogTitle>
          <DialogDescription>
            Escolha a nova data e horário de “{treino?.titulo}”.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nova-data">Nova data</Label>
            <Input
              id="nova-data"
              type="date"
              value={data || (treino?.data_treino ?? "").slice(0, 10)}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-horario">Novo horário</Label>
            <Input
              id="novo-horario"
              type="time"
              value={horario || (treino?.horario ?? "20:00").slice(0, 5)}
              onChange={(e) => setHorario(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={acao.isPending}
            onClick={() => {
              if (!treino) return;
              acao.mutate(
                {
                  treinoId: treino.id_treino,
                  data_treino: data || treino.data_treino.slice(0, 10),
                  horario: horario || (treino.horario ?? "").slice(0, 5),
                },
                { onSuccess: onClose },
              );
            }}
          >
            Adiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
