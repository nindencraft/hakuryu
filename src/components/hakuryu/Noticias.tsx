import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Newspaper, PenLine, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/hakuryu/ui-bits";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  editarNoticia,
  excluirNoticia,
  fetchNoticiasPublicas,
  fetchPermissaoJornal,
  publicarNoticia,
  type NoticiaPublica,
} from "@/lib/jornal.functions";

function formatarData(valor: string) {
  return new Date(valor).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function DetalhesNoticia({ noticia }: { noticia: NoticiaPublica }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{noticia.titulo}</DialogTitle>
          <DialogDescription>{formatarData(noticia.publicadaEm)}</DialogDescription>
        </DialogHeader>
        <img
          src={noticia.imagemUrl}
          alt={`Imagem principal da notícia ${noticia.titulo}`}
          className="mt-2 aspect-video w-full rounded-md border border-border object-cover"
        />
        <div className="flex items-center gap-3 rounded-md bg-muted/55 p-3">
          {noticia.autor.avatarUrl ? (
            <img src={noticia.autor.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <UserRound className="h-10 w-10 rounded-full border p-2 text-muted-foreground" />
          )}
          <div>
            <p className="text-xs text-muted-foreground">Reportagem de</p>
            <p className="text-sm font-semibold">{noticia.autor.nome}</p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{noticia.descricao}</p>
      </DialogContent>
    </Dialog>
  );
}

export function CriarNoticiaDialog() {
  const client = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const publicar = useMutation({
    mutationFn: () => publicarNoticia({ data: { titulo, imagemUrl, descricao } }),
    onSuccess: async () => {
      setTitulo("");
      setImagemUrl("");
      setDescricao("");
      setErro(null);
      setAberto(false);
      await client.invalidateQueries({ queryKey: ["noticias-publicas"] });
    },
    onError: (error: Error) => setErro(error.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <PenLine className="h-4 w-4" /> Criar notícia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nova reportagem</DialogTitle>
          <DialogDescription>
            O título fica no histórico. A imagem é o destaque principal no mural de notícias.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo-noticia">Título</Label>
            <Input id="titulo-noticia" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da reportagem" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imagem-noticia">URL da imagem principal</Label>
            <Input id="imagem-noticia" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao-noticia">Descrição do acontecimento</Label>
            <Textarea id="descricao-noticia" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={7} placeholder="Descreva o que aconteceu..." />
          </div>
          {erro ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p> : null}
          <Button className="w-full" disabled={publicar.isPending || !titulo.trim() || !imagemUrl.trim() || !descricao.trim()} onClick={() => publicar.mutate()}>
            {publicar.isPending ? "Publicando..." : "Publicar notícia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditarNoticiaDialog({ noticia }: { noticia: NoticiaPublica }) {
  const client = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(noticia.titulo);
  const [imagemUrl, setImagemUrl] = useState(noticia.imagemUrl);
  const [descricao, setDescricao] = useState(noticia.descricao);
  const [erro, setErro] = useState<string | null>(null);

  const editar = useMutation({
    mutationFn: () => editarNoticia({ data: { id: noticia.id, titulo, imagemUrl, descricao } }),
    onSuccess: async () => {
      setErro(null);
      setAberto(false);
      await client.invalidateQueries({ queryKey: ["noticias-publicas"] });
    },
    onError: (error: Error) => setErro(error.message),
  });

  function mudarAbertura(valor: boolean) {
    if (valor) {
      setTitulo(noticia.titulo);
      setImagemUrl(noticia.imagemUrl);
      setDescricao(noticia.descricao);
      setErro(null);
    }
    setAberto(valor);
  }

  return (
    <Dialog open={aberto} onOpenChange={mudarAbertura}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PenLine className="h-4 w-4" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Editar reportagem</DialogTitle>
          <DialogDescription>Atualize os dados da sua reportagem publicada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`editar-titulo-${noticia.id}`}>Título</Label>
            <Input id={`editar-titulo-${noticia.id}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`editar-imagem-${noticia.id}`}>URL da imagem principal</Label>
            <Input id={`editar-imagem-${noticia.id}`} value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`editar-descricao-${noticia.id}`}>Descrição do acontecimento</Label>
            <Textarea id={`editar-descricao-${noticia.id}`} value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={7} />
          </div>
          {erro ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p> : null}
          <Button className="w-full" disabled={editar.isPending || !titulo.trim() || !imagemUrl.trim() || !descricao.trim()} onClick={() => editar.mutate()}>
            {editar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirNoticiaButton({ noticia }: { noticia: NoticiaPublica }) {
  const client = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const excluir = useMutation({
    mutationFn: () => excluirNoticia({ data: { id: noticia.id } }),
    onSuccess: async () => {
      setErro(null);
      setAberto(false);
      await client.invalidateQueries({ queryKey: ["noticias-publicas"] });
    },
    onError: (error: Error) => setErro(error.message),
  });

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <Button variant="destructive" size="sm" onClick={() => setAberto(true)}>
        <Trash2 className="h-4 w-4" /> Excluir
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir reportagem?</AlertDialogTitle>
          <AlertDialogDescription>
            A reportagem “{noticia.titulo}” será apagada de forma definitiva. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erro ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={excluir.isPending}
            onClick={(event) => {
              event.preventDefault();
              excluir.mutate();
            }}
          >
            {excluir.isPending ? "Excluindo..." : "Excluir reportagem"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NoticiasRecentes({ permitirCriar = false, limite }: { permitirCriar?: boolean; limite?: number }) {
  const noticias = useQuery({ queryKey: ["noticias-publicas"], queryFn: () => fetchNoticiasPublicas(), staleTime: 30_000 });
  const permissao = useQuery({ queryKey: ["permissao-jornal"], queryFn: () => fetchPermissaoJornal(), enabled: permitirCriar });
  const itens = limite ? (noticias.data ?? []).slice(0, limite) : (noticias.data ?? []);

  return (
    <section aria-labelledby="noticias-recentes">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-jp text-xs text-primary">新聞</p>
          <h2 id="noticias-recentes" className="font-display text-2xl">Notícias Recentes</h2>
        </div>
        {permitirCriar && permissao.data?.podePublicar ? <CriarNoticiaDialog /> : null}
      </div>
      {noticias.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : noticias.error ? (
        <EmptyState title="Não foi possível carregar as notícias" description={noticias.error.message} />
      ) : itens.length === 0 ? (
        <EmptyState title="Nenhuma notícia publicada" description="Quando uma reportagem for publicada, ela aparecerá aqui." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((noticia) => (
            <article key={noticia.id} className="card-gold overflow-hidden">
              <img src={noticia.imagemUrl} alt={`Imagem principal de ${noticia.titulo}`} className="aspect-video w-full object-cover" />
              <div className="space-y-3 p-4">
                <p className="line-clamp-2 font-display text-lg leading-tight">{noticia.titulo}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {noticia.autor.avatarUrl ? <img src={noticia.autor.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <Newspaper className="h-8 w-8 rounded-full border p-1.5" />}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{noticia.autor.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{formatarData(noticia.publicadaEm)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <DetalhesNoticia noticia={noticia} />
                    {permissao.data?.isSuperOwner ||
                    (permissao.data?.jornalistaAtivo && permissao.data.usuarioDiscordId === noticia.autor.discordId) ? (
                      <EditarNoticiaDialog noticia={noticia} />
                    ) : null}
                    {permissao.data?.isSuperOwner ? <ExcluirNoticiaButton noticia={noticia} /> : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
