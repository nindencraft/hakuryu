import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Send } from "lucide-react";
import { useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { CampoImagemR2 } from "@/components/hakuryu/CampoImagemR2";
import { EmptyState, GoldRule, PageTitle } from "@/components/hakuryu/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicarDivulgacaoAdmin } from "@/lib/admin.functions";
import type { ResultadoDivulgacao } from "@/lib/divulgacao.server";
import { URL_SITE_HAKURYU } from "@/lib/divulgacao";
import { sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/divulgacao")({
  head: () => ({
    meta: [
      { title: "Divulgação global — Hakuryū Dashboard" },
      {
        name: "description",
        content: "Área do Super Owner para divulgar o Hakuryū nos canais configurados das gangs.",
      },
    ],
  }),
  component: DivulgacaoPage,
});

function DivulgacaoPage() {
  return (
    <DashboardShell permitirSemGang>
      <Divulgacao />
    </DashboardShell>
  );
}

function Divulgacao() {
  const sessao = useQuery(sessionQuery);
  const [imagemUrl, setImagemUrl] = useState("");
  const [relatorio, setRelatorio] = useState<ResultadoDivulgacao | null>(null);

  const publicar = useMutation({
    mutationFn: (url: string) => publicarDivulgacaoAdmin({ data: { imagemUrl: url } }),
    onSuccess: (resultado) => setRelatorio(resultado),
  });

  if (sessao.data && sessao.data.user && !sessao.data.user.isSuperOwner) {
    return (
      <EmptyState
        title="Área restrita"
        description="Somente o Super Owner pode publicar divulgações globais."
      />
    );
  }

  return (
    <>
      <PageTitle
        kanji="宣伝"
        title="Divulgação global"
        subtitle="Envie uma imagem para todos os canais de divulgação configurados pelas gangs."
      />

      <section className="card-gold grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl">Nova divulgação</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A publicação incluirá automaticamente o convite permanente do Discord Hakuryū e o link
              do site <span className="font-medium text-foreground">{URL_SITE_HAKURYU}</span>.
            </p>
          </div>
          <GoldRule />
          <CampoImagemR2
            id="imagem-divulgacao"
            label="Imagem de divulgação"
            pasta="banners"
            value={imagemUrl}
            onChange={setImagemUrl}
            descricao="A imagem será enviada ao armazenamento permanente e publicada no Discord por uma URL pública estável."
          />
          {publicar.error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {publicar.error.message}
            </p>
          ) : null}
          <Button
            disabled={!imagemUrl.trim() || publicar.isPending}
            onClick={() => publicar.mutate(imagemUrl)}
          >
            <Send className="h-4 w-4" />
            {publicar.isPending ? "Publicando..." : "Publicar em todas as gangs"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-muted/40">
          {imagemUrl.trim() ? (
            <img
              src={imagemUrl}
              alt="Prévia da imagem de divulgação"
              className="aspect-video h-full min-h-48 w-full object-cover"
            />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
              <ImagePlus className="h-7 w-7 text-primary" />A prévia da imagem aparecerá aqui.
            </div>
          )}
        </div>
      </section>

      {relatorio ? (
        <section className="mt-5 card-gold p-5" aria-live="polite">
          <h2 className="font-display text-xl">Resultado da publicação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {relatorio.enviados.length} enviado(s), {relatorio.ignorados.length} ignorado(s) e{" "}
            {relatorio.falhas.length} falha(s).
          </p>
          <GoldRule className="my-4" />
          <div className="grid gap-4 md:grid-cols-3">
            <ResultadoLista
              titulo="Enviados"
              itens={relatorio.enviados.map((gang) => ({ gang }))}
              sucesso
            />
            <ResultadoLista titulo="Ignorados" itens={relatorio.ignorados} />
            <ResultadoLista titulo="Falhas" itens={relatorio.falhas} falha />
          </div>
        </section>
      ) : null}
    </>
  );
}

function ResultadoLista({
  titulo,
  itens,
  sucesso = false,
  falha = false,
}: {
  titulo: string;
  itens: { gang: string; motivo?: string }[];
  sucesso?: boolean;
  falha?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item) => (
            <li
              key={`${titulo}-${item.gang}`}
              className="rounded-md border border-border bg-background/70 p-2"
            >
              <div className="flex items-center gap-2">
                <Badge variant={falha ? "destructive" : sucesso ? "default" : "outline"}>
                  {item.gang}
                </Badge>
              </div>
              {item.motivo ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.motivo}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
