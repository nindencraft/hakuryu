import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  ExternalLink,
  LogIn,
  LogOut,
  Megaphone,
  Newspaper,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import bgAsset from "@/assets/hakuryu-bg.png.asset.json";
import logo from "@/assets/hakuryu-logo.png";
import mainBgAsset from "@/assets/hakuryu-main-bg.png.asset.json";
import { NoticiasRecentes } from "@/components/hakuryu/Noticias";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { acaoPainelHome } from "@/lib/home-hub";
import { bannerGlobalQuery, gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hakuryū — Hub da Comunidade Gakuran" },
      {
        name: "description",
        content: "Hub Hakuryū para notícias, comunidades, recrutamento e acesso ao painel da sua gang.",
      },
      { property: "og:title", content: "Hakuryū — Hub da Comunidade Gakuran" },
      {
        property: "og:description",
        content: "Notícias, recrutamento e acesso aos painéis de gang em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicioPage,
});

function Fundo({ children }: { children: ReactNode }) {
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
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
        <img src={logo} alt="Emblema do dragão branco Hakuryū" className="mx-auto h-28 w-28 object-contain" />
        <p className="font-jp mt-5 text-xs text-primary">白竜 · Gakuran Community Hub</p>
        <h1 className="text-gold-gradient font-display mt-2 text-4xl font-semibold">Hakuryū</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Notícias, comunidades, recrutamento e o painel da sua gang em um único lugar.
        </p>
        {erro ? <p className="mt-5 rounded-md border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{erro}</p> : null}
        <Button className="mt-7 w-full" size="lg" asChild>
          <a href="/api/public/auth/discord/login">
            <LogIn className="h-4 w-4" /> Entrar com Discord
          </a>
        </Button>
      </section>
    </div>
  );
}

function BannerDestaque() {
  const banner = useQuery(bannerGlobalQuery);

  if (banner.isPending) return <Skeleton className="h-52 w-full sm:h-72" />;
  if (!banner.data) return null;

  return (
    <section className="card-gold relative isolate overflow-hidden p-0" aria-label="Destaque da comunidade">
      <img
        src={banner.data.imagemUrl}
        alt="Destaque da comunidade Hakuryū"
        className="aspect-[7/3] min-h-52 w-full object-cover sm:min-h-72"
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/35 to-black/55" />
      <div className="absolute inset-0 flex flex-col items-start justify-end gap-4 p-5 text-white sm:p-8">
        <Badge className="border-white/25 bg-white/15 text-white hover:bg-white/15">Destaque da comunidade</Badge>
        <div className="max-w-xl">
          <p className="font-jp text-xs tracking-[0.2em] text-white/75">GAKURAN · CONEXÕES</p>
          <h2 className="font-display mt-1 text-3xl leading-tight sm:text-4xl">Conheça o servidor em destaque</h2>
          <p className="mt-2 text-sm text-white/80 sm:text-base">Descubra novos espaços para jogar, criar histórias e fortalecer a comunidade.</p>
        </div>
        <Button variant="secondary" asChild>
          <a href={banner.data.discordUrl} target="_blank" rel="noreferrer">
            Ir para o Discord <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}

function ModuloEmBreve({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Compass;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <article className="card-gold flex min-h-52 flex-col p-5 sm:p-6">
      <Icon className="h-6 w-6 text-primary" aria-hidden />
      <p className="font-jp mt-5 text-xs text-primary">{eyebrow}</p>
      <h2 className="font-display mt-1 text-2xl text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Badge variant="outline" className="mt-auto w-fit border-primary/35 text-muted-foreground">Em breve</Badge>
    </article>
  );
}

function AcessoAoPainel({
  permitido,
  gangId,
  gangNome,
  quantidadeDeGangs,
}: {
  permitido: boolean;
  gangId: number | null;
  gangNome: string | null;
  quantidadeDeGangs: number;
}) {
  const acao = acaoPainelHome({ permitido, gangId, quantidadeDeGangs });
  const podeAbrirPainel = acao === "abrir-painel";
  const deveEscolher = acao === "escolher-gang";

  return (
    <section className="card-gold relative overflow-hidden bg-white/92 p-5 sm:p-6">
      <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-primary/10" aria-hidden />
      <div className="relative flex h-full flex-col">
        <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
        <p className="font-jp mt-5 text-xs text-primary">SEU ESPAÇO</p>
        <h2 className="font-display mt-1 text-2xl text-foreground">Painel de gang</h2>
        {podeAbrirPainel ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Você está com acesso a <strong className="text-foreground">{gangNome ?? "sua gang"}</strong>. Entre para organizar membros, treinos, diplomacia e muito mais.
            </p>
            <Button className="mt-5 w-full" asChild>
              <Link to="/painel">
                Ir para o painel <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : deveEscolher ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Você possui acesso a {quantidadeDeGangs} {quantidadeDeGangs === 1 ? "gang" : "gangs"}. Escolha qual painel deseja abrir agora.
            </p>
            <Button className="mt-5 w-full" asChild>
              <Link to="/selecionar-gang">
                Escolher gang <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : acao === "aguardar-acesso" ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Seu acesso ao painel aguarda um cargo autorizado. Continue explorando a comunidade enquanto isso.
            </p>
            <Button className="mt-5 w-full" disabled>
              Aguardando acesso
            </Button>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Você ainda não possui um painel de gang disponível. Explore as notícias e futuras oportunidades de recrutamento.
          </p>
        )}
      </div>
    </section>
  );
}

function InicioAutenticado() {
  const sessao = useQuery(sessionQuery);
  const gangs = useQuery({ ...gangsDisponiveisQuery, enabled: Boolean(sessao.data?.user) });
  const search = useRouterState({ select: (s) => s.location.search }) as { erro?: string };
  const user = sessao.data?.user;

  if (sessao.isPending) return <TelaCarregando />;
  if (!sessao.data?.configurado) {
    return <TelaLogin erro="O Hakuryū ainda precisa ser configurado pela administração." />;
  }
  if (!user) {
    return <TelaLogin erro={search?.erro} />;
  }

  const quantidadeDeGangs = gangs.data?.length ?? 0;

  return (
    <Fundo>
      <header className="border-b border-border bg-white/82 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Hakuryū" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-gold-gradient font-display text-xl font-semibold leading-tight">Hakuryū</p>
              <p className="font-jp text-[11px] text-muted-foreground">白竜 · Community Hub</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Navegação do hub">
            <a className="transition-colors hover:text-foreground" href="#noticias">Notícias</a>
            <a className="transition-colors hover:text-foreground" href="#recrutamento">Recrutamento</a>
            <a className="transition-colors hover:text-foreground" href="#explorar">Explorar</a>
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-primary/35 object-cover" />
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-32 truncate text-sm font-semibold">{user.globalName ?? user.username}</p>
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

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-7 sm:px-8 sm:py-10">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
          <div className="card-gold relative overflow-hidden bg-white/92 p-6 sm:p-8">
            <div className="absolute -top-14 -right-10 h-44 w-44 rounded-full bg-primary/10 blur-2xl" aria-hidden />
            <div className="relative max-w-2xl">
              <Badge variant="outline" className="border-primary/40">Seu ponto de encontro em Gakuran</Badge>
              <p className="font-jp mt-6 text-xs tracking-[0.2em] text-primary">白竜 · BEM-VINDO</p>
              <h1 className="font-display mt-2 text-4xl leading-tight text-foreground sm:text-5xl">
                Olá, {user.globalName ?? user.username}.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                Acompanhe as novidades da comunidade, descubra novos espaços e acesse sua gang quando quiser organizar o que importa.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <a href="#noticias"><Newspaper className="h-4 w-4" /> Ver notícias</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="#explorar"><Compass className="h-4 w-4" /> Explorar comunidade</a>
                </Button>
              </div>
            </div>
          </div>
          <AcessoAoPainel
            permitido={Boolean(sessao.data?.permitido)}
            gangId={sessao.data?.gangId ?? null}
            gangNome={sessao.data?.gangNome ?? null}
            quantidadeDeGangs={quantidadeDeGangs}
          />
        </section>

        <BannerDestaque />

        <section id="recrutamento" aria-labelledby="titulo-recrutamento">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-jp text-xs text-primary">募集</p>
              <h2 id="titulo-recrutamento" className="font-display text-3xl text-foreground">Recrutamento</h2>
            </div>
            <Badge variant="outline" className="border-primary/35 text-muted-foreground">Em preparação</Badge>
          </div>
          <div className="card-gold flex flex-col gap-4 bg-white/90 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <UsersRound className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
              <div>
                <h3 className="font-display text-xl">Encontre sua próxima gang</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Gangs com painel ativo poderão manter um único anúncio de recrutamento, com convite seguro gerado pelo bot e controle de ativação pela própria liderança.
                </p>
              </div>
            </div>
            <Badge className="w-fit shrink-0">Novidade a caminho</Badge>
          </div>
        </section>

        <section id="explorar" className="grid gap-5 md:grid-cols-2" aria-label="Próximos módulos do Hakuryū">
          <ModuloEmBreve
            icon={Compass}
            eyebrow="探索"
            title="Explorar servidores"
            description="Encontre roleplays e comunidades aprovadas por etiquetas, estilo e atividade. Cada servidor terá seu próprio perfil público dentro do Hakuryū."
          />
          <ModuloEmBreve
            icon={CalendarDays}
            eyebrow="記録"
            title="Meu perfil"
            description="Acompanhe sua gang atual, seu histórico no painel e, no próximo ciclo, suas participações confirmadas em eventos."
          />
        </section>

        <section id="noticias" className="card-gold bg-white/92 p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">Acompanhe os comunicados oficiais e as reportagens da comunidade.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/noticias">Abrir jornal <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <NoticiasRecentes permitirCriar limite={3} />
        </section>

        <section className="rounded-md border border-primary/25 bg-primary/8 px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">
              O Hakuryū está evoluindo para conectar gangs, roleplays e comunidades de Gakuran sem substituir a identidade de cada servidor.
            </p>
          </div>
        </section>
      </main>
    </Fundo>
  );
}

function InicioPage() {
  return <InicioAutenticado />;
}
