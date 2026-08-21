import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, FilePlus2, Pause, Search, Send, ShieldCheck, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

import { formatarData, useAcao } from "@/components/hakuryu/hooks";
import { CampoImagemR2 } from "@/components/hakuryu/CampoImagemR2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { EntradaServidorExplorador } from "@/lib/explorador";
import type { ServidorExplorador } from "@/lib/explorador.server";
import {
  fetchMeuServidorExplorador,
  excluirServidorExploradorAdmin,
  moderarServidorExplorador,
  salvarMeuServidorExplorador,
} from "@/lib/explorador.functions";
import { meuServidorExploradorQuery, servidoresExploradorAdminQuery, sessionQuery } from "@/lib/queries";

const categorias = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "roleplay", rotulo: "Roleplays" },
  { valor: "comunidade", rotulo: "Comunidades" },
] as const;

function formularioVazio(): EntradaServidorExplorador {
  return { categoria: "roleplay", titulo: "", descricao: "", imagemUrl: "", discordUrl: "", etiquetas: [], solicitarPublicacao: true };
}

function formularioDe(servidor: ServidorExplorador): EntradaServidorExplorador {
  return {
    categoria: servidor.categoria,
    titulo: servidor.titulo,
    descricao: servidor.descricao,
    imagemUrl: servidor.imagemUrl,
    discordUrl: servidor.discordUrl,
    etiquetas: servidor.etiquetas,
    solicitarPublicacao: servidor.status !== "pausado",
  };
}

function statusLabel(status: ServidorExplorador["status"]) {
  return ({ pendente: "Em análise", aprovado: "Publicado", pausado: "Pausado", recusado: "Recusado" } as const)[status];
}

function categoriaLabel(categoria: ServidorExplorador["categoria"]) {
  return categoria === "roleplay" ? "Roleplay" : "Comunidade";
}

export function VitrineExplorador({ servidores }: { servidores: ServidorExplorador[] }) {
  const [categoria, setCategoria] = useState<(typeof categorias)[number]["valor"]>("todos");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<ServidorExplorador | null>(null);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return servidores.filter((servidor) => {
      const categoriaCompativel = categoria === "todos" || servidor.categoria === categoria;
      if (!categoriaCompativel) return false;
      if (!termo) return true;
      return [servidor.titulo, servidor.descricao, ...servidor.etiquetas].join(" ").toLocaleLowerCase("pt-BR").includes(termo);
    });
  }, [busca, categoria, servidores]);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap gap-2">
          {categorias.map((item) => (
            <Button key={item.valor} size="sm" variant={categoria === item.valor ? "default" : "outline"} onClick={() => setCategoria(item.valor)}>
              {item.rotulo}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome ou etiqueta" />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="card-gold border-dashed bg-white/70 p-9 text-center">
          <Search className="mx-auto h-8 w-8 text-primary" />
          <h2 className="font-display mt-3 text-xl">Nenhum servidor encontrado</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tente outra categoria, etiqueta ou palavra-chave.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((servidor) => (
            <article key={servidor.id} className="card-gold flex overflow-hidden bg-white/95 p-0">
              <div className="flex w-full flex-col">
                <img src={servidor.imagemUrl} alt={`Banner do servidor ${servidor.titulo}`} className="aspect-[7/3] w-full object-cover" />
                <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/35">{categoriaLabel(servidor.categoria)}</Badge>
                    {servidor.etiquetas.slice(0, 2).map((etiqueta) => <Badge key={etiqueta} variant="secondary">{etiqueta}</Badge>)}
                  </div>
                  <h2 className="font-display text-2xl text-foreground">{servidor.titulo}</h2>
                  <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{servidor.descricao}</p>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" onClick={() => setDetalhe(servidor)}>Detalhes</Button>
                    <Button asChild>
                      <a href={servidor.discordUrl} target="_blank" rel="noreferrer">Discord <ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detalhe)} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detalhe ? <>
            <img src={detalhe.imagemUrl} alt="" className="-mt-1 aspect-[7/3] w-full rounded-lg object-cover" />
            <DialogHeader>
              <div className="flex flex-wrap gap-2"><Badge variant="outline">{categoriaLabel(detalhe.categoria)}</Badge>{detalhe.etiquetas.map((etiqueta) => <Badge key={etiqueta} variant="secondary">{etiqueta}</Badge>)}</div>
              <DialogTitle className="font-display pt-2 text-3xl">{detalhe.titulo}</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap pt-2 text-sm leading-7 text-muted-foreground">{detalhe.descricao}</DialogDescription>
            </DialogHeader>
            <DialogFooter><Button asChild><a href={detalhe.discordUrl} target="_blank" rel="noreferrer">Entrar no Discord <ExternalLink className="h-4 w-4" /></a></Button></DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GestorMeuServidorExplorador() {
  const sessao = useQuery(sessionQuery);
  const meu = useQuery({ ...meuServidorExploradorQuery, enabled: Boolean(sessao.data?.user) });
  const [aberto, setAberto] = useState(false);
  const [formulario, setFormulario] = useState<EntradaServidorExplorador>(formularioVazio);
  const salvar = useAcao<EntradaServidorExplorador>(salvarMeuServidorExplorador, {
    sucesso: "Servidor enviado para análise.",
    invalidar: [["meu-servidor-explorador"], ["servidores-explorador-publicos"], ["servidores-explorador-admin"]],
    aoConcluir: () => setAberto(false),
  });
  const servidor = meu.data;
  const abrir = () => { setFormulario(servidor ? formularioDe(servidor) : formularioVazio()); setAberto(true); };

  return (
    <>
      <section className="card-gold flex flex-col gap-4 bg-white/88 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><FilePlus2 className="h-5 w-5 text-primary" /><h2 className="font-display text-xl">Seu servidor no Explorador</h2>{servidor ? <Badge variant={servidor.status === "aprovado" ? "default" : "outline"}>{statusLabel(servidor.status)}</Badge> : null}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{servidor ? "Edite os dados, pause a publicação ou reenvie seu servidor para análise." : "Envie um Roleplay ou uma Comunidade para análise da administração Hakuryū."}</p>
          {servidor?.motivoModeracao ? <p className="mt-2 text-xs leading-5 text-destructive">Retorno da moderação: {servidor.motivoModeracao}</p> : null}
        </div>
        <Button onClick={abrir} disabled={meu.isPending}>{servidor ? "Editar servidor" : "Enviar servidor"}</Button>
      </section>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{servidor ? "Editar servidor" : "Enviar servidor ao Explorador"}</DialogTitle><DialogDescription>Você pode manter um servidor. Os dados enviados ficam pendentes até a aprovação do Super Owner.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="explorador-categoria">Categoria</Label><select id="explorador-categoria" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formulario.categoria} onChange={(event) => setFormulario({ ...formulario, categoria: event.target.value as EntradaServidorExplorador["categoria"] })}><option value="roleplay">Roleplay</option><option value="comunidade">Comunidade</option></select></div>
            <div className="space-y-2"><Label htmlFor="explorador-titulo">Nome do servidor</Label><Input id="explorador-titulo" maxLength={100} value={formulario.titulo} onChange={(event) => setFormulario({ ...formulario, titulo: event.target.value })} placeholder="Nome exibido no Explorador" /></div>
            <CampoImagemR2
              id="explorador-imagem"
              label="Banner do servidor"
              pasta="banners"
              finalidade="explorador"
              value={formulario.imagemUrl}
              onChange={(imagemUrl) => setFormulario({ ...formulario, imagemUrl })}
              descricao="Recomendado: 2400 × 1029 px, proporção 7:3. O banner será otimizado e salvo permanentemente."
            />
            <div className="space-y-2"><Label htmlFor="explorador-discord">Convite do Discord</Label><Input id="explorador-discord" type="url" value={formulario.discordUrl} onChange={(event) => setFormulario({ ...formulario, discordUrl: event.target.value })} placeholder="https://discord.gg/seu-servidor" /></div>
            <div className="space-y-2"><Label htmlFor="explorador-etiquetas">Etiquetas</Label><Input id="explorador-etiquetas" value={formulario.etiquetas.join(", ")} onChange={(event) => setFormulario({ ...formulario, etiquetas: event.target.value.split(",") })} placeholder="Escolar, sério, gangs" /><p className="text-xs text-muted-foreground">Separe até cinco etiquetas por vírgula.</p></div>
            <div className="space-y-2"><Label htmlFor="explorador-descricao">Descrição completa</Label><Textarea id="explorador-descricao" rows={7} maxLength={1500} value={formulario.descricao} onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })} placeholder="Explique a proposta, os destaques e o tipo de comunidade que o servidor oferece." /></div>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={formulario.solicitarPublicacao} onChange={(event) => setFormulario({ ...formulario, solicitarPublicacao: event.target.checked })} className="h-4 w-4 accent-primary" />Enviar para aprovação e publicação</label>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button><Button disabled={salvar.isPending || !formulario.titulo.trim() || !formulario.descricao.trim() || !formulario.imagemUrl.trim() || !formulario.discordUrl.trim()} onClick={() => salvar.mutate(formulario)}><Send className="h-4 w-4" />{salvar.isPending ? "Enviando..." : "Salvar e enviar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ModeracaoExplorador() {
  const sessao = useQuery(sessionQuery);
  const fila = useQuery({ ...servidoresExploradorAdminQuery, enabled: Boolean(sessao.data?.user?.isSuperOwner) });
  const [motivos, setMotivos] = useState<Record<number, string>>({});
  const moderar = useAcao<{ id: number; status: "aprovado" | "pausado" | "recusado"; motivo?: string }>(moderarServidorExplorador, { sucesso: "Status do servidor atualizado.", invalidar: [["servidores-explorador-admin"], ["servidores-explorador-publicos"], ["meu-servidor-explorador"]] });
  const excluir = useAcao<{ id: number }>(excluirServidorExploradorAdmin, { sucesso: "Servidor removido do Explorador.", invalidar: [["servidores-explorador-admin"], ["servidores-explorador-publicos"]] });
  if (!sessao.data?.user?.isSuperOwner) return null;
  const pendentes = (fila.data ?? []).filter((servidor) => servidor.status === "pendente");
  return <section className="space-y-4 border-t border-primary/20 pt-8"><div><p className="font-jp text-xs tracking-[0.2em] text-primary">ADMINISTRAÇÃO</p><h2 className="font-display mt-1 text-2xl">Fila do Explorador</h2><p className="mt-1 text-sm text-muted-foreground">Aprove, pause, recuse ou remova publicações enviadas pela comunidade.</p></div>{fila.isPending ? <Skeleton className="h-40 w-full" /> : null}{!fila.isPending && pendentes.length === 0 ? <p className="rounded-xl border border-dashed border-primary/25 bg-white/65 p-5 text-sm text-muted-foreground">Nenhum servidor aguardando análise.</p> : null}<div className="grid gap-4 lg:grid-cols-2">{pendentes.map((servidor) => <article key={servidor.id} className="card-gold bg-white/90 p-5"><div className="flex gap-3"><img src={servidor.responsavelAvatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0"><h3 className="font-display text-xl">{servidor.titulo}</h3><p className="text-xs text-muted-foreground">Enviado por {servidor.responsavelNome} em {formatarData(servidor.atualizadoEm)}</p></div></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{servidor.descricao}</p><Input className="mt-4" value={motivos[servidor.id] ?? ""} onChange={(event) => setMotivos({ ...motivos, [servidor.id]: event.target.value })} placeholder="Motivo para recusar (obrigatório apenas na recusa)" /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => moderar.mutate({ id: servidor.id, status: "aprovado" })}><Check className="h-4 w-4" />Aprovar</Button><Button size="sm" variant="outline" onClick={() => moderar.mutate({ id: servidor.id, status: "pausado" })}><Pause className="h-4 w-4" />Pausar</Button><Button size="sm" variant="destructive" disabled={(motivos[servidor.id] ?? "").trim().length < 3} onClick={() => moderar.mutate({ id: servidor.id, status: "recusado", motivo: motivos[servidor.id] })}><X className="h-4 w-4" />Recusar</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate({ id: servidor.id })}>Remover</Button></div></article>)}</div></section>;
}
