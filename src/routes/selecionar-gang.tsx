import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import bgAsset from "@/assets/hakuryu-bg.png.asset.json";
import logo from "@/assets/hakuryu-logo.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/selecionar-gang")({
  head: () => ({
    meta: [
      { title: "Escolher gang — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Escolha qual gang do Discord você quer administrar no painel Hakuryū.",
      },
      { property: "og:title", content: "Escolher gang — Hakuryū Dashboard" },
      {
        property: "og:description",
        content: "Escolha qual gang do Discord você quer administrar no painel Hakuryū.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SelecionarGangPage,
});

function iconeUrl(guildId: string, hash: string | null): string | null {
  return hash ? `https://cdn.discordapp.com/icons/${guildId}/${hash}.png?size=128` : null;
}

function SelecionarGangPage() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery(gangsDisponiveisQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [enviando, setEnviando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(gangId: number) {
    setEnviando(gangId);
    setErro(null);
    try {
      const res = await fetch("/api/public/gangs/selecionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gangId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/" });
    } catch (e) {
      setErro((e as Error).message || "Não foi possível entrar nesta gang.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat bg-scroll px-4 py-10 lg:bg-fixed"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <div className="card-gold relative z-10 w-full max-w-xl bg-white/95 p-8 backdrop-blur-sm">
        <img
          src={logo}
          alt="Emblema do dragão branco Hakuryū"
          width={96}
          height={96}
          className="mx-auto h-24 w-24 object-contain"
        />
        <h1 className="text-gold-gradient font-display mt-4 text-center text-2xl font-semibold">
          Escolha a gang
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Selecione qual servidor você quer administrar agora.
        </p>
        <div className="rule-gold my-6" aria-hidden />

        {erro ? (
          <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            {erro}
          </p>
        ) : null}

        {gangs.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : gangs.error ? (
          <p className="text-sm text-muted-foreground">{gangs.error.message}</p>
        ) : (gangs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma gang disponível para a sua conta. Peça para a liderança registrar o servidor no
            painel.
          </p>
        ) : (
          <ul className="space-y-3">
            {(gangs.data ?? []).map((g) => {
              const icone = iconeUrl(g.guildId, g.iconHash);
              return (
                <li
                  key={g.id}
                  className="card-gold flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {icone ? (
                      <img
                        src={icone}
                        alt=""
                        width={44}
                        height={44}
                        className="ring-gold h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="ring-gold flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {g.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{g.nome}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {g.guildId}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={enviando !== null}
                    onClick={() => void escolher(g.id)}
                  >
                    {enviando === g.id ? "Entrando…" : "Entrar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {sessao.data?.user?.isOwner ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Você é Super Owner: todas as gangs ativas aparecem aqui.
          </p>
        ) : null}

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" asChild>
            <a href="/api/public/auth/logout">Sair</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
