import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

import { Badge } from "@/components/ui/badge";
import { ATRIBUTOS_MEMBRO, NIVEIS_ATRIBUTO, rotuloNivelAtributo, type MembroAtributos } from "@/lib/types";

const corDoNivel = (valor: number) =>
  NIVEIS_ATRIBUTO.find((nivel) => nivel.valor === valor)?.cor ?? NIVEIS_ATRIBUTO[2].cor;

export function MemberAttributeRadar({ atributos }: { atributos: MembroAtributos }) {
  const dados = ATRIBUTOS_MEMBRO.map(({ chave, rotulo }) => ({
    subject: rotulo,
    value: atributos[chave],
  }));

  const media = dados.reduce((total, item) => total + item.value, 0) / dados.length;
  const nivelGeral = Math.max(1, Math.min(5, Math.round(media)));
  const corGeral = corDoNivel(nivelGeral);

  return (
    <div className="rounded-xl border border-primary/20 bg-card/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Atributos de combate</p>
          <p className="font-display mt-1 text-lg text-foreground">Avaliação de Gakuran</p>
        </div>
        <Badge variant="outline" style={{ borderColor: corGeral, color: corGeral }}>
          {rotuloNivelAtributo(nivelGeral)}
        </Badge>
      </div>

      <div className="mt-2 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={dados} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(180, 135, 35, 0.35)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
            <Radar
              name="Nível"
              dataKey="value"
              stroke={corGeral}
              fill={corGeral}
              fillOpacity={0.22}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { value: number } };
                if (typeof cx !== "number" || typeof cy !== "number") return <g />;
                return <circle cx={cx} cy={cy} r={4} fill={corDoNivel(payload?.value ?? 3)} stroke="var(--background)" strokeWidth={2} />;
              }}
            />
            <Tooltip
              formatter={(value) => {
                const numeric = Number(value);
                return [`${numeric}/5 — ${rotuloNivelAtributo(numeric)}`, "Nível"];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-3">
        {ATRIBUTOS_MEMBRO.map(({ chave, rotulo }) => {
          const valor = atributos[chave];
          return (
            <div key={chave} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corDoNivel(valor) }} />
                <span className="truncate">{rotulo}</span>
              </span>
              <span className="font-semibold text-foreground">{valor}/5</span>
            </div>
          );
        })}
      </div>

      {atributos.atualizado_em ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Última avaliação: {new Date(atributos.atualizado_em).toLocaleDateString("pt-BR")}
          {atributos.atualizado_por_nome ? ` por ${atributos.atualizado_por_nome}` : ""}.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">Ainda não houve uma avaliação registrada.</p>
      )}
    </div>
  );
}
