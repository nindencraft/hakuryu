import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import {
  EmptyState,
  GoldRule,
  MemberAvatar,
  PageTitle,
} from "@/components/hakuryu/ui-bits";
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
import { membrosQuery } from "@/lib/queries";
import {
  advertirMembro,
  alterarStatusMembro,
  fetchHistorico,
  removerMembro,
  trocarCargo,
} from "@/lib/dashboard.functions";
import { CARGOS_PERMITIDOS, podeGerenciarMembros } from "@/lib/permissions";
import type { Membro, Punicao } from "@/lib/types";

const TODOS = "__todos__";
const STATUS_OPCOES = ["Ativo", "Inativo", "Afastado", "Em Analise"];

export const Route = createFileRoute("/membros")({
  head: () => ({
    meta: [
      { title: "Membros — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Gestão de membros da gang Hakuryū: cargos, avisos e status.",
      },
      { property: "og:title", content: "Membros — Hakuryū Dashboard" },
      { property: "og:description", content: "Gestão de membros da gang Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembrosPage,
});

function MembrosPage() {
  return (
    <DashboardShell>
      <Membros />
    </DashboardShell>
  );
}

function Membros() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarMembros(user);
  const { data, isPending, error } = useQuery(membrosQuery);

  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [divisao, setDivisao] = useState(TODOS);
  const [aberto, setAberto] = useState<string | null>(null);

  const [advertindo, setAdvertindo] = useState<Membro | null>(null);
  const [trocando, setTrocando] = useState<Membro | null>(null);
  const [historico, setHistorico] = useState<Membro | null>(null);
  const [removendo, setRemovendo] = useState<Membro | null>(null);

  const membros = data ?? [];
  const cargos = useMemo(
    () => Array.from(new Set(membros.map((m) => m.cargo).filter(Boolean))).sort(),
    [membros],
  );
  const divisoes = useMemo(
    () => Array.from(new Set(membros.map((m) => m.divisao).filter(Boolean) as string[])).sort(),
    [membros],
  );

  const filtrados = membros.filter((m) => {
    const alvo = `${m.nome_rp ?? ""} ${m.discord_username ?? ""} ${m.nome_roblox ?? ""}`.toLowerCase();
    if (busca && !alvo.includes(busca.toLowerCase())) return false;
    if (cargo !== TODOS && m.cargo !== cargo) return false;
    if (status !== TODOS && m.status !== status) return false;
    if (divisao !== TODOS && m.divisao !== divisao) return false;
    return true;
  });

  const removerAcao = useAcao<{ membroId: string }>(removerMembro, {
    sucesso: "Membro removido.",
    invalidar: [["membros"], ["divisoes"]],
  });

  return (
    <>
      <PageTitle
        kanji="隊員"
        title="Membros"
        subtitle="Cargos, avisos e status dos integrantes."
        actions={<Badge variant="secondary">{filtrados.length} exibidos</Badge>}
      />

      <div className="card-gold mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar membro"
          />
        </div>
        <Filtro label="Cargo" value={cargo} onChange={setCargo} options={cargos} />
        <Filtro
          label="Status"
          value={status}
          onChange={setStatus}
          options={Array.from(new Set([...STATUS_OPCOES, ...membros.map((m) => m.status)])).filter(
            Boolean,
          )}
        />
        <Filtro label="Divisão" value={divisao} onChange={setDivisao} options={divisoes} />
      </div>

      {error ? (
        <EmptyState title="Sem conexão com o banco" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState title="Nenhum membro encontrado" description="Ajuste a busca ou os filtros." />
      ) : (
        <ul className="space-y-3">
          {filtrados.map((m) => {
            const expandido = aberto === m.discord_id;
            return (
              <li key={m.discord_id} className="card-gold p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <MemberAvatar
                    discordId={m.discord_id}
                    avatarHash={m.avatar_hash}
                    alt={`Avatar de ${m.discord_username ?? m.discord_id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-lg text-foreground">
                      {m.nome_rp || m.discord_username || m.discord_id}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      @{m.discord_username ?? "—"} · Roblox: {m.nome_roblox ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/40">
                      {m.cargo}
                    </Badge>
                    {m.divisao ? <Badge variant="secondary">{m.divisao}</Badge> : null}
                    <Badge variant={m.warns > 0 ? "default" : "outline"}>{m.warns} warns</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAberto(expandido ? null : m.discord_id)}
                      aria-expanded={expandido}
                    >
                      Detalhes
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </div>
                </div>

                {expandido ? (
                  <>
                    <GoldRule className="my-4" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Info label="Gênero" value={m.genero ?? "—"} />
                      <Info
                        label="Altura no jogo"
                        value={m.altura_jogo != null ? `${m.altura_jogo}` : "—"}
                      />
                      <Info label="Estilo de luta" value={m.estilo_luta_principal ?? "—"} />
                      <Info label="Status" value={m.status} />
                      <Info label="Entrada" value={formatarData(m.data_entrada)} />
                      <Info
                        label="Participações"
                        value={`${m.stats.internos} internos · ${m.stats.amistosos} amistosos · ${m.stats.guerras} guerras`}
                      />
                    </div>
                    {podeGerenciar ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAdvertindo(m)}>
                          Advertir
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setTrocando(m)}>
                          Trocar cargo
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setHistorico(m)}>
                          Histórico
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemovendo(m)}>
                          Remover
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AdvertirDialog membro={advertindo} onClose={() => setAdvertindo(null)} />
      <TrocarCargoDialog membro={trocando} onClose={() => setTrocando(null)} />
      <HistoricoDialog membro={historico} onClose={() => setHistorico(null)} />

      <AlertDialog open={!!removendo} onOpenChange={(o) => !o && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              {removendo?.nome_rp || removendo?.discord_username} será removido do banco da gang.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removendo) removerAcao.mutate({ membroId: removendo.discord_id });
                setRemovendo(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Filtro({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{label}: todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function AdvertirDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [tipo, setTipo] = useState("Advertência");
  const [motivo, setMotivo] = useState("");
  const acao = useAcao<{ membroId: string; tipo: string; motivo: string }>(advertirMembro, {
    sucesso: "Advertência registrada.",
    invalidar: [["membros"]],
  });

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advertir membro</DialogTitle>
          <DialogDescription>
            {membro?.nome_rp || membro?.discord_username} receberá um registro de punição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Advertência", "Suspensão", "Observação"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da advertência"
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
              if (!membro) return;
              acao.mutate(
                { membroId: membro.discord_id, tipo, motivo },
                { onSuccess: () => { setMotivo(""); onClose(); } },
              );
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrocarCargoDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [cargo, setCargo] = useState(membro?.cargo ?? "Membro");
  const [status, setStatus] = useState(membro?.status ?? "Ativo");
  const cargoAcao = useAcao<{ membroId: string; cargo: string }>(trocarCargo, {
    sucesso: "Cargo atualizado.",
    invalidar: [["membros"]],
  });
  const statusAcao = useAcao<{ membroId: string; status: string }>(alterarStatusMembro, {
    sucesso: "Status atualizado.",
    invalidar: [["membros"]],
  });

  return (
    <Dialog
      open={!!membro}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (membro) {
          setCargo(membro.cargo);
          setStatus(membro.status);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargo e status</DialogTitle>
          <DialogDescription>
            Atualize a posição de {membro?.nome_rp || membro?.discord_username} na gang.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={cargo} onValueChange={setCargo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARGOS_PERMITIDOS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPCOES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={cargoAcao.isPending || statusAcao.isPending}
            onClick={async () => {
              if (!membro) return;
              if (cargo !== membro.cargo)
                await cargoAcao.mutateAsync({ membroId: membro.discord_id, cargo });
              if (status !== membro.status)
                await statusAcao.mutateAsync({ membroId: membro.discord_id, status });
              onClose();
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["historico", membro?.discord_id],
    queryFn: () => fetchHistorico({ data: { membroId: membro!.discord_id } }),
    enabled: !!membro,
  });

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico de punições</DialogTitle>
          <DialogDescription>
            Registros de {membro?.nome_rp || membro?.discord_username}.
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <Skeleton className="h-24" />
        ) : (data as Punicao[] | undefined)?.length ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {(data as Punicao[]).map((p, i) => (
              <li key={p.id ?? i} className="rounded-md border border-border bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{p.tipo}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(p.data_punicao)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.motivo ?? "Sem motivo."}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum registro" description="Este membro não possui punições." />
        )}
      </DialogContent>
    </Dialog>
  );
}
