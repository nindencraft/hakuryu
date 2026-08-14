import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";
import { formatarData, useAcao, useSessionUser } from "@/components/hakuryu/hooks";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { guildAtualQuery, logsQuery, parceriasQuery } from "@/lib/queries";
import { deletarLog, salvarLog } from "@/lib/dashboard.functions";
import { podeGerenciarTreinos } from "@/lib/permissions";
import { TIPO_LOG_OPCOES, type GuildAtual, type LogPartida } from "@/lib/types";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Logs de Partidas — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Placar de treinos amistosos e guerras da gang Hakuryū com detalhes e observações.",
      },
      { property: "og:title", content: "Logs de Partidas — Hakuryū Dashboard" },
      {
        property: "og:description",
        content: "Resultados de amistosos e guerras da gang Hakuryū.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  return (
    <DashboardShell>
      <Logs />
    </DashboardShell>
  );
}

function guildIconUrl(guildId: string | null, iconHash: string | null): string | null {
  if (!guildId || !iconHash) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

function Logs() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarTreinos(user);
  const { data, isPending, error } = useQuery(logsQuery);
  const { data: guild } = useQuery(guildAtualQuery);
  const [criando, setCriando] = useState(false);
  const [deletando, setDeletando] = useState<LogPartida | null>(null);

  const deletarAcao = useAcao<{ id: number }>(deletarLog, {
    sucesso: "Log removido.",
    invalidar: [["logs"]],
  });

  const logs = data?.logs ?? [];
  const amistosos = logs.filter((l) => l.tipo !== "Guerra");
  const guerras = logs.filter((l) => l.tipo === "Guerra");

  const lista = (itens: LogPartida[], vazio: string) =>
    itens.length === 0 ? (
      <EmptyState title="Nenhum registro" description={vazio} />
    ) : (
      <ul className="grid gap-4 lg:grid-cols-2">
        {itens.map((l) => (
          <LogCard
            key={l.id}
            log={l}
            guild={guild ?? null}
            podeGerenciar={podeGerenciar}
            onDeletar={() => setDeletando(l)}
          />
        ))}
      </ul>
    );

  return (
    <>
      <PageTitle
        kanji="戦績"
        title="Logs"
        subtitle="Placares e detalhes de treinos amistosos e guerras."
        actions={
          podeGerenciar && !data?.tabelaAusente ? (
            <Button onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Criar log
            </Button>
          ) : null
        }
      />

      {error ? (
        <EmptyState title="Sem conexão com o banco" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : data?.tabelaAusente ? (
        <EmptyState
          title="Tabela de logs não encontrada"
          description="Rode o script schema_hakuryu.sql (tabela `logs_partidas`) no banco da gang para habilitar esta aba."
        />
      ) : (
        <Tabs defaultValue="amistoso">
          <TabsList>
            <TabsTrigger value="amistoso">Amistosos ({amistosos.length})</TabsTrigger>
            <TabsTrigger value="guerra">Guerras ({guerras.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="amistoso" className="mt-4">
            {lista(amistosos, "Nenhum treino amistoso registrado ainda.")}
          </TabsContent>
          <TabsContent value="guerra" className="mt-4">
            {lista(guerras, "Nenhuma guerra registrada ainda.")}
          </TabsContent>
        </Tabs>
      )}

      <CriarLogDialog open={criando} onClose={() => setCriando(false)} />

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar log?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro contra “{deletando?.adversario_nome}” será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletando) deletarAcao.mutate({ id: deletando.id });
                setDeletando(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Escudo({
  nome,
  icone,
}: {
  nome: string;
  icone: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <p className="font-display w-full truncate text-sm text-foreground">{nome}</p>
      {icone ? (
        <img
          src={icone}
          alt={`Emblema de ${nome}`}
          width={64}
          height={64}
          loading="lazy"
          className="ring-gold h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="ring-gold font-display flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl text-muted-foreground">
          {nome.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function LogCard({
  log,
  guild,
  podeGerenciar,
  onDeletar,
}: {
  log: LogPartida;
  guild: GuildAtual;
  podeGerenciar: boolean;
  onDeletar: () => void;
}) {
  const [aba, setAba] = useState("placar");
  const resultado =
    log.pontos_nos > log.pontos_eles
      ? "Vitória"
      : log.pontos_nos < log.pontos_eles
        ? "Derrota"
        : "Empate";

  return (
    <li className="card-gold relative flex flex-col gap-4 p-5">
      {podeGerenciar ? (
        <button
          type="button"
          aria-label={`Apagar log contra ${log.adversario_nome}`}
          onClick={onDeletar}
          className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pr-8">
        <Badge variant="outline" className="border-primary/40">
          {log.tipo}
        </Badge>
        <Badge variant={resultado === "Derrota" ? "destructive" : "secondary"}>{resultado}</Badge>
        <span className="text-xs text-muted-foreground">{formatarData(log.data_partida)}</span>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="placar">Placar</TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="placar" className="mt-4">
          <div className="flex items-center gap-3">
            <Escudo
              nome={guild?.nome ?? "Nossa gang"}
              icone={guildIconUrl(guild?.id ?? null, guild?.iconHash ?? null)}
            />
            <div className="font-display shrink-0 text-center">
              <p className="text-gold-gradient text-3xl leading-none font-semibold">
                {log.pontos_nos} <span className="text-muted-foreground">x</span> {log.pontos_eles}
              </p>
            </div>
            <Escudo
              nome={log.adversario_nome}
              icone={guildIconUrl(log.adversario_guild_id, log.adversario_icon_hash)}
            />
          </div>
        </TabsContent>

        <TabsContent value="detalhes" className="mt-4 space-y-3 text-sm">
          <p className="whitespace-pre-wrap">
            {log.observacoes || "Sem observações registradas."}
          </p>
          <p className="text-xs text-muted-foreground">
            Registrado por {log.criado_por_nome ?? "—"}
          </p>
        </TabsContent>
      </Tabs>
    </li>
  );
}

function CriarLogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gangs = useQuery(parceriasQuery);
  const [form, setForm] = useState({
    tipo: "Amistoso" as string,
    adversario_id: null as number | null,
    adversario_nome: "",
    adversario_guild_id: null as string | null,
    adversario_icon_hash: null as string | null,
    pontos_nos: 0,
    pontos_eles: 0,
    data_partida: new Date().toISOString().slice(0, 10),
    observacoes: "",
  });

  const acao = useAcao<typeof form>(salvarLog, {
    sucesso: "Log registrado.",
    invalidar: [["logs"]],
  });

  const opcoes = (gangs.data?.parcerias ?? []).filter((p) =>
    form.tipo === "Guerra" ? p.relacao === "Inimiga" : p.relacao !== "Inimiga",
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar log</DialogTitle>
          <DialogDescription>Registre o resultado de um amistoso ou guerra.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    tipo: v,
                    adversario_id: null,
                    adversario_nome: "",
                    adversario_guild_id: null,
                    adversario_icon_hash: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_LOG_OPCOES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldata">Data</Label>
              <Input
                id="ldata"
                type="date"
                value={form.data_partida}
                onChange={(e) => setForm({ ...form, data_partida: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{form.tipo === "Guerra" ? "Gang inimiga" : "Gang aliada"}</Label>
            <Select
              value={form.adversario_id == null ? "" : String(form.adversario_id)}
              onValueChange={(v) => {
                const g = opcoes.find((p) => String(p.id) === v);
                setForm({
                  ...form,
                  adversario_id: g ? g.id : null,
                  adversario_nome: g?.nome ?? "",
                  adversario_guild_id: g?.tag ?? null,
                  adversario_icon_hash: g?.icon_hash ?? null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a gang" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {opcoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Cadastre gangs {form.tipo === "Guerra" ? "inimigas" : "aliadas"} na aba Alianças.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lnos">Nossa pontuação</Label>
              <Input
                id="lnos"
                type="number"
                min={0}
                value={form.pontos_nos}
                onChange={(e) => setForm({ ...form, pontos_nos: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leles">Pontuação deles</Label>
              <Input
                id="leles"
                type="number"
                min={0}
                value={form.pontos_eles}
                onChange={(e) => setForm({ ...form, pontos_eles: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lobs">Observações</Label>
            <Textarea
              id="lobs"
              placeholder="Como foi a partida, destaques, punições..."
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.adversario_nome || acao.isPending}
            onClick={() => acao.mutate(form, { onSuccess: onClose })}
          >
            Salvar log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
