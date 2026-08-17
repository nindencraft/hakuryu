import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, PageTitle } from "@/components/hakuryu/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  alternarGangAdmin,
  fetchGangsAdmin,
  fetchGuildsDoBotAdmin,
  salvarGangAdmin,
  type GangAdmin,
} from "@/lib/admin.functions";
import { sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/gangs")({
  head: () => ({
    meta: [
      { title: "Gangs registradas — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Área do Super Owner: registrar, editar e ativar gangs do painel Hakuryū.",
      },
      { property: "og:title", content: "Gangs registradas — Hakuryū Dashboard" },
      {
        property: "og:description",
        content: "Área do Super Owner: registrar, editar e ativar gangs do painel Hakuryū.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGangsPage,
});

function AdminGangsPage() {
  return (
    <DashboardShell permitirSemGang>
      <AdminGangs />
    </DashboardShell>
  );
}

const VAZIO = { id: null as number | null, nome: "", guildId: "", liderId: "" };

function AdminGangs() {
  const sessao = useQuery(sessionQuery);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  const gangs = useQuery({
    queryKey: ["admin-gangs"],
    queryFn: () => fetchGangsAdmin(),
    enabled: sessao.data?.user?.isSuperOwner === true,
  });

  const guilds = useQuery({
    queryKey: ["admin-guilds-bot"],
    queryFn: () => fetchGuildsDoBotAdmin(),
    enabled: sessao.data?.user?.isSuperOwner === true,
    staleTime: 60_000,
  });

  const salvar = useMutation({
    mutationFn: (input: { id: number | null; nome: string; guildId: string; liderId: string }) =>
      salvarGangAdmin({
        data: {
          id: input.id,
          nome: input.nome,
          guildId: input.guildId,
          liderId: input.liderId || null,
        },
      }),
    onSuccess: async () => {
      setForm(VAZIO);
      setErro(null);
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const alternar = useMutation({
    mutationFn: (input: { id: number; ativo: boolean }) => alternarGangAdmin({ data: input }),
    onSuccess: async () => queryClient.invalidateQueries(),
    onError: (e: Error) => setErro(e.message),
  });

  if (sessao.data && sessao.data.user && !sessao.data.user.isSuperOwner) {
    return (
      <EmptyState
        title="Área restrita"
        description="Somente o Super Owner pode registrar e administrar gangs."
      />
    );
  }

  const disponiveis = (guilds.data ?? []).filter((g) => !g.registrada);

  return (
    <>
      <PageTitle
        kanji="組"
        title="Gangs registradas"
        subtitle="Registre servidores do Discord, defina o líder e controle o acesso ao painel."
      />

      {erro ? (
        <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {erro}
        </p>
      ) : null}

      <section className="card-gold p-5" aria-labelledby="form-gang">
        <h2 id="form-gang" className="font-display mb-4 text-xl">
          {form.id == null ? "Registrar nova gang" : "Editar gang"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome-gang">Nome da gang</Label>
            <Input
              id="nome-gang"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Hakuryū"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guild-gang">ID do servidor Discord</Label>
            <Input
              id="guild-gang"
              value={form.guildId}
              onChange={(e) => setForm((f) => ({ ...f, guildId: e.target.value }))}
              placeholder="123456789012345678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lider-gang">ID do líder (opcional)</Label>
            <Input
              id="lider-gang"
              value={form.liderId}
              onChange={(e) => setForm((f) => ({ ...f, liderId: e.target.value }))}
              placeholder="Discord ID"
            />
          </div>
        </div>

        {disponiveis.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Servidores onde o bot já está e que ainda não têm gang:
            </p>
            <div className="flex flex-wrap gap-2">
              {disponiveis.map((g) => (
                <Button
                  key={g.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({ ...f, nome: f.nome || g.nome, guildId: g.id }))
                  }
                >
                  {g.nome}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button
            disabled={salvar.isPending || !form.nome.trim() || !form.guildId.trim()}
            onClick={() => salvar.mutate(form)}
          >
            {form.id == null ? "Registrar gang" : "Salvar alterações"}
          </Button>
          {form.id != null ? (
            <Button variant="ghost" onClick={() => setForm(VAZIO)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </section>

      <GoldRule />

      <section aria-labelledby="lista-gangs">
        <h2 id="lista-gangs" className="font-display mb-4 text-2xl">
          Todas as gangs
        </h2>
        {gangs.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : gangs.error ? (
          <EmptyState title="Erro ao carregar gangs" description={gangs.error.message} />
        ) : (gangs.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma gang registrada"
            description="Use o formulário acima para registrar o primeiro servidor."
          />
        ) : (
          <ul className="space-y-3">
            {(gangs.data ?? []).map((g: GangAdmin) => (
              <li
                key={g.id}
                className="card-gold flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-display truncate text-lg">{g.nome}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    guild {g.guildId}
                    {g.liderId ? ` · líder ${g.liderId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={g.ativo ? "default" : "outline"}>
                    {g.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: g.id,
                        nome: g.nome,
                        guildId: g.guildId,
                        liderId: g.liderId ?? "",
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={alternar.isPending}
                    onClick={() => alternar.mutate({ id: g.id, ativo: !g.ativo })}
                  >
                    {g.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
