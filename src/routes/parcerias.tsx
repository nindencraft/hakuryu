import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";

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
import { parceriasQuery } from "@/lib/queries";
import { deletarParceria, salvarParceria } from "@/lib/dashboard.functions";
import { podeGerenciarParcerias } from "@/lib/permissions";
import { STATUS_PARCERIA_OPCOES, type Parceria } from "@/lib/types";

export const Route = createFileRoute("/parcerias")({
  head: () => ({
    meta: [
      { title: "Parcerias — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Alianças e parcerias da gang Hakuryū: contatos, status e servidores aliados.",
      },
      { property: "og:title", content: "Parcerias — Hakuryū Dashboard" },
      { property: "og:description", content: "Alianças e parcerias da gang Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParceriasPage,
});

function ParceriasPage() {
  return (
    <DashboardShell>
      <Parcerias />
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
};

function Parcerias() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarParcerias(user);
  const { data, isPending, error } = useQuery(parceriasQuery);
  const [editando, setEditando] = useState<typeof VAZIA | null>(null);
  const [deletando, setDeletando] = useState<Parceria | null>(null);

  const deletarAcao = useAcao<{ id: number }>(deletarParceria, {
    sucesso: "Parceria removida.",
    invalidar: [["parcerias"]],
  });

  const parcerias = data?.parcerias ?? [];

  return (
    <>
      <PageTitle
        kanji="同盟"
        title="Parcerias"
        subtitle="Alianças com outros servidores e gangs."
        actions={
          podeGerenciar && !data?.tabelaAusente ? (
            <Button onClick={() => setEditando({ ...VAZIA })}>
              <Plus className="h-4 w-4" /> Nova parceria
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
          title="Tabela de parcerias não encontrada"
          description="Crie a tabela `parcerias` no banco da gang (colunas: id, nome, tag, contato, status, link_servidor, observacoes, data_inicio) para habilitar esta aba."
        />
      ) : parcerias.length === 0 ? (
        <EmptyState title="Nenhuma aliança cadastrada" description="Cadastre a primeira parceria." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {parcerias.map((p) => (
            <li key={p.id} className="card-gold flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display truncate text-xl text-foreground">{p.nome}</h2>
                  <p className="text-sm text-muted-foreground">
                    {p.tag ? `[${p.tag}] · ` : ""}Desde {formatarData(p.data_inicio)}
                  </p>
                </div>
                <Badge variant="outline" className="border-primary/40">
                  {p.status}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                Contato: {p.contato ?? "—"}
              </p>
              {p.observacoes ? <p className="text-sm">{p.observacoes}</p> : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                {p.link_servidor ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={p.link_servidor} target="_blank" rel="noreferrer noopener">
                      Servidor <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : null}
                {podeGerenciar ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditando({
                          id: p.id,
                          nome: p.nome,
                          tag: p.tag ?? "",
                          contato: p.contato ?? "",
                          status: p.status,
                          link_servidor: p.link_servidor ?? "",
                          observacoes: p.observacoes ?? "",
                          data_inicio: p.data_inicio?.slice(0, 10) ?? "",
                        })
                      }
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletando(p)}>
                      Remover
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ParceriaDialog valor={editando} onClose={() => setEditando(null)} />

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parceria?</AlertDialogTitle>
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
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ParceriaDialog({
  valor,
  onClose,
}: {
  valor: typeof VAZIA | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(valor ?? VAZIA);
  const acao = useAcao<typeof VAZIA>(salvarParceria, {
    sucesso: "Parceria salva.",
    invalidar: [["parcerias"]],
  });

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
          <DialogTitle>{form.id == null ? "Nova parceria" : "Editar parceria"}</DialogTitle>
          <DialogDescription>Dados da aliança com outro grupo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pnome">Nome</Label>
              <Input
                id="pnome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ptag">Tag</Label>
              <Input
                id="ptag"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pcontato">Contato</Label>
              <Input
                id="pcontato"
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
              />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plink">Link do servidor</Label>
              <Input
                id="plink"
                value={form.link_servidor}
                onChange={(e) => setForm({ ...form, link_servidor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdata">Data de início</Label>
              <Input
                id="pdata"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
