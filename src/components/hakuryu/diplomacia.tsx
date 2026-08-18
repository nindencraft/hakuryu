import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Swords, Dumbbell, ExternalLink, X } from "lucide-react";

import { EmptyState, MemberAvatar } from "@/components/hakuryu/ui-bits";
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
import { gangsRegistradasQuery, guerrasQuery } from "@/lib/queries";
import { criarSolicitacao, encerrarGuerra } from "@/lib/dashboard.functions";
import { podeGerenciarParcerias } from "@/lib/permissions";
import type { GangRegistrada, GuerraAtiva, RelacaoGang } from "@/lib/types";

export function guildIcon(guildId: string | null, iconHash: string | null): string | null {
  if (!guildId || !iconHash) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

export function GangAvatar({
  nome,
  guildId,
  iconHash,
  size = 48,
}: {
  nome: string;
  guildId: string | null;
  iconHash: string | null;
  size?: number;
}) {
  const url = guildIcon(guildId, iconHash);
  if (url) {
    return (
      <img
        src={url}
        alt={`Ícone do servidor ${nome}`}
        width={size}
        height={size}
        loading="lazy"
        className="ring-gold shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="ring-gold font-display flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
      aria-hidden
    >
      {nome.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Card de uma gang registrada que já é aliada ou inimiga (seções do topo). */
export function GangDiplomaticaCard({
  gang,
  onDeletar,
  onSolicitar,
}: {
  gang: GangRegistrada;
  onDeletar?: (() => void) | undefined;
  onSolicitar?: ((tipo: string) => void) | undefined;
}) {
  return (
    <li className="card-gold relative flex flex-col gap-3 p-5">
      {onDeletar ? (
        <button
          type="button"
          aria-label={`Remover relação com ${gang.nome}`}
          onClick={onDeletar}
          className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div className="flex items-start gap-4 pr-8">
        <GangAvatar nome={gang.nome} guildId={gang.guild_id} iconHash={gang.icon_hash} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-xl text-foreground">{gang.nome}</h3>
          <p className="text-sm text-muted-foreground">
            {gang.desde ? `Desde ${formatarData(gang.desde)}` : `👥 ${gang.membros} membros`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {badgeRelacao(gang.relacao)}
            <Badge variant="outline" className="border-primary/40">
              👥 {gang.membros} membros
            </Badge>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Representante</dt>
          <dd className="mt-1 flex items-center gap-2">
            {gang.representante_id ? (
              <MemberAvatar
                discordId={gang.representante_id}
                avatarHash={gang.representante_avatar}
                size={28}
                alt={`Avatar de ${gang.representante_nome ?? gang.representante_id}`}
              />
            ) : null}
            <span className="truncate">{gang.representante_nome || "—"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase">
            {gang.relacao === "Inimiga" ? "Guerra aceita por" : "Aliança fechada por"}
          </dt>
          <dd className="mt-1 truncate">{gang.fechado_por_nome ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {gang.convite ? (
          <Button size="sm" variant="outline" asChild>
            <a href={gang.convite} target="_blank" rel="noreferrer noopener">
              Servidor deles <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
        {onSolicitar ? (
          <>
            {gang.relacao !== "Inimiga" ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={gang.pendencias.some((p) => p.tipo === "Guerra")}
                onClick={() => onSolicitar("Guerra")}
              >
                <Swords className="h-4 w-4" /> Declarar guerra
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={gang.pendencias.some((p) => p.tipo === "Treino")}
              onClick={() => onSolicitar("Treino")}
            >
              <Dumbbell className="h-4 w-4" /> Solicitar treino
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function badgeRelacao(relacao: RelacaoGang) {
  if (relacao === "Aliada") return <Badge className="bg-primary/20 text-primary">🤝 Aliada</Badge>;
  if (relacao === "Inimiga") return <Badge variant="destructive">⚔️ Inimiga</Badge>;
  return <Badge variant="secondary">🟢 Neutra</Badge>;
}

/* ================= Gangs registradas ================= */

export function GangsRegistradas() {
  const user = useSessionUser();
  const podeAgir = podeGerenciarParcerias(user);
  const { data, isPending, error } = useQuery(gangsRegistradasQuery);
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<GangRegistrada | null>(null);
  const [solicitando, setSolicitando] = useState<{ gang: GangRegistrada; tipo: string } | null>(
    null,
  );

  // Aliadas e inimigas já aparecem nas seções de cima; aqui só ficam as neutras.
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data?.gangs ?? []).filter(
      (g) => g.relacao === "Neutra" && (!termo || g.nome.toLowerCase().includes(termo)),
    );
  }, [data, busca]);

  return (
    <section className="space-y-4" aria-labelledby="gangs-registradas">
      <h2 id="gangs-registradas" className="font-display text-lg text-muted-foreground">
        <span className="font-jp mr-2 text-primary">組</span>
        Gangs registradas
      </h2>
      <p className="text-sm text-muted-foreground">
        Gangs neutras. Ao virar aliada ou inimiga, a gang passa para as seções acima.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar uma gang..."
            className="pl-9"
            aria-label="Pesquisar gang"
          />
        </div>
      </div>

      {error ? (
        <EmptyState title="Não consegui carregar as gangs" description={error.message} />
      ) : isPending ? (
        <Skeleton className="h-24" />
      ) : data?.tabelaAusente ? (
        <EmptyState
          title="Tabelas de diplomacia não encontradas"
          description="Rode o script sql/diplomacia.sql no banco para habilitar solicitações de aliança, guerra e treino."
        />
      ) : lista.length === 0 ? (
        <EmptyState
          title="Nenhuma gang neutra"
          description="Todas as gangs registradas já são aliadas ou inimigas da sua gang."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((g) => {
            const aberta = selecionada?.id === g.id;
            return (
              <li key={g.id} className="card-gold p-4">
                <button
                  type="button"
                  onClick={() => setSelecionada(aberta ? null : g)}
                  className="flex w-full items-center gap-3 text-left"
                  aria-expanded={aberta}
                >
                  <GangAvatar nome={g.nome} guildId={g.guild_id} iconHash={g.icon_hash} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-lg text-foreground">
                      {g.nome}
                    </span>
                    <span className="text-sm text-muted-foreground">👥 {g.membros} membros</span>
                  </span>
                  {badgeRelacao(g.relacao)}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {aberta ? (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    {!podeAgir ? (
                      <p className="text-sm text-muted-foreground">
                        Apenas Líder e Vice-Líder podem enviar solicitações.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {g.relacao !== "Aliada" && g.relacao !== "Inimiga" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={g.pendencias.some((p) => p.tipo === "Alianca")}
                            onClick={() => setSolicitando({ gang: g, tipo: "Alianca" })}
                          >
                            <Handshake className="h-4 w-4" /> Solicitar aliança
                          </Button>
                        ) : null}
                        {g.relacao !== "Inimiga" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={g.pendencias.some((p) => p.tipo === "Guerra")}
                            onClick={() => setSolicitando({ gang: g, tipo: "Guerra" })}
                          >
                            <Swords className="h-4 w-4" /> Declarar guerra
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={g.pendencias.some((p) => p.tipo === "Treino")}
                          onClick={() => setSolicitando({ gang: g, tipo: "Treino" })}
                        >
                          <Dumbbell className="h-4 w-4" /> Solicitar treino
                        </Button>
                      </div>
                    )}
                    {g.pendencias.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Pendente:{" "}
                        {g.pendencias
                          .map((p) => `${p.tipo} (${p.direcao === "enviada" ? "enviada" : "recebida"})`)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <SolicitacaoDialog valor={solicitando} onClose={() => setSolicitando(null)} />
    </section>
  );
}

function SolicitacaoDialog({
  valor,
  onClose,
}: {
  valor: { gang: GangRegistrada; tipo: string } | null;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  const [nos, setNos] = useState("");
  const [eles, setEles] = useState("");
  const [representante, setRepresentante] = useState("");

  const acao = useAcao<{
    gangId: number;
    tipo: string;
    motivo: string;
    data_evento: string;
    horario: string;
    local: string;
    membros_origem: string;
    membros_destino: string;
    representante_id: string;
  }>(criarSolicitacao, {
    sucesso: "Solicitação enviada.",
    invalidar: [["gangs-registradas"], ["solicitacoes"]],
    aoConcluir: onClose,
  });

  const tipo = valor?.tipo ?? "Alianca";
  const comEvento = tipo === "Guerra" || tipo === "Treino";
  const titulo =
    tipo === "Alianca"
      ? "🤝 Solicitação de aliança"
      : tipo === "Guerra"
        ? "⚔️ Declaração de guerra"
        : "🏋️ Solicitação de treino";

  return (
    <Dialog
      open={!!valor}
      onOpenChange={(o) => {
        if (!o) onClose();
        else {
          setMotivo("");
          setData("");
          setHorario("");
          setLocal("");
          setNos("");
          setEles("");
          setRepresentante("");
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            A solicitação será enviada para a liderança de {valor?.gang.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="representante">
              ID do representante no Discord{tipo === "Alianca" ? "" : " (opcional)"}
            </Label>
            <Input
              id="representante"
              inputMode="numeric"
              placeholder="123456789012345678"
              value={representante}
              onChange={(e) => setRepresentante(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pessoa da sua gang responsável por esse contato — aparece no card da gang.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Explique a proposta para a outra gang."
            />
          </div>

          {comEvento ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario">Horário</Label>
                  <Input
                    id="horario"
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="local">Local</Label>
                <Input id="local" value={local} onChange={(e) => setLocal(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nos">Membros nossos</Label>
                  <Input id="nos" type="number" min={1} value={nos} onChange={(e) => setNos(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eles">Membros deles</Label>
                  <Input
                    id="eles"
                    type="number"
                    min={1}
                    value={eles}
                    onChange={(e) => setEles(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={acao.isPending || (tipo === "Alianca" && !representante.trim())}
            onClick={() => {
              if (!valor) return;
              acao.mutate({
                gangId: valor.gang.id,
                tipo: valor.tipo,
                motivo,
                data_evento: data,
                horario,
                local,
                membros_origem: nos,
                membros_destino: eles,
                representante_id: representante,
              });
            }}
          >
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Aviso de guerra (visão geral) ================= */

export function AvisosDeGuerra() {
  const { data } = useQuery(guerrasQuery);
  const guerras = data?.guerras ?? [];
  if (guerras.length === 0) return null;
  return (
    <section className="space-y-4" aria-label="Guerras ativas">
      {guerras.map((g) => (
        <CardGuerra key={g.id} guerra={g} />
      ))}
    </section>
  );
}

function CardGuerra({ guerra: g }: { guerra: GuerraAtiva }) {
  const user = useSessionUser();
  const [aberto, setAberto] = useState(false);
  const encerrar = useAcao<{ id: number }>(encerrarGuerra, {
    sucesso: "Pedido de encerramento registrado. A guerra encerra quando as duas gangs confirmarem.",
    invalidar: [["guerras"], ["gangs-registradas"], ["solicitacoes"]],
  });

  return (
    <div className="card-gold border-destructive/50 p-5">
      <p className="text-center text-xs font-medium tracking-[0.24em] text-destructive uppercase">
        ⚔️ Guerra ativa
      </p>
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <GangAvatar nome={g.nos.nome} guildId={g.nos.guild_id} iconHash={g.nos.icon_hash} size={64} />
          <span className="font-display text-sm text-foreground">{g.nos.nome}</span>
        </div>
        <span className="font-display text-2xl text-destructive" aria-hidden>
          ⚔️
        </span>
        <div className="flex flex-col items-center gap-2">
          <GangAvatar
            nome={g.eles.nome}
            guildId={g.eles.guild_id}
            iconHash={g.eles.icon_hash}
            size={64}
          />
          <span className="font-display text-sm text-foreground">{g.eles.nome}</span>
        </div>
      </div>

      {g.pedimos_encerrar || g.eles_pediram_encerrar ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {g.pedimos_encerrar
            ? `Vocês pediram o encerramento — aguardando ${g.eles.nome}.`
            : `${g.eles.nome} pediu o encerramento — confirme para encerrar a guerra.`}
        </p>
      ) : null}

      <div className="mt-4 flex justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Ocultar" : "Detalhes"}
        </Button>
        {podeGerenciarParcerias(user) ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={g.pedimos_encerrar || encerrar.isPending}
            onClick={() => encerrar.mutate({ id: g.id })}
          >
            {g.pedimos_encerrar
              ? "Aguardando a outra gang"
              : g.eles_pediram_encerrar
                ? "Confirmar encerramento"
                : "Encerrar guerra"}
          </Button>
        ) : null}
      </div>

      {aberto ? (
        <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <Detalhe rotulo="Solicitada por" valor={g.solicitante_nome ?? "—"} />
          <Detalhe rotulo="Aceita por" valor={g.aceito_por_nome ?? "—"} />
          <Detalhe rotulo="Local" valor={g.local ?? "—"} />
          <Detalhe rotulo="Data" valor={formatarData(g.data_evento)} />
          <Detalhe rotulo="Horário" valor={formatarHorario(g.horario)} />
          <Detalhe
            rotulo="Membros requisitados"
            valor={`${g.membros_nos ?? "—"} (nós) × ${g.membros_eles ?? "—"} (eles)`}
          />
          {g.motivo ? <Detalhe rotulo="Motivo" valor={g.motivo} /> : null}
        </dl>
      ) : null}
    </div>
  );
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  );
}
