import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  ExternalLink,
  LogIn,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import bgAsset from "@/assets/hakuryu-bg.png.asset.json";
import logo from "@/assets/hakuryu-logo.png";
import mainBgAsset from "@/assets/hakuryu-main-bg.png.asset.json";
import { useAcao } from "@/components/hakuryu/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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
import { Textarea } from "@/components/ui/textarea";
import { excluirAnuncioAdmin, fetchAnunciosAdmin, salvarAnuncioAdmin } from "@/lib/admin.functions";
import {
  CATEGORIAS_ANUNCIO,
  INFORMACOES_CATEGORIA_ANUNCIO,
  type CategoriaAnuncio,
} from "@/lib/anuncios";
import type { AnuncioComunidade, EntradaAnuncioComunidade } from "@/lib/anuncios.server";
import { acaoPainelHome } from "@/lib/home-hub";
import { anunciosPublicosQuery, gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hakuryū — Vitrine da Comunidade Gakuran" },
      {
        name: "description",
        content: "Descubra gangs, roleplays e comunidades da rede Hakuryū.",
      },
      { property: "og:title", content: "Hakuryū — Vitrine da Comunidade Gakuran" },
      { property: "og:description", content: "Gangs, roleplays e comunidades em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicioPage,
});

function Fundo({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-scroll lg:bg-fixed"
      style={{ backgroundImage: `url(${mainBgAsset.url})` }}
    >
      <div className="min-h-screen bg-background/62">{children}</div>
    </div>
  );
}

function TelaCarregando() {
  return (
    <Fundo>
      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </Fundo>
  );
}

function TelaLogin({ erro }: { erro?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat bg-scroll px-4 py-10 lg:bg-fixed"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <section className="card-gold w-full max-w-lg bg-white/95 p-8 text-center backdrop-blur-sm sm:p-10">
        <img
          src={logo}
          alt="Emblema do dragão branco Hakuryū"
          className="mx-auto h-28 w-28 object-contain"
        />
        <p className="font-jp mt-5 text-xs text-primary">白竜 · Gakuran Community Hub</p>
        <h1 className="text-gold-gradient font-display mt-2 text-4xl font-semibold">Hakuryū</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Descubra gangs, roleplays e comunidades em um só lugar.
        </p>
        {erro ? (
          <p className="mt-5 rounded-md border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <Button className="mt-7 w-full" size="lg" asChild>
          <a href="/api/public/auth/discord/login">
            <LogIn className="h-4 w-4" /> Entrar com Discord
          </a>
        </Button>
      </section>
    </div>
  );
}

function LinkPainel({
  permitido,
  quantidadeDeGangs,
}: {
  permitido: boolean;
  quantidadeDeGangs: number;
}) {
  const acao = acaoPainelHome({ permitido, gangId: null, quantidadeDeGangs });
  if (acao === "abrir-painel") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/painel">
          <ShieldCheck className="h-4 w-4" /> Painel
        </Link>
      </Button>
    );
  }
  if (acao === "escolher-gang") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/selecionar-gang">
          <ShieldCheck className="h-4 w-4" /> Painel
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled
      title="Seu acesso ao painel ainda não está disponível."
    >
      <ShieldCheck className="h-4 w-4" /> Painel
    </Button>
  );
}

function CardAnuncio({
  anuncio,
  podeAdministrar,
  aoEditar,
  aoExcluir,
}: {
  anuncio: AnuncioComunidade;
  podeAdministrar: boolean;
  aoEditar: (anuncio: AnuncioComunidade) => void;
  aoExcluir: (anuncio: AnuncioComunidade) => void;
}) {
  return (
    <article className="card-gold group relative isolate h-full overflow-hidden bg-white/95 p-0">
      <img
        src={anuncio.imagemUrl}
        alt={`Divulgação: ${anuncio.titulo}`}
        className="aspect-[7/3] w-full object-cover"
      />
      <div
        className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/65 to-transparent"
        aria-hidden
      />
      {podeAdministrar ? (
        <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8 shadow-md"
            onClick={() => aoEditar(anuncio)}
            aria-label={`Editar ${anuncio.titulo}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-8 w-8 shadow-md"
            onClick={() => aoExcluir(anuncio)}
            aria-label={`Excluir ${anuncio.titulo}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div className="p-4 sm:p-5">
        <h3 className="font-display line-clamp-1 text-xl text-foreground">{anuncio.titulo}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {anuncio.descricao}
        </p>
        <Button className="mt-4 w-full" size="sm" asChild>
          <a href={anuncio.discordUrl} target="_blank" rel="noreferrer">
            Ir para o Discord <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </article>
  );
}

function FaixaAnuncios({
  categoria,
  anuncios,
  podeAdministrar,
  aoCriar,
  aoEditar,
  aoExcluir,
}: {
  categoria: CategoriaAnuncio;
  anuncios: AnuncioComunidade[];
  podeAdministrar: boolean;
  aoCriar: (categoria: CategoriaAnuncio) => void;
  aoEditar: (anuncio: AnuncioComunidade) => void;
  aoExcluir: (anuncio: AnuncioComunidade) => void;
}) {
  const info = INFORMACOES_CATEGORIA_ANUNCIO[categoria];
  return (
    <section id={info.ancora} aria-labelledby={`titulo-${info.ancora}`} className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-jp text-xs tracking-[0.18em] text-primary">VITRINE HAKURYŪ</p>
          <h2 id={`titulo-${info.ancora}`} className="font-display text-3xl text-foreground">
            {info.titulo}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{info.subtitulo}</p>
        </div>
        {podeAdministrar ? (
          <Button type="button" size="sm" onClick={() => aoCriar(categoria)}>
            <Plus className="h-4 w-4" /> Criar anúncio
          </Button>
        ) : null}
      </div>

      {anuncios.length === 0 ? (
        <div className="card-gold border-dashed bg-white/70 p-6 text-center">
          <p className="font-display text-lg text-foreground">
            Nenhuma divulgação ativa por enquanto
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Novos anúncios desta categoria aparecerão aqui.
          </p>
        </div>
      ) : (
        <Carousel
          opts={{ align: "start", containScroll: "trimSnaps", dragFree: true }}
          className="px-0 sm:px-12"
        >
          <CarouselContent>
            {anuncios.map((anuncio) => (
              <CarouselItem key={anuncio.id} className="basis-[88%] sm:basis-1/2 xl:basis-1/3">
                <CardAnuncio
                  anuncio={anuncio}
                  podeAdministrar={podeAdministrar}
                  aoEditar={aoEditar}
                  aoExcluir={aoExcluir}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 top-1/2 hidden sm:inline-flex" />
          <CarouselNext className="right-0 top-1/2 hidden sm:inline-flex" />
        </Carousel>
      )}
    </section>
  );
}

function formularioVazio(categoria: CategoriaAnuncio): EntradaAnuncioComunidade {
  return { categoria, titulo: "", descricao: "", imagemUrl: "", discordUrl: "", ativo: true };
}

function GestorAnuncios({
  anuncios,
  isSuperOwner,
}: {
  anuncios: AnuncioComunidade[];
  isSuperOwner: boolean;
}) {
  const admin = useQuery({
    queryKey: ["anuncios-admin"],
    queryFn: () => fetchAnunciosAdmin(),
    enabled: isSuperOwner,
  });
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<EntradaAnuncioComunidade>(formularioVazio("comunidade"));
  const [paraExcluir, setParaExcluir] = useState<AnuncioComunidade | null>(null);

  const invalidar = [["anuncios-comunidade"], ["anuncios-admin"]];
  const salvar = useAcao<EntradaAnuncioComunidade>(salvarAnuncioAdmin, {
    sucesso: "Anúncio salvo na vitrine.",
    invalidar,
    aoConcluir: () => setAberto(false),
  });
  const remover = useAcao<{ id: number }>(excluirAnuncioAdmin, {
    sucesso: "Anúncio removido da vitrine.",
    invalidar,
    aoConcluir: () => setParaExcluir(null),
  });

  const criar = (categoria: CategoriaAnuncio) => {
    setForm(formularioVazio(categoria));
    setAberto(true);
  };
  const editar = (anuncio: AnuncioComunidade) => {
    setForm({
      id: anuncio.id,
      categoria: anuncio.categoria,
      titulo: anuncio.titulo,
      descricao: anuncio.descricao,
      imagemUrl: anuncio.imagemUrl,
      discordUrl: anuncio.discordUrl,
      ativo: anuncio.ativo,
    });
    setAberto(true);
  };

  const porCategoria = (categoria: CategoriaAnuncio) =>
    anuncios.filter((anuncio) => anuncio.categoria === categoria);

  return (
    <>
      <div className="space-y-12">
        {CATEGORIAS_ANUNCIO.map((categoria) => (
          <FaixaAnuncios
            key={categoria}
            categoria={categoria}
            anuncios={porCategoria(categoria)}
            podeAdministrar={isSuperOwner}
            aoCriar={criar}
            aoEditar={editar}
            aoExcluir={setParaExcluir}
          />
        ))}
      </div>

      {isSuperOwner && (admin.data ?? []).some((anuncio) => !anuncio.ativo) ? (
        <section
          className="card-gold mt-12 bg-white/90 p-5 sm:p-6"
          aria-labelledby="anuncios-ocultos"
        >
          <div className="flex items-center gap-3">
            <Megaphone className="h-5 w-5 text-primary" />
            <div>
              <h2 id="anuncios-ocultos" className="font-display text-xl text-foreground">
                Rascunhos e anúncios pausados
              </h2>
              <p className="text-sm text-muted-foreground">
                Somente você vê estas publicações. Edite-as para reativar ou remover.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(admin.data ?? [])
              .filter((anuncio) => !anuncio.ativo)
              .map((anuncio) => (
                <div
                  key={anuncio.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{anuncio.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {INFORMACOES_CATEGORIA_ANUNCIO[anuncio.categoria].titulo} · Pausado
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editar(anuncio)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setParaExcluir(anuncio)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar anúncio" : "Criar anúncio"}</DialogTitle>
            <DialogDescription>
              O anúncio será exibido na faixa da categoria escolhida enquanto estiver ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="anuncio-categoria">Categoria</Label>
                <select
                  id="anuncio-categoria"
                  value={form.categoria}
                  onChange={(event) =>
                    setForm({ ...form, categoria: event.target.value as CategoriaAnuncio })
                  }
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {CATEGORIAS_ANUNCIO.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {INFORMACOES_CATEGORIA_ANUNCIO[categoria].titulo}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-end gap-3 pb-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Publicar imediatamente
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anuncio-titulo">Título</Label>
              <Input
                id="anuncio-titulo"
                value={form.titulo}
                maxLength={100}
                onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                placeholder="Ex.: Onikawa — Gakuran RP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anuncio-descricao">Descrição</Label>
              <Textarea
                id="anuncio-descricao"
                value={form.descricao}
                maxLength={500}
                onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                placeholder="Explique em poucas linhas o que torna este servidor especial."
              />
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Imagem recomendada: <strong>2400 × 1029 px</strong> (proporção 7:3).
            </p>
            <div className="space-y-2">
              <Label htmlFor="anuncio-imagem">URL pública da imagem</Label>
              <Input
                id="anuncio-imagem"
                type="url"
                value={form.imagemUrl}
                onChange={(event) => setForm({ ...form, imagemUrl: event.target.value })}
                placeholder="https://exemplo.com/anuncio.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anuncio-discord">Link do Discord</Label>
              <Input
                id="anuncio-discord"
                type="url"
                value={form.discordUrl}
                onChange={(event) => setForm({ ...form, discordUrl: event.target.value })}
                placeholder="https://discord.gg/seu-servidor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvar.isPending} onClick={() => salvar.mutate(form)}>
              {salvar.isPending ? "Salvando..." : "Salvar anúncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={paraExcluir !== null}
        onOpenChange={(open) => !open && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{paraExcluir?.titulo}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove definitivamente a publicação da Página Inicial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remover.isPending}
              onClick={() => paraExcluir && remover.mutate({ id: paraExcluir.id })}
            >
              {remover.isPending ? "Excluindo..." : "Excluir anúncio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InicioAutenticado() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const anuncios = useQuery(anunciosPublicosQuery);
  const search = useRouterState({ select: (state) => state.location.search }) as { erro?: string };
  const user = sessao.data?.user;

  if (sessao.isPending) return <TelaCarregando />;
  if (!sessao.data?.configurado)
    return <TelaLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  if (!user) return <TelaLogin erro={search?.erro} />;

  const quantidadeDeGangs = gangs.data?.length ?? 0;
  const podeAdministrar = Boolean(user.isSuperOwner);

  return (
    <Fundo>
      <header className="sticky top-0 z-30 border-b border-border bg-white/88 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Hakuryū" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-gold-gradient font-display text-xl font-semibold leading-tight">
                Hakuryū
              </p>
              <p className="font-jp text-[10px] text-muted-foreground">白竜 · Community Hub</p>
            </div>
          </Link>
          <nav
            className="order-3 flex w-full items-center justify-between gap-2 overflow-x-auto border-t border-border/70 pt-2 text-sm text-muted-foreground sm:order-none sm:w-auto sm:border-0 sm:pt-0"
            aria-label="Navegação do hub"
          >
            {CATEGORIAS_ANUNCIO.map((categoria) => (
              <a
                key={categoria}
                className="shrink-0 px-1 transition-colors hover:text-foreground"
                href={`#${INFORMACOES_CATEGORIA_ANUNCIO[categoria].ancora}`}
              >
                {INFORMACOES_CATEGORIA_ANUNCIO[categoria].titulo}
              </a>
            ))}
            <LinkPainel
              permitido={Boolean(sessao.data?.permitido)}
              quantidadeDeGangs={quantidadeDeGangs}
            />
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={user.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-primary/35 object-cover"
            />
            <div className="hidden min-w-0 lg:block">
              <p className="max-w-32 truncate text-sm font-semibold">
                {user.globalName ?? user.username}
              </p>
              <p className="max-w-32 truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <a href="/api/public/auth/logout" aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-8 sm:py-11">
        <section className="flex flex-col gap-4 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline" className="border-primary/40">
              Vitrine da comunidade
            </Badge>
            <p className="font-jp mt-5 text-xs tracking-[0.2em] text-primary">白竜 · CONEXÕES</p>
            <h1 className="font-display mt-2 text-3xl leading-tight text-foreground sm:text-4xl">
              Encontre seu próximo lugar em Gakuran.
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              Explore divulgações selecionadas de gangs, roleplays e comunidades. Use as setas ou
              deslize os cards para conhecer mais.
            </p>
          </div>
          {podeAdministrar ? (
            <Badge className="w-fit">
              <Megaphone className="h-3.5 w-3.5" /> Modo de edição ativo
            </Badge>
          ) : null}
        </section>

        {anuncios.isPending ? (
          <div className="space-y-12">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : null}
        {anuncios.error ? (
          <div className="card-gold border-destructive/35 bg-destructive/5 p-5 text-sm text-destructive">
            Não foi possível carregar as divulgações: {anuncios.error.message}
          </div>
        ) : null}
        {!anuncios.isPending && !anuncios.error ? (
          <GestorAnuncios anuncios={anuncios.data ?? []} isSuperOwner={podeAdministrar} />
        ) : null}
      </main>
    </Fundo>
  );
}

function InicioPage() {
  return <InicioAutenticado />;
}
