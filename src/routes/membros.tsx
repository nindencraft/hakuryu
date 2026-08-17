import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Search, SlidersHorizontal, X } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { MemberAttributeRadar } from "@/components/hakuryu/MemberAttributeRadar";
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
  fetchHistoricoAtributos,
  salvarAtributosMembro,
  atualizarMeusDados,
  removerMembro,
  revogarPunicao,
  trocarCargo,
} from "@/lib/dashboard.functions";
import {
  cargosAtribuiveis,
  podeAdvertir,
  podeGerenciarMembros,
  podeAvaliarAtributos,
  podeRevogarPunicao,
  podeVerRegistroPunicoes,
  parseCargos,
  rotuloCargo,
} from "@/lib/permissions";
import { ATRIBUTOS_MEMBRO, NIVEIS_ATRIBUTO, TIPO_PUNICAO_OPCOES, type AtributosMembroValores } from "@/lib/types";
import type { HistoricoAtributosMembro, Membro, MembroAtributos, Punicao } from "@/lib/types";

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
  const podePunir = podeAdvertir(user);
  const podeVerRegistro = podeVerRegistroPunicoes(user);
  const cargosPermitidos = cargosAtribuiveis(user);
  const podeTrocarCargo = cargosPermitidos.length > 0;
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
  const [editando, setEditando] = useState<Membro | null>(null);
  const [avaliando, setAvaliando] = useState<Membro | null>(null);
  const [historicoAtributos, setHistoricoAtributos] = useState<Membro | null>(null);

  const membros = data ?? [];
  const minhaDivisaoId = membros.find((m) => m.discord_id === user?.id)?.divisao_id ?? null;
  const podeEditarAtributos = (membro: Membro) =>
    podeAvaliarAtributos(user, membro.divisao_id, minhaDivisaoId);
  const podeVerHistoricoAtributos = (membro: Membro) =>
    membro.discord_id === user?.id || podeEditarAtributos(membro);

  const cargos = useMemo(
    () => Array.from(new Set(membros.flatMap((m) => parseCargos(m.cargo)))).sort(),
    [membros],
  );
  const divisoes = useMemo(
    () => Array.from(new Set(membros.map((m) => m.divisao).filter(Boolean) as string[])).sort(),
    [membros],
  );

  const filtrados = membros.filter((m) => {
    const alvo = `${m.nome_rp ?? ""} ${m.discord_username ?? ""} ${m.nome_roblox ?? ""}`.toLowerCase();
    if (busca && !alvo.includes(busca.toLowerCase())) return false;
    if (cargo !== TODOS && !parseCargos(m.cargo).includes(cargo)) return false;
    if (status !== TODOS && m.status !== status) return false;
    if (divisao !== TODOS && m.divisao !== divisao) return false;
    return true;
  });

  const estaEmAnalise = (m: Membro) =>
    m.status === "Em Analise" || parseCargos(m.cargo).includes("Em Analise");
  const oficiais = filtrados.filter((m) => !estaEmAnalise(m));
  const emAnalise = filtrados.filter(estaEmAnalise);

  const removerAcao = useAcao<{ membroId: string }>(removerMembro, {
    sucesso: "Membro removido.",
    invalidar: [["membros"], ["divisoes"]],
  });

  const renderLista = (itens: Membro[]) => (
        <ul className="space-y-3">
          {itens.map((m) => {
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
                    {parseCargos(m.cargo).map((c) => (
                      <Badge key={c} variant="outline" className="border-primary/40">
                        {rotuloCargo(c)}
                      </Badge>
                    ))}
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
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                      <div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <Info label="Gênero" value={m.genero ?? "—"} />
                          <Info
                            label="Altura"
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
                        <div className="mt-4 flex flex-wrap gap-2 lg:mt-auto lg:pt-4">
                          {m.discord_id === user?.id || podeGerenciar ? (
                            <Button size="sm" variant="outline" onClick={() => setEditando(m)}>
                              Editar dados
                            </Button>
                          ) : null}
                          {podeEditarAtributos(m) ? (
                            <Button size="sm" variant="outline" onClick={() => setAvaliando(m)}>
                              <SlidersHorizontal />
                              Avaliar atributos
                            </Button>
                          ) : null}
                          {podeVerHistoricoAtributos(m) ? (
                            <Button size="sm" variant="ghost" onClick={() => setHistoricoAtributos(m)}>
                              <History />
                              Histórico de atributos
                            </Button>
                          ) : null}
                          {podePunir ? (
                            <Button size="sm" variant="outline" onClick={() => setAdvertindo(m)}>
                              Advertir
                            </Button>
                          ) : null}
                          {podeTrocarCargo ? (
                            <Button size="sm" variant="outline" onClick={() => setTrocando(m)}>
                              Trocar cargo
                            </Button>
                          ) : null}
                          {podeVerRegistro ? (
                            <Button size="sm" variant="ghost" onClick={() => setHistorico(m)}>
                              Histórico de punições
                            </Button>
                          ) : null}
                          {podeGerenciar ? (
                            <Button size="sm" variant="ghost" onClick={() => setRemovendo(m)}>
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <MemberAttributeRadar atributos={m.atributos} />
                    </div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
  );

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
        <>
          {oficiais.length > 0 ? renderLista(oficiais) : null}
          {emAnalise.length > 0 ? (
            <div className="mt-8">
              <h2 className="font-display text-xl text-foreground">Em Análise</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Candidatos aguardando aprovação ({emAnalise.length}).
              </p>
              {renderLista(emAnalise)}
            </div>
          ) : null}
        </>
      )}

      <EditarDadosDialog membro={editando} onClose={() => setEditando(null)} />
      <AtributosDialog membro={avaliando} onClose={() => setAvaliando(null)} />
      <HistoricoAtributosDialog membro={historicoAtributos} onClose={() => setHistoricoAtributos(null)} />
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
              {rotuloCargo(o)}
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

function EditarDadosDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [nomeRp, setNomeRp] = useState("");
  const [roblox, setRoblox] = useState("");
  const [genero, setGenero] = useState("");
  const [altura, setAltura] = useState("");
  const [estilo, setEstilo] = useState("");

  useEffect(() => {
    if (!membro) return;
    setNomeRp(membro.nome_rp ?? "");
    setRoblox(membro.nome_roblox ?? "");
    setGenero(membro.genero ?? "");
    setAltura(membro.altura_jogo != null ? String(membro.altura_jogo) : "");
    setEstilo(membro.estilo_luta_principal ?? "");
  }, [membro]);

  const acao = useAcao<{
    membroId: string;
    nome_rp: string;
    nome_roblox: string;
    genero: string;
    altura: string;
    estilo_luta_principal: string;
  }>(atualizarMeusDados, {
    sucesso: "Dados atualizados.",
    invalidar: [["membros"], ["session"]],
    aoConcluir: onClose,
  });

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
          <DialogDescription>Ficha de {membro?.discord_username ?? "membro"}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ed-nome-rp">Nome no RP</Label>
            <Input id="ed-nome-rp" value={nomeRp} onChange={(e) => setNomeRp(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-roblox">Nick do Roblox</Label>
            <Input id="ed-roblox" value={roblox} onChange={(e) => setRoblox(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-genero">Gênero</Label>
            <Input id="ed-genero" value={genero} onChange={(e) => setGenero(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-altura">Altura</Label>
            <Input
              id="ed-altura"
              inputMode="decimal"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ed-estilo">Estilo de luta</Label>
            <Input id="ed-estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={acao.isPending}
            onClick={() =>
              membro &&
              acao.mutate({
                membroId: membro.discord_id,
                nome_rp: nomeRp,
                nome_roblox: roblox,
                genero,
                altura,
                estilo_luta_principal: estilo,
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AtributosDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [valores, setValores] = useState<AtributosMembroValores>({
    movimentacao: 3,
    parry: 3,
    reacao: 3,
    ofensiva: 3,
    defensiva: 3,
    nocao_jogo: 3,
  });

  useEffect(() => {
    if (!membro) return;
    setValores({
      movimentacao: membro.atributos.movimentacao,
      parry: membro.atributos.parry,
      reacao: membro.atributos.reacao,
      ofensiva: membro.atributos.ofensiva,
      defensiva: membro.atributos.defensiva,
      nocao_jogo: membro.atributos.nocao_jogo,
    });
  }, [membro]);

  const acao = useAcao<{ membroId: string; valores: AtributosMembroValores }>(salvarAtributosMembro, {
    sucesso: "Atributos atualizados.",
    invalidar: [["membros"]],
    aoConcluir: onClose,
  });

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Avaliação de atributos</DialogTitle>
          <DialogDescription>
            Avalie o desempenho de {membro?.nome_rp || membro?.discord_username} nas lutas de Gakuran.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {ATRIBUTOS_MEMBRO.map(({ chave, rotulo }) => (
            <div key={chave} className="space-y-2">
              <Label>{rotulo}</Label>
              <Select
                value={String(valores[chave])}
                onValueChange={(valor) =>
                  setValores((atual) => ({ ...atual, [chave]: Number(valor) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS_ATRIBUTO.map((nivel) => (
                    <SelectItem key={nivel.valor} value={String(nivel.valor)}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: nivel.cor }} />
                        {nivel.rotulo}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-primary/20 bg-muted/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Escala:</strong> Muito ruim → Ruim → Razoável → Bom → Muito bom.
          Cada nível vai do vermelho ao verde.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={acao.isPending}
            onClick={() => membro && acao.mutate({ membroId: membro.discord_id, valores })}
          >
            Salvar avaliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoAtributosDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["historico-atributos", membro?.discord_id],
    queryFn: () => fetchHistoricoAtributos({ data: { membroId: membro!.discord_id } }),
    enabled: !!membro,
  });

  return (
    <Dialog open={!!membro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de atributos</DialogTitle>
          <DialogDescription>
            Evolução das avaliações de {membro?.nome_rp || membro?.discord_username}.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <Skeleton className="h-28" />
        ) : error ? (
          <EmptyState title="Não foi possível carregar o histórico" description={error.message} />
        ) : data?.length ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {data.map((item) => (
              <HistoricoAtributoItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma avaliação registrada" description="A primeira avaliação aparecerá aqui quando os atributos forem definidos." />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoricoAtributoItem({ item }: { item: HistoricoAtributosMembro }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {item.avaliado_em ? formatarData(item.avaliado_em) : "Data desconhecida"}
        </span>
        <span className="text-xs text-muted-foreground">
          Avaliado por {item.avaliado_por_nome ?? item.avaliado_por ?? "—"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ATRIBUTOS_MEMBRO.map(({ chave, rotulo }) => {
          const nivel = NIVEIS_ATRIBUTO.find((n) => n.valor === item[chave]);
          return (
            <div key={chave} className="flex items-center justify-between rounded-md border border-border/70 px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">{rotulo}</span>
              <span className="font-semibold" style={{ color: nivel?.cor }}>
                {nivel?.rotulo ?? `${item[chave]}/5`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvertirDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [tipo, setTipo] = useState<string>(TIPO_PUNICAO_OPCOES[0]);
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
                {TIPO_PUNICAO_OPCOES.map((t) => (
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
  const user = useSessionUser();
  const opcoesCargo = cargosAtribuiveis(user);
  const podeStatus = podeGerenciarMembros(user);
  const [cargos, setCargos] = useState<string[]>(parseCargos(membro?.cargo));
  const [status, setStatus] = useState(membro?.status ?? "Ativo");
  const cargoAcao = useAcao<{ membroId: string; cargos: string[] }>(trocarCargo, {
    sucesso: "Cargos atualizados.",
    invalidar: [["membros"]],
  });
  const statusAcao = useAcao<{ membroId: string; status: string }>(alterarStatusMembro, {
    sucesso: "Status atualizado.",
    invalidar: [["membros"]],
  });

  const alternar = (c: string) =>
    setCargos((atual) => (atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c]));

  const selecionaveis = parseCargos(membro?.cargo).filter((c) => !opcoesCargo.includes(c));

  return (
    <Dialog
      open={!!membro}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (membro) {
          setCargos(parseCargos(membro.cargo));
          setStatus(membro.status);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargos e status</DialogTitle>
          <DialogDescription>
            Atualize a posição de {membro?.nome_rp || membro?.discord_username} na gang. É possível
            acumular cargos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cargos</Label>
            <div className="flex flex-wrap gap-2">
              {opcoesCargo.map((c) => {
                const ativo = cargos.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternar(c)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {rotuloCargo(c)}
                  </button>
                );
              })}
            </div>
            {selecionaveis.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Mantidos automaticamente: {selecionaveis.map(rotuloCargo).join(", ")} (definidos nas
                divisões).
              </p>
            ) : null}
          </div>
          <div className="space-y-2" hidden={!podeStatus}>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={!podeStatus}>
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
            disabled={cargoAcao.isPending || statusAcao.isPending || cargos.length === 0}
            onClick={async () => {
              if (!membro) return;
              const mudouCargos =
                cargos.slice().sort().join(",") !==
                parseCargos(membro.cargo)
                  .filter((c) => opcoesCargo.includes(c))
                  .sort()
                  .join(",");
              if (mudouCargos)
                await cargoAcao.mutateAsync({ membroId: membro.discord_id, cargos });
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
  const user = useSessionUser();
  const podeRevogar = podeRevogarPunicao(user);
  const revogar = useAcao<{ punicaoId: number }>(revogarPunicao, {
    sucesso: "Advertência revogada.",
    invalidar: [["membros"], ["historico", membro?.discord_id ?? ""]],
  });
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
              <li
                key={p.id_punicao ?? i}
                className="relative rounded-md border border-border bg-muted/50 p-3"
              >
                {podeRevogar && p.id_punicao != null ? (
                  <button
                    type="button"
                    aria-label={`Revogar ${p.tipo}`}
                    disabled={revogar.isPending}
                    onClick={() => revogar.mutate({ punicaoId: p.id_punicao! })}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <div className="flex items-center justify-between gap-2 pr-4">
                  <span className="text-sm font-semibold">{p.tipo}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(p.data_aplicacao ?? null)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.motivo ?? "Sem motivo."}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aplicada por: {p.staff_nome ?? "—"}
                </p>
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
