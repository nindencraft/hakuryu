import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ScrollText,
  Settings,
  Shield,
  Users,
  Crown,
  Repeat,
  Mails,
  Newspaper,
  Mic2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import bgAsset from "@/assets/hakuryu-bg.png.asset.json";
import sidebarBgAsset from "@/assets/hakuryu-sidebar-bg.png.asset.json";
import mainBgAsset from "@/assets/hakuryu-main-bg.png.asset.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { gangsDisponiveisQuery, sessionQuery } from "@/lib/queries";
import {
  cargoPrincipal,
  nomeExibicao,
  podeGerenciarMembros,
  rotuloCargo,
  type SessionUserView,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { NoticiasRecentes } from "@/components/hakuryu/Noticias";

const logo = "/manus-storage/hakuryu-logo_f1592314.png";

const NAV = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/membros", label: "Membros", icon: Users },
  { to: "/treinos", label: "Treinos", icon: CalendarDays },
  { to: "/divisoes", label: "Divisões", icon: Shield },
  { to: "/parcerias", label: "Alianças", icon: Handshake },
  { to: "/solicitacoes", label: "Solicitações", icon: Mails },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/noticias", label: "Notícias", icon: Newspaper },
];

const NAV_ADMIN = [{ to: "/configuracoes", label: "Configurações", icon: Settings }];

const NAV_OWNER = [
  { to: "/admin/gangs", label: "Gangs registradas", icon: Crown },
  { to: "/admin/jornalistas", label: "Jornalistas", icon: Mic2 },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 py-4">
      <img
        src={logo}
        alt="Emblema do dragão branco Hakuryū"
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-gold-gradient font-display text-lg leading-tight font-semibold">
          Hakuryū
        </p>
        <p className="font-jp text-xs text-muted-foreground">白竜 · painel da gang</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery(sessionQuery);
  const base = podeGerenciarMembros(data?.user ?? null) ? [...NAV, ...NAV_ADMIN] : NAV;
  const itens = data?.user?.isSuperOwner ? [...base, ...NAV_OWNER] : base;

  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {itens.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "border-primary/50 bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-gold)]"
                : "text-sidebar-foreground hover:-translate-y-px hover:border-primary/40 hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="h-4 w-4 text-primary" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ user }: { user: SessionUserView }) {
  return (
    <div className="card-gold flex items-center gap-3 p-3">
      <img
        src={user.avatarUrl}
        alt={`Avatar de ${user.username}`}
        width={44}
        height={44}
        className="ring-gold h-11 w-11 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{nomeExibicao(user)}</p>
        <p className="truncate text-xs text-muted-foreground">Discord: {user.username}</p>
      </div>
    </div>
  );
}

function iconeGuild(guildId: string, hash: string | null): string | null {
  return hash ? `https://cdn.discordapp.com/icons/${guildId}/${hash}.png?size=64` : null;
}

/** Servidores registrados em que o usuário está: troca rápida de painel. */
function GangsRail({
  gangAtivaId,
  onNavigate,
}: {
  gangAtivaId: number | null;
  onNavigate?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data } = useQuery(gangsDisponiveisQuery);
  const [trocando, setTrocando] = useState<number | null>(null);
  const gangs = data ?? [];

  if (gangs.length < 2) return null;

  async function escolher(gangId: number) {
    if (gangId === gangAtivaId) return;
    setTrocando(gangId);
    try {
      const res = await fetch("/api/public/gangs/selecionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gangId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/" });
      onNavigate?.();
    } finally {
      setTrocando(null);
    }
  }

  return (
    <div>
      <p className="mb-2 px-1 text-xs text-muted-foreground">Seus painéis</p>
      <div className="flex flex-wrap gap-2">
        {gangs.map((g) => {
          const icone = iconeGuild(g.guildId, g.iconHash);
          const ativa = g.id === gangAtivaId;
          return (
            <button
              key={g.id}
              type="button"
              title={g.nome}
              aria-label={`Abrir painel de ${g.nome}`}
              disabled={trocando != null}
              onClick={() => void escolher(g.id)}
              className={cn(
                "h-11 w-11 overflow-hidden rounded-full border-2 bg-sidebar-accent/60 text-xs font-semibold transition-all",
                ativa
                  ? "border-primary shadow-[var(--shadow-gold)]"
                  : "border-transparent opacity-70 hover:-translate-y-px hover:border-primary/50 hover:opacity-100",
              )}
            >
              {icone ? (
                <img src={icone} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{g.nome.slice(0, 2).toUpperCase()}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarBody({
  user,
  gangNome,
  gangId,
  onNavigate,
}: {
  user: SessionUserView;
  gangNome?: string | null | undefined;
  gangId: number | null;
  onNavigate?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();

  return (
    <div className="flex h-full flex-col gap-4">
      <Brand />
      <div className="rule-gold" aria-hidden />
      <UserCard user={user} />
      {user.isOwner || cargoPrincipal(user) ? (
        <div className="flex flex-wrap gap-1.5">
          {user.isOwner ? <Badge variant="default">Dono</Badge> : null}
          {cargoPrincipal(user) ? (
            <Badge variant="outline" className="border-primary/40 text-muted-foreground">
              {rotuloCargo(cargoPrincipal(user)!)}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {gangNome ? (
        <div className="rounded-md border border-primary/30 bg-sidebar-accent/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Gang ativa</p>
          <p className="truncate text-sm font-semibold">{gangNome}</p>
        </div>
      ) : null}
      <GangsRail gangAtivaId={gangId} onNavigate={onNavigate} />
      <div className="rule-gold" aria-hidden />
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void queryClient.invalidateQueries();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Atualizar dados
        </Button>
        {user.isSuperOwner ? (
          <Button variant="outline" size="sm" asChild>
            <Link to="/selecionar-gang" onClick={onNavigate}>
              <Repeat className="h-4 w-4" /> Trocar de gang
            </Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" asChild>
          <a href="/api/public/auth/logout">
            <LogOut className="h-4 w-4" /> Sair
          </a>
        </Button>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat bg-scroll lg:bg-fixed px-4 py-10"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <div className="card-gold relative z-10 w-full max-w-lg bg-white/95 p-8 text-center backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

function LoginScreen({ erro }: { erro?: string | undefined }) {
  return (
    <CenteredCard>
      <img
        src={logo}
        alt="Emblema do dragão branco Hakuryū"
        width={140}
        height={140}
        className="mx-auto h-35 w-35 object-contain"
      />
      <h1 className="text-gold-gradient font-display mt-4 text-3xl font-semibold">
        Hakuryū Dashboard
      </h1>
      <p className="font-jp mt-1 text-sm text-muted-foreground">白竜 · painel de gestão da gang</p>
      <div className="rule-gold my-6" aria-hidden />
      {erro ? (
        <p className="mb-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {erro}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Entre com o Discord para acessar o painel. Só membros do servidor com cargo autorizado
        conseguem entrar.
      </p>
      <Button size="lg" className="mt-6 w-full" asChild>
        <a href="/api/public/auth/discord/login">Entrar com Discord</a>
      </Button>
    </CenteredCard>
  );
}

function SetupScreen({ faltando }: { faltando: string[] }) {
  return (
    <CenteredCard>
      <h1 className="text-gold-gradient font-display text-2xl font-semibold">
        Painel quase pronto
      </h1>
      <div className="rule-gold my-5" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Faltam credenciais para conectar ao banco da gang e ao Discord. Adicione os segredos abaixo
        nas configurações do projeto:
      </p>
      <ul className="mt-4 space-y-1 text-left font-mono text-xs text-foreground">
        {faltando.map((f) => (
          <li key={f} className="rounded bg-muted px-3 py-2">
            {f}
          </li>
        ))}
      </ul>
    </CenteredCard>
  );
}

function BlockedScreen({ user }: { user: SessionUserView }) {
  return (
    <CenteredCard>
      <img
        src={user.avatarUrl}
        alt=""
        width={72}
        height={72}
        className="ring-gold mx-auto h-18 w-18 rounded-full object-cover"
      />
      <h1 className="text-gold-gradient font-display mt-4 text-2xl font-semibold">Notícias Recentes</h1>
      <div className="rule-gold my-5" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Você não pertence a nenhuma gang.
      </p>
      <div className="mt-6 text-left"><NoticiasRecentes limite={3} /></div>
      <Button variant="outline" className="mt-6" asChild>
        <a href="/api/public/auth/logout">Sair</a>
      </Button>
    </CenteredCard>
  );
}

function SemGangScreen() {
  return (
    <CenteredCard>
      <h1 className="text-gold-gradient font-display text-2xl font-semibold">Escolha uma gang</h1>
      <div className="rule-gold my-5" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Sua sessão ainda não está vinculada a nenhuma gang. Selecione qual servidor você quer
        administrar.
      </p>
      <Button className="mt-6" asChild>
        <Link to="/selecionar-gang">Selecionar gang</Link>
      </Button>
    </CenteredCard>
  );
}

export function DashboardShell({
  children,
  permitirSemGang = false,
}: {
  children: ReactNode;
  permitirSemGang?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data, isPending } = useQuery(sessionQuery);
  const search = useRouterState({ select: (s) => s.location.search }) as { erro?: string };

  useEffect(() => {
    const abrirDrawerNaPrevia =
      import.meta.env.DEV && new URLSearchParams(window.location.search).get("previewDrawer") === "open";
    if (abrirDrawerNaPrevia) setOpen(true);
  }, []);

  if (isPending) {
    return (
      <div className="washi min-h-screen p-8">
        <div className="relative z-10 mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.configurado) return <SetupScreen faltando={data?.faltando ?? []} />;
  if (!data.user) return <LoginScreen erro={search?.erro} />;
  if (!data.permitido) return <BlockedScreen user={data.user} />;
  if (data.gangId == null && !(permitirSemGang && data.user.isSuperOwner)) return <SemGangScreen />;

  const user = data.user;

  return (
    <div className="washi min-h-screen">
      <div className="relative z-10 flex w-full">
        <aside
          className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar bg-cover bg-center bg-no-repeat px-4 py-2 lg:flex relative"
          style={{ backgroundImage: `url(${sidebarBgAsset.url})` }}
        >
          <div className="absolute inset-0 bg-sidebar/70 pointer-events-none" />
          <div className="relative z-10 flex h-full flex-col">
            <SidebarBody user={user} gangNome={data.gangNome} gangId={data.gangId} />
          </div>
        </aside>

        <div
          className="relative min-w-0 flex-1 bg-cover bg-center bg-no-repeat bg-scroll lg:bg-fixed"
          style={{ backgroundImage: `url(${mainBgAsset.url})` }}
        >
          <div className="absolute inset-0 bg-background/55 pointer-events-none" />
          <div className="relative z-10">
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Abrir menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="z-50 w-[88vw] max-w-sm overflow-y-auto bg-sidebar px-4 py-2 text-sidebar-foreground"
                >
                  <img
                    src={sidebarBgAsset.url}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
                  />
                  <div className="relative z-10 flex min-h-full flex-col">
                    <SheetTitle className="sr-only">Navegação</SheetTitle>
                    <SidebarBody
                      user={user}
                      gangNome={data.gangNome}
                      gangId={data.gangId}
                      onNavigate={() => setOpen(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <span className="text-gold-gradient font-display text-lg font-semibold">Hakuryū</span>
            </div>

            <main className="px-4 py-6 sm:px-8 sm:py-10">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
