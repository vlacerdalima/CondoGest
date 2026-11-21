"use client";

import { Area, AreaChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatarMoedaInteira } from "./formato";

interface Ponto {
  rotulo: string;
  valor: number;
}

function Dica({ active, payload }: TooltipContentProps) {
  const ponto = payload?.[0]?.payload as Ponto | undefined;
  if (!active || !ponto) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-md">
      <span className="tabular font-semibold text-foreground">{formatarMoedaInteira(ponto.valor)}</span>{" "}
      <span className="text-muted">{ponto.rotulo}</span>
    </div>
  );
}

/** Tendência de 12 meses (uma série; a cor segue o condomínio) */
export function Sparkline({
  dados,
  cor,
  altura = 44,
  rotulo,
}: {
  dados: Ponto[];
  cor: string;
  altura?: number;
  /** Descrição para leitores de tela */
  rotulo: string;
}) {
  return (
    <div role="img" aria-label={rotulo}>
      <AreaChart data={dados} responsive style={{ width: "100%", height: altura }} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="rotulo" hide />
        <YAxis hide domain={[(min: number) => min * 0.92, (max: number) => max * 1.04]} />
        <Tooltip
          content={Dica}
          cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          isAnimationActive={false}
          allowEscapeViewBox={{ x: true, y: true }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke={cor}
          strokeWidth={2}
          fill={cor}
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, fill: cor, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}
