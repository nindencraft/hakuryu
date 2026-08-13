import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, MemberAvatar, PageTitle } from "@/components/hakuryu/ui-bits";
import { useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { divisoesQuery, membrosQuery } from "@/lib/queries";
import {
  atualizarDivisao,
  criarDivisao,
  deletarDivisao,
  removerMembroDivisao,
} from "@/lib/dashboard.functions";
import { podeGerenciarDivisoes } from "@/lib/permissions";
import type { Divisao } from "@/lib/types";

const NENHUM = "__nenhum__";

export const Route = createFileRoute("/divisoes")({
  head: () => ({
    meta: [
      { title: "Divisões — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Divisões da gang Hakuryū: líderes, vices e composição de cada equipe.",
      },
      { property: "og:title", content: "Divisões — Hakuryū Dashboard" },
      { property: "og:description", content: "Estrutura das divisões da gang Hakuryū." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DivisoesPage,
});

function DivisoesPage() {
  return (
    <DashboardShell>
      <Divisoes />
    </DashboardShell>
  );
}

function Divisoes() {
  const user = useSessionUser();
  const podeGerenciar = podeGerenciarDivisoes(user);
  const { data, isPending, error } = useQuery(divisoesQuery);
  const [criando, setCriando] = useState(false);
  const [gerenciando, setGerenciando] = useState<Divisao | null>(null);
  const [deletando, setDeletando] = useState<Divisao | null>(null);

  const deletarAcao = useAcao<{ divisaoId: number }>(deletarDivisao, {
    sucesso: "Divisão removida.",
    invalidar: [["divisoes"], ["membros"]],
  });
  const removerMembroAcao = useAcao<{ membroId: string }>(removerMembroDivisao, {
    sucesso: "Membro removido da divisão.",
    invalidar: [["divisoes"], ["membros"]],
  });

  return (
    <>
      <PageTitle
        kanji="部隊"
        title="Divisões"
        subtitle="Estrutura interna: líderes, vices e integrantes."
        actions={
          podeGerenciar ? (
            <Button onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Nova divisão
            </Button>
          ) : null
        }
      />

      {error ? (
        <EmptyState title="Sem conexão com o banco" description={error.message} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Nenhuma divisão criada" description="Crie a primeira divisão da gang." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(data ?? []).map((d) => (
            <article key={d.id} className="card-gold p-5">
              <div className="flex items-center gap-4">
                {d.logo_url ? (
                  <img
                    src={d.logo_url}
                    alt={`Logo da divisão ${d.nome_divisao}`}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="ring-gold h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="ring-gold flex h-14 w-14 items-center justify-center rounded-full bg-muted font-jp text-lg">
                    部
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display truncate text-xl text-foreground">
                    {d.nome_divisao}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {d.funcao_principal ?? "Sem função definida"}
                  </p>
                </div>
                <Badge variant="secondary">{d.membros.length} membros</Badge>
              </div>

              <GoldRule className="my-4" />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Líder</p>
                  <p className="text-sm">{d.lider_nome ?? d.lider_discord ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                    Vice-líder
                  </p>
                  <p className="text-sm">{d.vice_nome ?? d.vice_discord ?? "—"}</p>
                </div>
              </div>

              {d.membros.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {d.membros.map((m) => (
                    <li
                      key={m.discord_id}
                      className="flex items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pr-2 pl-1"
                    >
                      <MemberAvatar
                        discordId={m.discord_id}
                        avatarHash={m.avatar_hash}
                        size={24}
                        alt=""
                      />
                      <span className="text-xs">
                        {m.nome_rp || m.discord_username || m.discord_id}
                      </span>
                      {podeGerenciar ? (
                        <button
                          type="button"
                          aria-label={`Remover ${m.discord_username ?? ""} da divisão`}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => removerMembroAcao.mutate({ membroId: m.discord_id })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {podeGerenciar ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGerenciando(d)}>
                    Gerenciar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletando(d)}>
                    Deletar
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <CriarDivisaoDialog open={criando} onClose={() => setCriando(false)} />
      <GerenciarDivisaoDialog divisao={gerenciando} onClose={() => setGerenciando(null)} />

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar divisão?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletando?.nome_divisao}” será apagada e seus membros ficarão sem divisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletando) deletarAcao.mutate({ divisaoId: deletando.id });
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

function CriarDivisaoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    nome_divisao: "",
    discord_role_id: "",
    logo_url: "",
    funcao_principal: "",
  });
  const acao = useAcao<typeof form>(criarDivisao, {
    sucesso: "Divisão criada.",
    invalidar: [["divisoes"]],
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova divisão</DialogTitle>
          <DialogDescription>Cadastre uma nova divisão da gang.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome_divisao}
              onChange={(e) => setForm({ ...form, nome_divisao: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">ID do cargo no Discord</Label>
            <Input
              id="role"
              value={form.discord_role_id}
              onChange={(e) => setForm({ ...form, discord_role_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">URL do logo</Label>
            <Input
              id="logo"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="funcao">Função principal</Label>
            <Input
              id="funcao"
              value={form.funcao_principal}
              onChange={(e) => setForm({ ...form, funcao_principal: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.nome_divisao || acao.isPending}
            onClick={() => acao.mutate(form, { onSuccess: onClose })}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerenciarDivisaoDialog({
  divisao,
  onClose,
}: {
  divisao: Divisao | null;
  onClose: () => void;
}) {
  const membros = useQuery(membrosQuery);
  const [lider, setLider] = useState(divisao?.lider_id ?? NENHUM);
  const [vice, setVice] = useState(divisao?.vice_lider_id ?? NENHUM);
  const [novos, setNovos] = useState<string[]>([]);

  const acao = useAcao<{
    divisaoId: number;
    liderId: string | null;
    viceLiderId: string | null;
    novosMembros: string[];
  }>(atualizarDivisao, {
    sucesso: "Divisão atualizada.",
    invalidar: [["divisoes"], ["membros"]],
  });

  const disponiveis = (membros.data ?? []).filter((m) => m.divisao_id !== divisao?.id);

  return (
    <Dialog
      open={!!divisao}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (divisao) {
          setLider(divisao.lider_id ?? NENHUM);
          setVice(divisao.vice_lider_id ?? NENHUM);
          setNovos([]);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar {divisao?.nome_divisao}</DialogTitle>
          <DialogDescription>Defina liderança e adicione membros.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Líder</Label>
            <Select value={lider} onValueChange={setLider}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {(membros.data ?? []).map((m) => (
                  <SelectItem key={m.discord_id} value={m.discord_id}>
                    {m.nome_rp || m.discord_username || m.discord_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vice-líder</Label>
            <Select value={vice} onValueChange={setVice}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {(membros.data ?? []).map((m) => (
                  <SelectItem key={m.discord_id} value={m.discord_id}>
                    {m.nome_rp || m.discord_username || m.discord_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Adicionar membros</Label>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {disponiveis.map((m) => {
                const marcado = novos.includes(m.discord_id);
                return (
                  <li key={m.discord_id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          setNovos((prev) =>
                            marcado
                              ? prev.filter((id) => id !== m.discord_id)
                              : [...prev, m.discord_id],
                          )
                        }
                      />
                      {m.nome_rp || m.discord_username || m.discord_id}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={acao.isPending}
            onClick={() => {
              if (!divisao) return;
              acao.mutate(
                {
                  divisaoId: divisao.id,
                  liderId: lider === NENHUM ? null : lider,
                  viceLiderId: vice === NENHUM ? null : vice,
                  novosMembros: novos,
                },
                { onSuccess: onClose },
              );
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
