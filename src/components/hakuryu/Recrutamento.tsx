import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Megaphone, Pencil, Plus, Save, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";

import { useAcao } from "@/components/hakuryu/hooks";
import { CampoImagemR2 } from "@/components/hakuryu/CampoImagemR2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { podeExcluirRecrutamentoPublico } from "@/lib/exclusao-publicacoes";
import { podeGerenciarRecrutamento } from "@/lib/permissions";
import { excluirRecrutamento, fetchMeuRecrutamento, salvarMeuRecrutamento } from "@/lib/recrutamento.functions";
import type { EntradaRecrutamentoGang } from "@/lib/recrutamento";
import type { RecrutamentoGang } from "@/lib/recrutamento.server";
import { sessionQuery } from "@/lib/queries";

function formularioVazio(): EntradaRecrutamentoGang {
  return { imagemUrl: "", descricao: "", linkServidorManual: "", ativo: true };
}

function formularioDo(recrutamento: RecrutamentoGang): EntradaRecrutamentoGang {
  return {
    imagemUrl: recrutamento.imagemUrl,
    descricao: recrutamento.descricao,
    linkServidorManual: recrutamento.linkServidorManual ?? "",
    ativo: recrutamento.ativo,
  };
}

export function VitrineRecrutamento({ recrutamentos }: { recrutamentos: RecrutamentoGang[] }) {
  const sessao = useQuery(sessionQuery);
  const remover = useAcao<{ gangId: number }>(excluirRecrutamento, {
    sucesso: "Recrutamento removido.",
    invalidar: [["recrutamentos-publicos"], ["meu-recrutamento"]],
  });
  if (recrutamentos.length === 0) {
    return (
      <div className="card-gold border-dashed bg-white/70 p-8 text-center">
        <UsersRound className="mx-auto h-8 w-8 text-primary" />
        <p className="font-display mt-3 text-xl text-foreground">Nenhuma gang recrutando por enquanto</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando uma liderança ativar o anúncio da gang, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {recrutamentos.map((recrutamento) => (
        <article key={recrutamento.gangId} className="card-gold relative overflow-hidden bg-white/95 p-0">
          {podeExcluirRecrutamentoPublico({
            gangId: sessao.data?.gangId,
            isSuperOwner: sessao.data?.user?.isSuperOwner,
            podeGerenciarRecrutamento: podeGerenciarRecrutamento(sessao.data?.user ?? null),
          }, recrutamento.gangId) ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="icon" variant="destructive" className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full shadow-md" aria-label={`Excluir recrutamento de ${recrutamento.gangNome}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Excluir recrutamento?</AlertDialogTitle><AlertDialogDescription>Essa ação remove o card público e o banner salvo permanentemente. A gang poderá criar outro anúncio depois.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remover.mutate({ gangId: recrutamento.gangId })}>Excluir</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <img
            src={recrutamento.imagemUrl}
            alt={`Banner de recrutamento da gang ${recrutamento.gangNome}`}
            className="aspect-[7/3] w-full object-cover"
          />
          <div className="space-y-3 p-4 sm:p-5">
            <Badge variant="outline" className="border-primary/35">Recrutamento aberto</Badge>
            <h2 className="font-display text-2xl text-foreground">{recrutamento.gangNome}</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {recrutamento.descricao}
            </p>
            <Button className="w-full" asChild>
              <a href={recrutamento.discordUrl} target="_blank" rel="noreferrer">
                Entrar no Discord <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function GestorMeuRecrutamento() {
  const sessao = useQuery(sessionQuery);
  const podeGerenciar = podeGerenciarRecrutamento(sessao.data?.user ?? null);
  const meu = useQuery({
    queryKey: ["meu-recrutamento", sessao.data?.gangId],
    queryFn: () => fetchMeuRecrutamento(),
    enabled: Boolean(sessao.data?.user && sessao.data.gangId && podeGerenciar),
  });
  const [aberto, setAberto] = useState(false);
  const [formulario, setFormulario] = useState<EntradaRecrutamentoGang>(formularioVazio);
  const salvar = useAcao<EntradaRecrutamentoGang>(salvarMeuRecrutamento, {
    sucesso: "Anúncio de recrutamento salvo.",
    invalidar: [["recrutamentos-publicos"], ["meu-recrutamento"]],
    aoConcluir: () => setAberto(false),
  });

  if (!sessao.data?.gangId || !podeGerenciar) return null;
  if (meu.isPending) return <Skeleton className="h-28 w-full" />;
  if (meu.error) {
    return (
      <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Não foi possível carregar o anúncio da sua gang: {meu.error.message}
      </div>
    );
  }

  const recrutamento = meu.data;
  const abrirEditor = () => {
    setFormulario(recrutamento ? formularioDo(recrutamento) : formularioVazio());
    setAberto(true);
  };

  return (
    <>
      <section className="card-gold flex flex-col gap-4 bg-white/88 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl text-foreground">Recrutamento da sua gang</h2>
            {recrutamento ? (
              <Badge variant={recrutamento.ativo ? "default" : "outline"}>
                {recrutamento.ativo ? "Publicado" : "Pausado"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {recrutamento
              ? "Edite o banner, a descrição, o status e, se necessário, o link do servidor."
              : "Crie o único anúncio público da sua gang. Você poderá pausá-lo e editá-lo depois."}
          </p>
        </div>
        <Button type="button" onClick={abrirEditor}>
          {recrutamento ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {recrutamento ? "Editar anúncio" : "Criar anúncio"}
        </Button>
      </section>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{recrutamento ? "Editar recrutamento" : "Criar recrutamento"}</DialogTitle>
            <DialogDescription>
              Há um único anúncio por gang. Com o link manual em branco, o bot cria ou reutiliza um
              convite infinito quando você salvar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={formulario.ativo}
                onChange={(event) => setFormulario({ ...formulario, ativo: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Exibir este recrutamento publicamente
            </label>
            <CampoImagemR2
              id="recrutamento-imagem"
              label="Banner de recrutamento"
              pasta="banners"
              finalidade="recrutamento"
              value={formulario.imagemUrl}
              onChange={(imagemUrl) => setFormulario({ ...formulario, imagemUrl })}
              descricao="Recomendado: 2400 × 1029 px, na proporção 7:3. A imagem será otimizada e salva permanentemente."
            />
            <div className="space-y-2">
              <Label htmlFor="recrutamento-descricao">Descrição</Label>
              <Textarea
                id="recrutamento-descricao"
                rows={5}
                maxLength={500}
                value={formulario.descricao}
                onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })}
                placeholder="Apresente a identidade da gang, o estilo de jogo e o que procura em novos membros."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recrutamento-link-manual">Link do servidor (opcional)</Label>
              <Input
                id="recrutamento-link-manual"
                type="url"
                value={formulario.linkServidorManual}
                onChange={(event) => setFormulario({ ...formulario, linkServidorManual: event.target.value })}
                placeholder="https://discord.gg/seu-servidor"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Use este campo somente se quiser substituir o convite automático por outro link. Deixe
                vazio para o bot gerar ou reutilizar o convite infinito da gang.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={salvar.isPending || !formulario.imagemUrl.trim() || !formulario.descricao.trim()}
              onClick={() => salvar.mutate(formulario)}
            >
              <Save className="h-4 w-4" /> {salvar.isPending ? "Salvando..." : "Salvar anúncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
