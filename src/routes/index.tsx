import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Megaphone, Pencil, Shield, Users, X } from "lucide-react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, GoldRule, PageTitle, StatCard } from "@/components/hakuryu/ui-bits";
import { formatarData, formatarHorario, useAcao, useSessionUser } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AvisosDeGuerra } from "@/components/hakuryu/diplomacia";
import { removerBannerAdmin, salvarBannerAdmin } from "@/lib/admin.functions";
import { bannerGlobalQuery, divisoesQuery, membrosQuery, treinosQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hakuryū Dashboard — Painel da Gang" },
      {
        name: "description",
        content: "Painel de gestão da gang Hakuryū: membros, treinos, divisões e parcerias.",
      },
      { property: "og:title", content: "Hakuryū Dashboard — Painel da Gang" },
      {
        property: "og:description",
        content: "Painel de gestão da gang Hakuryū: membros, treinos, divisões e parcerias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoGeralPage,
});

function VisaoGeralPage() {
  return (
    <DashboardShell>
      <VisaoGeral />
    </DashboardShell>
  );
}

function VisaoGeral() {
  const membros = useQuery(membrosQuery);
  const treinos = useQuery(treinosQuery);
  const divisoes = useQuery(divisoesQuery);

  const erro = membros.error ?? treinos.error ?? divisoes.error;
  const carregando = membros.isPending || treinos.isPending || divisoes.isPending;

  const ativos = (membros.data ?? []).filter(
    (m) => (m.status ?? "").toLowerCase() === "ativo" || !m.status,
  ).length;

  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = (treinos.data ?? [])
    .filter((t) => t.data_treino >= hoje)
    .sort((a, b) => a.data_treino.localeCompare(b.data_treino))
    .slice(0, 5);

  return (
    <>
      <PageTitle
        kanji="白竜"
        title="Visão Geral"
        subtitle="Resumo da gang: membros, treinos e atividade recente."
      />

      <BannerGlobal />

      <AvisosDeGuerra />

      {erro ? (
        <EmptyState
          title="Sem conexão com o banco"
          description={erro.message}
        />
      ) : carregando ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Membros ativos"
              value={ativos}
              hint={`${membros.data?.length ?? 0} cadastrados no total`}
              icon={<Users className="h-6 w-6" />}
            />
            <StatCard
              label="Treinos cadastrados"
              value={treinos.data?.length ?? 0}
              hint={`${proximos.length} agendados à frente`}
              icon={<CalendarDays className="h-6 w-6" />}
            />
            <StatCard
              label="Divisões"
              value={divisoes.data?.length ?? 0}
              hint="Estrutura interna da gang"
              icon={<Shield className="h-6 w-6" />}
            />
          </div>

          <GoldRule />

          <section aria-labelledby="proximos-treinos">
            <h2 id="proximos-treinos" className="font-display mb-4 text-2xl text-foreground">
              Próximos treinos
            </h2>
            {proximos.length === 0 ? (
              <EmptyState
                title="Nenhum treino agendado"
                description="Cadastre um treino na aba Treinos para aparecer aqui."
              />
            ) : (
              <ul className="space-y-3">
                {proximos.map((t) => (
                  <li
                    key={t.id_treino}
                    className="card-gold flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg text-foreground">{t.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatarData(t.data_treino)} às {formatarHorario(t.horario)}
                        {t.local ? ` · ${t.local}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/40">
                        {t.tipo}
                      </Badge>
                      <Badge variant="secondary">{t.inscritos} inscritos</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function BannerGlobal() {
  const user = useSessionUser();
  const banner = useQuery(bannerGlobalQuery);
  const [configurando, setConfigurando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [form, setForm] = useState({ imagemUrl: "", discordUrl: "" });

  const salvar = useAcao<{ imagemUrl: string; discordUrl: string }>(salvarBannerAdmin, {
    sucesso: "Anúncio global salvo.",
    invalidar: [["banner-global"]],
    aoConcluir: () => setConfigurando(false),
  });
  const remover = useAcao<undefined>(removerBannerAdmin, {
    sucesso: "Anúncio global removido.",
    invalidar: [["banner-global"]],
    aoConcluir: () => setConfirmandoRemocao(false),
  });

  useEffect(() => {
    if (!configurando) return;
    setForm({
      imagemUrl: banner.data?.imagemUrl ?? "",
      discordUrl: banner.data?.discordUrl ?? "",
    });
  }, [banner.data, configurando]);

  const podeAdministrar = !!user?.isSuperOwner;
  const anuncio = banner.data;
  const possuiBanner = anuncio !== null && anuncio !== undefined;

  return (
    <section className="mb-6" aria-label="Anúncio global">
      {banner.isPending ? <Skeleton className="h-36 w-full sm:h-48" /> : null}

      {possuiBanner ? (
        <div className="card-gold relative isolate overflow-hidden p-0">
          <img
            src={anuncio.imagemUrl}
            alt="Anúncio global da comunidade"
            className="aspect-[4/1] min-h-32 w-full object-cover sm:min-h-48"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/25 to-black/55" />
          <div className="absolute inset-0 flex items-end justify-between gap-4 p-4 sm:items-center sm:p-6">
            <div className="min-w-0 text-white">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/80">Anúncio da comunidade</p>
              <p className="mt-1 font-display text-xl text-white sm:text-2xl">Conheça o servidor anunciado</p>
            </div>
            <a
              href={anuncio.discordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Entrar no Discord <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {podeAdministrar ? (
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-md"
                aria-label="Editar anúncio global"
                title="Editar anúncio"
                onClick={() => setConfigurando(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-8 w-8 shadow-md"
                aria-label="Remover anúncio global"
                title="Remover anúncio"
                onClick={() => setConfirmandoRemocao(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : podeAdministrar && !banner.isPending ? (
        <div className="card-gold flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="font-display text-lg text-foreground">Nenhum anúncio global ativo</p>
            <p className="text-sm text-muted-foreground">Crie uma divulgação que aparecerá para todas as gangs.</p>
          </div>
          <Button type="button" onClick={() => setConfigurando(true)}>
            <Megaphone className="h-4 w-4" /> Criar anúncio
          </Button>
        </div>
      ) : null}

      {podeAdministrar ? (
        <>
          <Dialog open={configurando} onOpenChange={setConfigurando}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{possuiBanner ? "Editar anúncio global" : "Criar anúncio global"}</DialogTitle>
                <DialogDescription>
                  Informe a imagem da divulgação e o convite do Discord para exibi-los a todas as gangs.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Dimensão recomendada da imagem: <strong>2400 × 600 px</strong> (proporção 4:1).
                </p>
                <div className="space-y-2">
                  <Label htmlFor="banner-imagem-url">URL da imagem</Label>
                  <Input
                    id="banner-imagem-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://exemplo.com/banner.png"
                    value={form.imagemUrl}
                    onChange={(event) => setForm({ ...form, imagemUrl: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-discord-url">Link do servidor Discord</Label>
                  <Input
                    id="banner-discord-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://discord.gg/seu-servidor"
                    value={form.discordUrl}
                    onChange={(event) => setForm({ ...form, discordUrl: event.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setConfigurando(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!form.imagemUrl.trim() || !form.discordUrl.trim() || salvar.isPending}
                  onClick={() => salvar.mutate(form)}
                >
                  {salvar.isPending ? "Salvando..." : "Salvar anúncio"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={confirmandoRemocao} onOpenChange={setConfirmandoRemocao}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover anúncio global?</AlertDialogTitle>
                <AlertDialogDescription>
                  A imagem e o botão do Discord deixarão de aparecer imediatamente para todas as gangs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={remover.isPending} onClick={() => remover.mutate(undefined)}>
                  {remover.isPending ? "Removendo..." : "Remover anúncio"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </section>
  );
}
