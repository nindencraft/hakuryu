import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";

import { DashboardShell } from "@/components/hakuryu/DashboardShell";
import { EmptyState, PageTitle } from "@/components/hakuryu/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adicionarJornalistaAdmin,
  adicionarWarnJornalistaAdmin,
  fetchJornalistasAdmin,
  removerJornalistaAdmin,
  removerWarnJornalistaAdmin,
  type JornalistaAdmin,
} from "@/lib/jornal.functions";
import { sessionQuery } from "@/lib/queries";

const dataCurta = (valor: string) => new Date(valor).toLocaleDateString("pt-BR");

export const Route = createFileRoute("/admin/jornalistas")({ component: JornalistasPage });

function JornalistasPage() {
  return (
    <DashboardShell permitirSemGang>
      <JornalistasAdmin />
    </DashboardShell>
  );
}

function WarnDialog({ jornalista }: { jornalista: JornalistaAdmin }) {
  const client = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [aberto, setAberto] = useState(false);
  const warn = useMutation({
    mutationFn: () => adicionarWarnJornalistaAdmin({ data: { jornalistaId: jornalista.discordId, motivo } }),
    onSuccess: async () => {
      setMotivo("");
      setAberto(false);
      await client.invalidateQueries({ queryKey: ["admin-jornalistas"] });
    },
  });
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><AlertTriangle className="h-4 w-4" /> Dar aviso</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar aviso a {jornalista.globalName || jornalista.username}</DialogTitle><DialogDescription>O motivo ficará registrado no histórico do jornalista.</DialogDescription></DialogHeader>
        <Label htmlFor={`motivo-${jornalista.discordId}`}>Motivo</Label>
        <Textarea id={`motivo-${jornalista.discordId}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} placeholder="Descreva o motivo do aviso..." />
        {warn.error ? <p className="text-sm text-destructive">{warn.error.message}</p> : null}
        <Button disabled={warn.isPending || motivo.trim().length < 3} onClick={() => warn.mutate()}>{warn.isPending ? "Salvando..." : "Confirmar aviso"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoJornalista({ jornalista }: { jornalista: JornalistaAdmin }) {
  const client = useQueryClient();
  const removerWarn = useMutation({
    mutationFn: (warnId: number) => removerWarnJornalistaAdmin({ data: { warnId } }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["admin-jornalistas"] }),
  });
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="sm"><History className="h-4 w-4" /> Histórico</Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Atividade de {jornalista.globalName || jornalista.username}</DialogTitle><DialogDescription>{jornalista.quantidadeNoticias} notícias e {jornalista.quantidadeWarns} aviso(s) ativo(s).</DialogDescription></DialogHeader>
        <section className="space-y-2"><h3 className="font-semibold">Reportagens enviadas</h3>{jornalista.noticias.length ? jornalista.noticias.map((noticia) => <div key={noticia.id} className="rounded-md border border-border p-3 text-sm"><p className="font-medium">{noticia.titulo}</p><p className="text-xs text-muted-foreground">{dataCurta(noticia.publicadaEm)}</p></div>) : <p className="text-sm text-muted-foreground">Nenhuma reportagem enviada.</p>}</section>
        <section className="mt-5 space-y-2"><h3 className="font-semibold">Histórico de avisos</h3>{jornalista.warns.length ? jornalista.warns.map((warn) => <div key={warn.id} className="rounded-md border border-border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p>{warn.motivo}</p><p className="mt-1 text-xs text-muted-foreground">{dataCurta(warn.criadoEm)} · por {warn.criadoPor}{warn.revogadoEm ? ` · removido em ${dataCurta(warn.revogadoEm)}` : ""}</p></div>{!warn.revogadoEm ? <Button variant="ghost" size="sm" disabled={removerWarn.isPending} onClick={() => removerWarn.mutate(warn.id)}><Trash2 className="h-4 w-4" /> Remover</Button> : <Badge variant="outline">Removido</Badge>}</div></div>) : <p className="text-sm text-muted-foreground">Nenhum aviso registrado.</p>}</section>
      </DialogContent>
    </Dialog>
  );
}

function JornalistasAdmin() {
  const sessao = useQuery(sessionQuery);
  const client = useQueryClient();
  const [discordId, setDiscordId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const jornalistas = useQuery({ queryKey: ["admin-jornalistas"], queryFn: () => fetchJornalistasAdmin(), enabled: sessao.data?.user?.isSuperOwner === true });
  const adicionar = useMutation({ mutationFn: () => adicionarJornalistaAdmin({ data: { discordId } }), onSuccess: async () => { setDiscordId(""); setErro(null); await client.invalidateQueries({ queryKey: ["admin-jornalistas"] }); }, onError: (e: Error) => setErro(e.message) });
  const remover = useMutation({ mutationFn: (id: string) => removerJornalistaAdmin({ data: { discordId: id } }), onSuccess: async () => client.invalidateQueries({ queryKey: ["admin-jornalistas"] }), onError: (e: Error) => setErro(e.message) });

  if (sessao.data?.user && !sessao.data.user.isSuperOwner) return <EmptyState title="Área restrita" description="Somente o Super Owner pode administrar jornalistas." />;
  return <><PageTitle kanji="新聞" title="Jornalistas" subtitle="Cadastre a equipe de jornal, acompanhe reportagens e administre avisos." />
    <section className="card-gold p-5"><h2 className="font-display text-xl">Adicionar jornalista</h2><p className="mt-1 text-sm text-muted-foreground">Informe o ID do Discord. O painel consultará o nome e a foto da pessoa.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><Label htmlFor="discord-jornalista" className="sr-only">ID do Discord</Label><Input id="discord-jornalista" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="ID do Discord" /></div><Button disabled={adicionar.isPending || !discordId.trim()} onClick={() => adicionar.mutate()}><UserPlus className="h-4 w-4" /> {adicionar.isPending ? "Adicionando..." : "Adicionar"}</Button></div>{erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}</section>
    <section className="mt-7"><h2 className="font-display mb-4 text-2xl">Equipe de jornal</h2>{jornalistas.isPending ? <p className="text-sm text-muted-foreground">Carregando jornalistas...</p> : jornalistas.error ? <EmptyState title="Erro ao carregar jornalistas" description={jornalistas.error.message} /> : (jornalistas.data ?? []).length === 0 ? <EmptyState title="Nenhum jornalista cadastrado" description="Adicione o primeiro jornalista usando o ID do Discord." /> : <div className="space-y-4">{(jornalistas.data ?? []).map((jornalista) => <article key={jornalista.discordId} className="card-gold flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{jornalista.avatarUrl ? <img src={jornalista.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" /> : <UserPlus className="h-14 w-14 rounded-full border p-4" />}<div className="min-w-0"><p className="truncate font-display text-lg">{jornalista.globalName || jornalista.username}</p><p className="truncate text-xs text-muted-foreground">@{jornalista.username} · {jornalista.discordId}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant={jornalista.ativo ? "default" : "outline"}>{jornalista.ativo ? "Ativo" : "Removido"}</Badge><Badge variant="outline">{jornalista.quantidadeNoticias} notícias</Badge><Badge variant={jornalista.quantidadeWarns ? "destructive" : "outline"}>{jornalista.quantidadeWarns} avisos</Badge></div></div></div><div className="flex flex-wrap gap-2">{jornalista.ativo ? <><WarnDialog jornalista={jornalista} /><Button variant="destructive" size="sm" disabled={remover.isPending} onClick={() => remover.mutate(jornalista.discordId)}><UserMinus className="h-4 w-4" /> Remover</Button></> : null}<HistoricoJornalista jornalista={jornalista} /></div></article>)}</div>}</section>
  </>;
}
