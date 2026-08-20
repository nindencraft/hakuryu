import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";

import bgAsset from "@/assets/hakuryu-bg.png.asset.json";
import logo from "@/assets/hakuryu-logo.png";
import mainBgAsset from "@/assets/hakuryu-main-bg.png.asset.json";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { acaoPainelHome } from "@/lib/home-hub";
import type { SessionUserView } from "@/lib/permissions";

type AbaHub = "inicio" | "noticias" | "recrutamento" | "explorar";

export function FundoHub({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-scroll lg:bg-fixed"
      style={{ backgroundImage: `url(${mainBgAsset.url})` }}
    >
      <div className="min-h-screen bg-background/62">{children}</div>
    </div>
  );
}

export function TelaHubCarregando() {
  return (
    <FundoHub>
      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </FundoHub>
  );
}

export function TelaHubLogin({ erro }: { erro?: string }) {
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
          Entre com Discord para explorar a comunidade Hakuryū.
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

export function CabecalhoHub({
  usuario,
  permitido,
  quantidadeDeGangs,
  abaAtiva,
  permitirSair = false,
}: {
  usuario: SessionUserView;
  permitido: boolean;
  quantidadeDeGangs: number;
  abaAtiva: AbaHub;
  permitirSair?: boolean;
}) {
  const classeAba = (aba: AbaHub) =>
    abaAtiva === aba ? "bg-primary/12 text-primary hover:bg-primary/16" : "text-muted-foreground";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="Hakuryū" className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-gold-gradient font-display text-xl font-semibold leading-tight">Hakuryū</p>
            <p className="font-jp text-[10px] text-muted-foreground">白竜 · Community Hub</p>
          </div>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto sm:flex-1 sm:justify-center" aria-label="Navegação do hub">
          <LinkPainel permitido={permitido} quantidadeDeGangs={quantidadeDeGangs} />
          <Button variant="ghost" size="sm" className={classeAba("noticias")} asChild>
            <Link to="/noticias" aria-current={abaAtiva === "noticias" ? "page" : undefined}>
              Notícias
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className={classeAba("recrutamento")} asChild>
            <Link to="/recrutamento" aria-current={abaAtiva === "recrutamento" ? "page" : undefined}>
              Recrutamento
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className={classeAba("explorar")} asChild>
            <Link to="/explorar" aria-current={abaAtiva === "explorar" ? "page" : undefined}>
              Explorar
            </Link>
          </Button>
        </nav>

        <div className="order-2 ml-auto flex min-w-0 items-center gap-2 sm:order-3">
          <img
            src={usuario.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full border border-primary/35 object-cover"
          />
          <div className="hidden min-w-0 lg:block">
            <p className="max-w-32 truncate text-sm font-semibold">
              {usuario.globalName ?? usuario.username}
            </p>
            <p className="max-w-32 truncate text-xs text-muted-foreground">@{usuario.username}</p>
          </div>
          {permitirSair ? (
            <Button variant="ghost" size="icon" asChild>
              <a href="/api/public/auth/logout" aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
