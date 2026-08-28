import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Pencil, Search, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

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
import { cargosPainelPersonalizadosQuery, membrosQuery } from "@/lib/queries";
import {
  advertirMembro,
  alterarCargoPainelMembro,
  alterarStatusMembro,
  buscarMembrosDiscord,
  cadastrarMembroDiscord,
  fetchHistorico,
  fetchHistoricoAtributos,
  salvarAtributosMembro,
  removerMembro,
  revogarPunicao,
  atualizarFichaMembro,
  trocarCargo,
} from "@/lib/dashboard.functions";
import {
  cargosAtribuiveis,
  podeAdicionarMembro,
  podeAlterarCargo,
  podeAplicarBan,
  podeAplicarWarn,
  podeAdvertir,
  podeGerenciarMembros,
  podeAvaliarAtributos,
  podeEditarFichaRPG,
  podeRevogarPunicao,
  podeVerRegistroPunicoes,
  parseCargos,
  rotuloCargo,
} from "@/lib/permissions";
import { ATRIBUTOS_MEMBRO, NIVEIS_ATRIBUTO, TIPO_PUNICAO_OPCOES, type AtributosMembroValores } from "@/lib/types";
import { ESTILOS_LUTA_RPG, GENEROS_RPG, type FichaRPGInput } from "@/lib/perfil";
import type { CargoPainelPersonalizado, HistoricoAtributosMembro, Membro, MembroAtributos, Punicao } from "@/lib/types";

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
  const podeAdicionar = podeAdicionarMembro(user);
  const podePunir = podeAdvertir(user) && (podeAplicarWarn(user) || podeAplicarBan(user));
  const podeVerRegistro = podeVerRegistroPunicoes(user);
  const podeEditarFicha = podeEditarFichaRPG(user);
  const cargosPermitidos = cargosAtribuiveis(user);
  const { data: cargosPersonalizados = [] } = useQuery({
    ...cargosPainelPersonalizadosQuery,
    enabled: podeAlterarCargo(user) || podeGerenciar,
  });
  const podeTrocarCargo = podeAlterarCargo(user) && (cargosPermitidos.length > 0 || cargosPersonalizados.length > 0);
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
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [avaliando, setAvaliando] = useState<Membro | null>(null);
  const [historicoAtributos, setHistoricoAtributos] = useState<Membro | null>(null);
  const [editandoFicha, setEditandoFicha] = useState<Membro | null>(null);

  const membros = data ?? [];
  const minhaDivisaoId = membros.find((m) => m.discord_id === user?.id)?.divisao_id ?? null;
  const podeEditarAtributos = (membro: Membro) =>
    podeAvaliarAtributos(user, membro.divisao_id, minhaDivisaoId);
  const podeVerHistoricoAtributos = (membro: Membro) =>
    membro.discord_id === user?.id || podeEditarAtributos(membro);

  const cargos = useMemo(
    () => Array.from(new Set(membros.flatMap((m) => [...parseCargos(m.cargo), ...m.cargos_painel.map((cargoPainel) => cargoPainel.nome)]))).sort(),
    [membros],
  );
  const divisoes = useMemo(
    () => Array.from(new Set(membros.map((m) => m.divisao).filter(Boolean) as string[])).sort(),
    [membros],
  );

  const filtrados = membros.filter((m) => {
    const alvo = `${m.nome_rp ?? ""} ${m.discord_username ?? ""} ${m.nome_roblox ?? ""}`.toLowerCase();
    if (busca && !alvo.includes(busca.toLowerCase())) return false;
    if (cargo !== TODOS && ![...parseCargos(m.cargo), ...m.cargos_painel.map((cargoPainel) => cargoPainel.nome)].includes(cargo)) return false;
    if (status !== TODOS && m.status !== status) return false;
    if (divisao !== TODOS && m.divisao !== divisao) return false;
    return true;
  });

  const estaEmAnalise = (m: Membro) =>
    m.status === "Em Analise" || parseCargos(m.cargo).includes("Em Analise");
  const banidos = filtrados.filter((m) => m.status === "Banido");
  const oficiais = filtrados.filter((m) => m.status !== "Banido" && !estaEmAnalise(m));
  const emAnalise = filtrados.filter((m) => m.status !== "Banido" && estaEmAnalise(m));

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
                    {m.cargos_painel.map((cargoPainel) => (
                      <Badge key={cargoPainel.discordRoleId} variant="secondary" className="border border-primary/30">
                        {cargoPainel.nome}
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
                      <div className="flex h-full flex-col">
                        <div className="grid gap-4 sm:grid-cols-2">

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
                          {podeEditarFicha ? (
                            <Button size="sm" variant="outline" onClick={() => setEditandoFicha(m)}>
                              <Pencil />
                              Editar ficha RPG
                            </Button>
                          ) : null}
                          {podePunir ? (
                            <Button size="sm" variant="outline" onClick={() => setAdvertindo(m)}>
                              Warn / Ban
                            </Button>
                          ) : null}
                          {podeTrocarCargo ? (
                            <Button size="sm" variant="outline" onClick={() => setTrocando(m)}>
                              Trocar cargo
                            </Button>
                          ) : null}
                          {podeVerRegistro ? (
                            <Button size="sm" variant="ghost" onClick={() => setHistorico(m)}>
                              {m.status === "Banido" ? "Revogar banimento" : "Histórico de punições"}
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
        actions={<div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{filtrados.length} exibidos</Badge>{podeAdicionar ? <Button size="sm" onClick={() => setCadastroAberto(true)}><UserPlus className="h-4 w-4" />Adicionar novo membro</Button> : null}</div>}
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
          {banidos.length > 0 ? (
            <div className="mt-8">
              <h2 className="font-display text-xl text-destructive">Banidos</h2>
              <p className="mb-3 text-sm text-muted-foreground">Membros banidos perdem o acesso ao painel até a revogação do Ban ({banidos.length}).</p>
              {renderLista(banidos)}
            </div>
          ) : null}
        </>
      )}

      <CadastrarMembroDialog aberto={cadastroAberto} onClose={() => setCadastroAberto(false)} />
      <AtributosDialog membro={avaliando} onClose={() => setAvaliando(null)} />
      <FichaAdministrativaDialog membro={editandoFicha} onClose={() => setEditandoFicha(null)} />
      <HistoricoAtributosDialog membro={historicoAtributos} onClose={() => setHistoricoAtributos(null)} />
      <AdvertirDialog membro={advertindo} onClose={() => setAdvertindo(null)} />
      <TrocarCargoDialog membro={trocando} cargosPersonalizados={cargosPersonalizados} onClose={() => setTrocando(null)} />
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

type ResultadoBuscaDiscord = {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  nick: string | null;
  jaCadastrado: boolean;
};

function CadastrarMembroDialog({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ResultadoBuscaDiscord[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);

  const pesquisar = async () => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setErro("Digite ao menos 2 caracteres para pesquisar.");
      setResultados([]);
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      setResultados(await buscarMembrosDiscord({ data: { busca: termo } }) as ResultadoBuscaDiscord[]);
    } catch (error) {
      setResultados([]);
      setErro(error instanceof Error ? error.message : "Não foi possível pesquisar no Discord.");
    } finally {
      setBuscando(false);
    }
  };

  const cadastrar = async (discordId: string) => {
    setAdicionandoId(discordId);
    setErro(null);
    try {
      await cadastrarMembroDiscord({ data: { discordId } });
      await queryClient.invalidateQueries({ queryKey: ["membros"] });
      toast.success("Membro cadastrado. A ficha RPG global foi carregada quando disponível.");
      setResultados((anteriores) => anteriores.map((membro) => membro.id === discordId ? { ...membro, jaCadastrado: true } : membro));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível cadastrar o membro.");
    } finally {
      setAdicionandoId(null);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(novoAberto) => !novoAberto && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar novo membro</DialogTitle>
          <DialogDescription>Pesquise uma pessoa que já esteja no servidor Discord da gang. Se ela tiver ficha RPG, os dados serão carregados automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={busca} onChange={(evento) => setBusca(evento.target.value)} onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); void pesquisar(); } }} placeholder="Nome, apelido ou ID do Discord" aria-label="Buscar integrante no Discord" />
            <Button type="button" variant="outline" disabled={buscando} onClick={() => void pesquisar()}>{buscando ? "Buscando..." : "Buscar"}</Button>
          </div>
          {erro ? <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erro}</p> : null}
          {resultados.length ? <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">{resultados.map((membro) => <li key={membro.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"><MemberAvatar discordId={membro.id} avatarHash={membro.avatarHash} alt="" /><div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{membro.nick || membro.globalName || membro.username}</p><p className="truncate text-sm text-muted-foreground">@{membro.username} · {membro.id}</p></div><Button size="sm" disabled={membro.jaCadastrado || adicionandoId === membro.id} onClick={() => void cadastrar(membro.id)}>{membro.jaCadastrado ? "Já cadastrado" : adicionandoId === membro.id ? "Adicionando..." : "Adicionar"}</Button></li>)}</ul> : !buscando && busca.trim().length >= 2 ? <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada no servidor Discord.</p> : null}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FichaAdministrativaDialog({ membro, onClose }: { membro: Membro | null; onClose: () => void }) {
  const [dados, setDados] = useState<FichaRPGInput>({ nome_roblox: "", nome_rp: "", genero: "", altura_jogo: "", estilo_luta_principal: "" });
  const acao = useAcao<{ membroId: string } & FichaRPGInput>(atualizarFichaMembro, {
    sucesso: "Ficha RPG global atualizada em todas as gangs.",
    invalidar: [["membros"], ["meu-perfil"], ["session"]],
    aoConcluir: onClose,
  });

  useEffect(() => {
    if (!membro) return;
    setDados({
      nome_roblox: membro.nome_roblox ?? "",
      nome_rp: membro.nome_rp ?? "",
      genero: membro.genero ?? "",
      altura_jogo: membro.altura_jogo != null ? String(membro.altura_jogo) : "",
      estilo_luta_principal: membro.estilo_luta_principal ?? "",
    });
  }, [membro]);

  const atualizar = (campo: keyof FichaRPGInput, valor: string) => setDados((atual) => ({ ...atual, [campo]: valor }));
  const semOpcao = "__sem_opcao__";

  return (
    <Dialog open={!!membro} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar ficha RPG global</DialogTitle>
          <DialogDescription>Alterações feitas aqui sincronizam o perfil do jogador e todos os painéis de gang em que ele aparece.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Nome no Roblox</Label><Input maxLength={80} value={dados.nome_roblox} onChange={(e) => atualizar("nome_roblox", e.target.value)} /></div>
          <div className="space-y-2"><Label>Nome no jogo</Label><Input maxLength={80} value={dados.nome_rp} onChange={(e) => atualizar("nome_rp", e.target.value)} /></div>
          <div className="space-y-2"><Label>Gênero</Label><Select value={dados.genero || semOpcao} onValueChange={(v) => atualizar("genero", v === semOpcao ? "" : v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value={semOpcao}>Não informar</SelectItem>{GENEROS_RPG.map((genero) => <SelectItem key={genero} value={genero}>{genero}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Altura no jogo</Label><Input inputMode="decimal" value={dados.altura_jogo} onChange={(e) => atualizar("altura_jogo", e.target.value)} placeholder="Ex.: 1,82" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Estilo de luta principal</Label><Select value={dados.estilo_luta_principal || semOpcao} onValueChange={(v) => atualizar("estilo_luta_principal", v === semOpcao ? "" : v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value={semOpcao}>Não informar</SelectItem>{ESTILOS_LUTA_RPG.map((estilo) => <SelectItem key={estilo.valor} value={estilo.valor}>{estilo.valor} · {estilo.raridade}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={acao.isPending || !membro} onClick={() => membro && acao.mutate({ membroId: membro.discord_id, ...dados })}>{acao.isPending ? "Salvando..." : "Salvar ficha global"}</Button></DialogFooter>
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
  const user = useSessionUser();
  const opcoes: string[] = TIPO_PUNICAO_OPCOES.filter((tipo) => tipo === "Warn" ? podeAplicarWarn(user) : podeAplicarBan(user));
  const [tipo, setTipo] = useState<string>(opcoes[0] ?? "Warn");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    if (opcoes.length && !opcoes.includes(tipo)) setTipo(opcoes[0] ?? "Warn");
  }, [tipo, opcoes.join(",")]);
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
                {opcoes.map((t) => (
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
              disabled={acao.isPending || !opcoes.length}
              onClick={() => {
                if (!membro || !opcoes.length) return;
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

function TrocarCargoDialog({ membro, cargosPersonalizados, onClose }: { membro: Membro | null; cargosPersonalizados: CargoPainelPersonalizado[]; onClose: () => void }) {
  const user = useSessionUser();
  const opcoesCargo = cargosAtribuiveis(user);
  const podeStatus = podeGerenciarMembros(user);
  const [cargos, setCargos] = useState<string[]>(parseCargos(membro?.cargo));
  const [cargosPainelIds, setCargosPainelIds] = useState<string[]>(membro?.cargos_painel_ids ?? []);
  const [status, setStatus] = useState(membro?.status ?? "Ativo");
  const cargoAcao = useAcao<{ membroId: string; cargos: string[] }>(trocarCargo, {
    sucesso: "Cargos atualizados.",
    invalidar: [["membros"]],
  });
  const statusAcao = useAcao<{ membroId: string; status: string }>(alterarStatusMembro, {
    sucesso: "Status atualizado.",
    invalidar: [["membros"]],
  });
  const cargoPainelAcao = useAcao<{ membroId: string; cargoPainelId: number; ativo: boolean }>(alterarCargoPainelMembro, {
    sucesso: "Cargo personalizado atualizado no Discord.",
    invalidar: [["membros"], ["session"]],
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
          setCargosPainelIds(membro.cargos_painel_ids ?? []);
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
          {cargosPersonalizados.length > 0 ? (
            <div className="space-y-2">
              <Label>Cargos personalizados</Label>
              <p className="text-xs text-muted-foreground">
                Estes cargos são adicionados ou removidos diretamente no Discord e liberam as permissões configuradas para a gang.
              </p>
              <div className="flex flex-wrap gap-2">
                {cargosPersonalizados.map((cargoPainel) => {
                  const ativo = cargosPainelIds.includes(cargoPainel.discordRoleId);
                  return (
                    <button
                      key={cargoPainel.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() =>
                        setCargosPainelIds((atuais) =>
                          ativo
                            ? atuais.filter((id) => id !== cargoPainel.discordRoleId)
                            : [...atuais, cargoPainel.discordRoleId],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        ativo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {cargoPainel.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="space-y-2" hidden={!podeStatus || membro?.status === "Banido"}>
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
            disabled={cargoAcao.isPending || cargoPainelAcao.isPending || statusAcao.isPending || (cargos.length === 0 && cargosPainelIds.length === 0)}
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
              const antigosCargosPainel = new Set(membro.cargos_painel_ids ?? []);
              const novosCargosPainel = new Set(cargosPainelIds);
              for (const cargoPainel of cargosPersonalizados) {
                const tinha = antigosCargosPainel.has(cargoPainel.discordRoleId);
                const tem = novosCargosPainel.has(cargoPainel.discordRoleId);
                if (tinha !== tem) {
                  await cargoPainelAcao.mutateAsync({
                    membroId: membro.discord_id,
                    cargoPainelId: cargoPainel.id,
                    ativo: tem,
                  });
                }
              }
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
