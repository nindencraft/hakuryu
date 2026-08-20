import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Dumbbell, Shield, Swords, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTILOS_LUTA_RPG, GENEROS_RPG, type FichaRPGInput } from "@/lib/perfil";
import type { GangNoPerfil, PerfilJogador as PerfilJogadorData } from "@/lib/perfil.server";

const SEM_OPCAO = "__sem_opcao__";

function formatarData(valor: string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(valor));
}

function CardGang({ gang, antiga = false }: { gang: GangNoPerfil; antiga?: boolean }) {
  return (
    <Card className="border-primary/20 bg-white/85 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl text-foreground">{gang.gangNome}</p>
            <p className="mt-1 text-sm text-muted-foreground">{antiga ? "Trajetória concluída" : "Gang atual"}</p>
          </div>
          <Badge variant={antiga ? "outline" : "default"}>{gang.cargo || "Membro"}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <p><span className="block font-medium text-foreground">Entrada</span>{formatarData(gang.entrouEm)}</p>
          <p><span className="block font-medium text-foreground">{antiga ? "Saída" : "Status"}</span>{antiga ? formatarData(gang.saiuEm) : "Ativo no painel"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FichaRPGForm({
  perfil,
  aoSalvar,
  salvando,
}: {
  perfil: PerfilJogadorData;
  aoSalvar: (dados: FichaRPGInput) => void;
  salvando: boolean;
}) {
  const [dados, setDados] = useState<FichaRPGInput>({
    nome_roblox: perfil.ficha.nome_roblox ?? "",
    nome_rp: perfil.ficha.nome_rp ?? "",
    genero: perfil.ficha.genero ?? "",
    altura_jogo: perfil.ficha.altura_jogo != null ? String(perfil.ficha.altura_jogo) : "",
    estilo_luta_principal: perfil.ficha.estilo_luta_principal ?? "",
  });
  const estilosPorRaridade = useMemo(() => {
    const grupos = new Map<string, typeof ESTILOS_LUTA_RPG[number][]>();
    for (const estilo of ESTILOS_LUTA_RPG) {
      grupos.set(estilo.raridade, [...(grupos.get(estilo.raridade) ?? []), estilo]);
    }
    return Array.from(grupos.entries());
  }, []);

  useEffect(() => {
    setDados({
      nome_roblox: perfil.ficha.nome_roblox ?? "",
      nome_rp: perfil.ficha.nome_rp ?? "",
      genero: perfil.ficha.genero ?? "",
      altura_jogo: perfil.ficha.altura_jogo != null ? String(perfil.ficha.altura_jogo) : "",
      estilo_luta_principal: perfil.ficha.estilo_luta_principal ?? "",
    });
  }, [perfil.ficha]);

  const atualizar = (campo: keyof FichaRPGInput, valor: string) => {
    setDados((anterior) => ({ ...anterior, [campo]: valor }));
  };

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <div>
          <p className="font-display text-2xl text-foreground">Ficha RPG</p>
          <p className="text-sm text-muted-foreground">Esses dados são seus e aparecem automaticamente em todas as gangs do painel.</p>
        </div>
      </div>
      <Card className="border-primary/25 bg-white/85 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <form className="space-y-5" onSubmit={(evento) => { evento.preventDefault(); aoSalvar(dados); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="perfil-nome-roblox">Nome no Roblox</Label>
                <Input id="perfil-nome-roblox" maxLength={80} value={dados.nome_roblox} onChange={(evento) => atualizar("nome_roblox", evento.target.value)} placeholder="Seu usuário no Roblox" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-nome-rp">Nome no jogo</Label>
                <Input id="perfil-nome-rp" maxLength={80} value={dados.nome_rp} onChange={(evento) => atualizar("nome_rp", evento.target.value)} placeholder="Nome do seu personagem" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-genero">Gênero</Label>
                <Select value={dados.genero || SEM_OPCAO} onValueChange={(valor) => atualizar("genero", valor === SEM_OPCAO ? "" : valor)}>
                  <SelectTrigger id="perfil-genero"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_OPCAO}>Não informar</SelectItem>
                    {GENEROS_RPG.map((genero) => <SelectItem key={genero} value={genero}>{genero}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-altura">Altura no jogo</Label>
                <Input id="perfil-altura" inputMode="decimal" value={dados.altura_jogo} onChange={(evento) => atualizar("altura_jogo", evento.target.value)} placeholder="Ex.: 1,82" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="perfil-estilo">Estilo de luta principal</Label>
                <Select value={dados.estilo_luta_principal || SEM_OPCAO} onValueChange={(valor) => atualizar("estilo_luta_principal", valor === SEM_OPCAO ? "" : valor)}>
                  <SelectTrigger id="perfil-estilo"><SelectValue placeholder="Selecione seu estilo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_OPCAO}>Não informar</SelectItem>
                    {estilosPorRaridade.map(([raridade, estilos]) => (
                      <div key={raridade}>
                        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{raridade}</p>
                        {estilos.map((estilo) => <SelectItem key={estilo.valor} value={estilo.valor}>{estilo.valor}</SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar ficha RPG"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export function PerfilJogador({ perfil, aoSalvarFicha, salvandoFicha = false }: { perfil: PerfilJogadorData; aoSalvarFicha: (dados: FichaRPGInput) => void; salvandoFicha?: boolean }) {
  const atividade = [
    { rotulo: "Treinos", valor: perfil.atividade.treinos, icone: Dumbbell },
    { rotulo: "Amistosos", valor: perfil.atividade.amistosos, icone: Swords },
    { rotulo: "Guerras", valor: perfil.atividade.guerras, icone: Trophy },
  ];

  return (
    <div className="space-y-9">
      <section className="card-gold flex flex-col gap-6 bg-white/88 p-6 sm:flex-row sm:items-center sm:p-8">
        <img src={perfil.jogador.avatarUrl} alt="" className="h-24 w-24 rounded-full border-2 border-primary/35 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-jp text-xs tracking-[0.2em] text-primary">白竜 · PERFIL DO JOGADOR</p>
          <h1 className="font-display mt-2 truncate text-3xl text-foreground sm:text-4xl">{perfil.jogador.globalName || perfil.jogador.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">@{perfil.jogador.username}{perfil.jogador.nomeRp ? ` · ${perfil.jogador.nomeRp}` : ""}</p>
        </div>
        <Badge variant="outline" className="w-fit border-primary/40 px-3 py-1.5"><Shield className="h-3.5 w-3.5" /> {perfil.gangsAtuais.length} {perfil.gangsAtuais.length === 1 ? "gang atual" : "gangs atuais"}</Badge>
      </section>

      <FichaRPGForm perfil={perfil} aoSalvar={aoSalvarFicha} salvando={salvandoFicha} />

      <section>
        <div className="mb-4 flex items-center gap-2"><Dumbbell className="h-4 w-4 text-primary" /><div><p className="font-display text-2xl text-foreground">Atividade</p><p className="text-sm text-muted-foreground">Participações confirmadas no painel Hakuryū.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-3">{atividade.map(({ rotulo, valor, icone: Icone }) => <Card key={rotulo} className="border-primary/20 bg-white/85"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-full bg-primary/12 p-3 text-primary"><Icone className="h-5 w-5" /></span><div><p className="font-display text-3xl text-foreground">{valor}</p><p className="text-sm text-muted-foreground">{rotulo} participados</p></div></CardContent></Card>)}</div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><div><p className="font-display text-2xl text-foreground">Gang atual</p><p className="text-sm text-muted-foreground">Gangs às quais você ainda está vinculado no painel.</p></div></div>
        {perfil.gangsAtuais.length ? <div className="grid gap-4 md:grid-cols-2">{perfil.gangsAtuais.map((gang) => <CardGang key={gang.gangId} gang={gang} />)}</div> : <Card className="border-dashed border-primary/30 bg-white/70"><CardContent className="p-6 text-sm text-muted-foreground">Você não está vinculado a nenhuma gang ativa no painel neste momento.</CardContent></Card>}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><div><p className="font-display text-2xl text-foreground">Histórico de gangs</p><p className="text-sm text-muted-foreground">Registros de gangs das quais você já saiu no painel.</p></div></div>
        {!perfil.historicoDisponivel ? <Card className="border-dashed border-primary/30 bg-white/70"><CardContent className="p-6 text-sm text-muted-foreground">O histórico será ativado quando a migração do Perfil do Jogador for aplicada.</CardContent></Card> : perfil.gangsAnteriores.length ? <div className="grid gap-4 md:grid-cols-2">{perfil.gangsAnteriores.map((gang) => <CardGang key={`${gang.gangId}-${gang.saiuEm}`} gang={gang} antiga />)}</div> : <Card className="border-dashed border-primary/30 bg-white/70"><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma gang anterior registrada no painel.</CardContent></Card>}
      </section>
    </div>
  );
}
