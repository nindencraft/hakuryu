import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, MemberAvatar, PageTitle } from "@/components/hakuryu/ui-bits";
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
import { GangDiplomaticaCard, GangsRegistradas } from "@/components/hakuryu/diplomacia";
import { gangsRegistradasQuery, parceriasQuery } from "@/lib/queries";
import { deletarParceria, resolverAliado, salvarParceria } from "@/lib/dashboard.functions";
import { podeGerenciarParcerias } from "@/lib/permissions";
import { RELACAO_GANG_OPCOES, STATUS_PARCERIA_OPCOES, type Parceria } from "@/lib/types";

export const Route = createFileRoute("/parcerias")({
  head: () => ({
    meta: [
      { title: "Alianças — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Alianças da gang Hakuryū: servidores aliados, representantes e contatos.",
      },
      { property: "og:title", content: "Alianças — Hakuryū Dashboard" },
      { property: "og:description", content: "Servidores aliados da gang Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParceriasPage,
});

function ParceriasPage() {
  return (
    <DashboardShell>
      <Aliancas />
    </DashboardShell>
  );
}

const VAZIA = {
  id: null as number | null,
  nome: "",
  tag: "",
  contato: "",
  status: "Ativa",
  link_servidor: "",
  observacoes: "",
  data_inicio: "",
  icon_hash: "",
  representante_id: "",
  representante_nome: "",
  representante_avatar: "",
  relacao: "Aliada",
};

type FormAlianca = typeof VAZIA;

function guildIconUrl(guildId: string | null, iconHash: string | null): string | null {
  if (!guildId || !iconHash) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

function paraForm(p: Parceria): FormAlianca {
  return {
    id: p.id,
    nome: p.nome,
    tag: p.tag ?? "",
    contato: p.contato ?? "",
    status: p.status,
    link_servidor: p.link_servidor ?? "",
    observacoes: p.observacoes ?? "",
    data_inicio: p.data_inicio?.slice(0, 10) ?? "",
    icon_hash: p.icon_hash ?? "",
    representante_id: p.representante_id ?? "",
    representante_nome: p.representante_nome ?? "",
    representante_avatar: p.representante_avatar ?? "",
    relacao: p.relacao || "Aliada",
  };
}

function Aliancas() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarParcerias(user);
  const { data, isPending, error } = useQuery(parceriasQuery);
  const [editando, setEditando] = useState<FormAlianca | null>(null);
  const [deletando, setDeletando] = useState<Parceria | null>(null);

  const deletarAcao = useAcao<{ id: number }>(deletarParceria, {
    sucesso: "Aliança desfeita.",
    invalidar: [["parcerias"]],
  });

  const aliancas = data?.parcerias ?? [];
  const aliadas = aliancas.filter((p) => p.relacao !== "Inimiga");
  const inimigas = aliancas.filter((p) => p.relacao === "Inimiga");

  const { data: registradas } = useQuery(gangsRegistradasQuery);
  const diploAliadas = (registradas?.gangs ?? []).filter((g) => g.relacao === "Aliada");
  const diploInimigas = (registradas?.gangs ?? []).filter((g) => g.relacao === "Inimiga");

  return (
    <>
      <PageTitle
        kanji="同盟"
        title="Alianças"
        subtitle="Gangs aliadas e inimigas da Hakuryū."
        actions={
          podeGerenciar && !data?.tabelaAusente ? (
            <Button onClick={() => setEditando({ ...VAZIA })}>
              <Plus className="h-4 w-4" /> Adicionar gang
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
      ) : data?.tabelaAusente ? (
        <EmptyState
          title="Tabela de alianças não encontrada"
          description="Crie a tabela `parcerias` no banco da gang (colunas: id, nome, tag, contato, status, link_servidor, observacoes, data_inicio) para habilitar esta aba."
        />
      ) : aliancas.length === 0 && diploAliadas.length === 0 && diploInimigas.length === 0 ? (
        <EmptyState
          title="Nenhuma gang cadastrada"
          description="Adicione a primeira gang aliada ou inimiga usando o link do servidor dela."
        />
      ) : (
        <div className="space-y-10">
          {(
            [
              { titulo: "Gangs aliadas", kanji: "同盟", lista: aliadas, diplo: diploAliadas },
              { titulo: "Gangs inimigas", kanji: "敵", lista: inimigas, diplo: diploInimigas },
            ] as const
          ).map((secao) =>
            secao.lista.length === 0 && secao.diplo.length === 0 ? null : (
              <section key={secao.titulo} className="space-y-3">
                <h2 className="font-display text-lg text-muted-foreground">
                  <span className="font-jp mr-2 text-primary">{secao.kanji}</span>
                  {secao.titulo}
                </h2>
                <ul className="grid gap-4 lg:grid-cols-2">
                  {secao.diplo.map((g) => (
                    <GangDiplomaticaCard key={`diplo-${g.id}`} gang={g} />
                  ))}
                  {secao.lista.map((p) => (
                    <AliancaCard
                      key={p.id}
                      alianca={p}
                      podeGerenciar={podeGerenciar}
                      onEditar={() => setEditando(paraForm(p))}
                      onDeletar={() => setDeletando(p)}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <div className="mt-10">
        <GangsRegistradas />
      </div>

      <AliancaDialog valor={editando} onClose={() => setEditando(null)} />

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer aliança?</AlertDialogTitle>
            <AlertDialogDescription>
              A aliança com “{deletando?.nome}” será apagada.
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
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AliancaCard({
  alianca: p,
  podeGerenciar,
  onEditar,
  onDeletar,
}: {
  alianca: Parceria;
  podeGerenciar: boolean;
  onEditar: () => void;
  onDeletar: () => void;
}) {
  const icone = guildIconUrl(p.tag, p.icon_hash);

  return (
    <li className="card-gold relative flex flex-col gap-3 p-5">
      {podeGerenciar ? (
        <button
          type="button"
          aria-label={`Desfazer aliança com ${p.nome}`}
          onClick={onDeletar}
          className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <div className="flex items-start gap-4 pr-8">
        {icone ? (
          <img
            src={icone}
            alt={`Ícone do servidor ${p.nome}`}
            width={56}
            height={56}
            loading="lazy"
            className="ring-gold h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="ring-gold font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg text-muted-foreground">
            {p.nome.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl text-foreground">{p.nome}</h2>
          <p className="text-sm text-muted-foreground">Desde {formatarData(p.data_inicio)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={p.relacao === "Inimiga" ? "destructive" : "outline"} className="border-primary/40">
              {p.relacao === "Inimiga" ? "Inimiga" : "Aliada"}
            </Badge>
            <Badge variant="outline" className="border-primary/40">
              {p.status}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Representante</dt>
          <dd className="mt-1 flex items-center gap-2">
            {p.representante_id ? (
              <MemberAvatar
                discordId={p.representante_id}
                avatarHash={p.representante_avatar}
                size={28}
                alt={`Avatar de ${p.representante_nome ?? p.representante_id}`}
              />
            ) : null}
            <span className="truncate">
              {p.representante_nome || p.contato || "—"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase">Aliança fechada por</dt>
          <dd className="mt-1 truncate">{p.fechado_por_nome ?? "—"}</dd>
        </div>
      </dl>

      {p.observacoes ? <p className="text-sm">{p.observacoes}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {p.link_servidor ? (
          <Button size="sm" variant="outline" asChild>
            <a href={p.link_servidor} target="_blank" rel="noreferrer noopener">
              Servidor deles <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
        {podeGerenciar ? (
          <Button size="sm" variant="ghost" onClick={onEditar}>
            Editar
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function AliancaDialog({
  valor,
  onClose,
}: {
  valor: FormAlianca | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormAlianca>(valor ?? VAZIA);

  const acao = useAcao<FormAlianca>(salvarParceria, {
    sucesso: "Aliança salva.",
    invalidar: [["parcerias"]],
  });

  const buscar = useMutation({
    mutationFn: (input: { convite: string; representanteId: string }) =>
      resolverAliado({ data: input }),
    onSuccess: (res) => {
      setForm((f) => ({
        ...f,
        nome: res.guild?.nome || f.nome,
        tag: res.guild?.id ?? f.tag,
        icon_hash: res.guild?.iconHash ?? f.icon_hash,
        representante_id: res.representante?.id ?? f.representante_id,
        representante_nome: res.representante?.nome ?? f.representante_nome,
        representante_avatar: res.representante?.avatarHash ?? f.representante_avatar,
        contato: res.representante?.nome ?? f.contato,
      }));
      if (!res.guild) toast.error("Não consegui ler o convite. Preencha o nome manualmente.");
      else if (!res.representante) toast.error("Servidor encontrado, mas o ID do representante não foi resolvido.");
      else toast.success("Dados carregados do Discord.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const icone = guildIconUrl(form.tag || null, form.icon_hash || null);

  return (
    <Dialog
      open={!!valor}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (valor) setForm(valor);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id == null ? "Adicionar gang" : "Editar gang"}</DialogTitle>
          <DialogDescription>
            Cole o link do servidor aliado e o ID do representante — o resto vem do Discord.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pconvite">Link do servidor (convite)</Label>
            <Input
              id="pconvite"
              placeholder="https://discord.gg/abc123"
              value={form.link_servidor}
              onChange={(e) => setForm({ ...form, link_servidor: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prep">ID do representante no Discord</Label>
            <div className="flex gap-2">
              <Input
                id="prep"
                placeholder="123456789012345678"
                value={form.representante_id}
                onChange={(e) => setForm({ ...form, representante_id: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                disabled={buscar.isPending || (!form.link_servidor && !form.representante_id)}
                onClick={() =>
                  buscar.mutate({
                    convite: form.link_servidor,
                    representanteId: form.representante_id,
                  })
                }
              >
                <Search className="h-4 w-4" /> Buscar
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
            {icone ? (
              <img
                src={icone}
                alt="Ícone do servidor aliado"
                width={44}
                height={44}
                className="ring-gold h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-muted" aria-hidden />
            )}
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{form.nome || "Servidor não identificado"}</p>
              <p className="truncate text-muted-foreground">
                Representante: {form.representante_nome || "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pnome">Nome do servidor</Label>
              <Input
                id="pnome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Relação</Label>
              <Select value={form.relacao} onValueChange={(v) => setForm({ ...form, relacao: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELACAO_GANG_OPCOES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_PARCERIA_OPCOES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pobs">Observações</Label>
            <Textarea
              id="pobs"
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
            disabled={!form.nome || acao.isPending}
            onClick={() => acao.mutate(form, { onSuccess: onClose })}
          >
            Salvar gang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
