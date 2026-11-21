"use client";

import { ChartColumnStacked, Table2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps, type TooltipContentProps } from "recharts";
import {
  DESCRICAO_GRUPO_OUTROS,
  GRUPOS_CATEGORIA,
  type LinhaMensalPorGrupo,
} from "@/lib/analise/geral";
import { formatarCompetenciaLonga, formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { formatarMoedaInteira, maiusculaInicial } from "./formato";

/** Linha do gráfico + qual grupo está na base e no topo da pilha ("" = nenhum) */
type Linha = LinhaMensalPorGrupo & { __topo: string; __base: string };

const formatarEixo = (v: number) => {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return Math.round(v).toLocaleString("pt-BR");
};

/**
 * Segmento de barra empilhada: 2px de "respiro" (cor da superfície) entre
 * segmentos, cantos de 4px só no topo da pilha e base reta no eixo.
 */
function criarSegmento(grupoId: string) {
  return function Segmento(props: BarShapeProps) {
    const { x, y, width, height, fill } = props;
    const linha = props.payload as Linha | undefined;
    if (!height || height <= 0 || !width) return <g />;
    const base = linha?.__base === grupoId;
    const topo = linha?.__topo === grupoId;
    const h = Math.max(0, height - (base ? 0 : 2));
    if (h <= 0) return <g />;
    const r = topo ? Math.min(4, h, width / 2) : 0;
    const d = [
      `M${x},${y + h}`,
      `L${x},${y + r}`,
      r ? `Q${x},${y} ${x + r},${y}` : "",
      `L${x + width - r},${y}`,
      r ? `Q${x + width},${y} ${x + width},${y + r}` : "",
      `L${x + width},${y + h}`,
      "Z",
    ].join(" ");
    return <path d={d} style={{ fill }} />;
  };
}

function ConteudoTooltip({ active, payload }: TooltipContentProps) {
  const linha = payload?.[0]?.payload as Linha | undefined;
  if (!active || !linha) return null;
  const grupos = GRUPOS_CATEGORIA.filter((g) => (linha[g.id] as number) > 0).reverse();
  return (
    <div className="min-w-56 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="font-medium text-muted">{maiusculaInicial(formatarCompetenciaLonga(linha.competencia))}</p>
      <p className="tabular mt-0.5 text-base font-semibold text-foreground">{formatarMoeda(linha.total)}</p>
      <ul className="mt-2 space-y-1">
        {grupos.map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: g.cor }} />
            <span className="tabular font-semibold text-foreground">{formatarMoedaInteira(linha[g.id] as number)}</span>
            <span className="truncate text-muted">{g.rotulo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Gastos mensais por grupo de categoria (barras empilhadas), com legenda,
 * tooltip e alternância para tabela (versão acessível do gráfico).
 */
export function GraficoGastosMensais({
  dados,
  altura = 280,
  className,
  rotuloAcessivel = "Gastos mensais por categoria",
}: {
  dados: LinhaMensalPorGrupo[];
  altura?: number;
  className?: string;
  rotuloAcessivel?: string;
}) {
  const [modo, setModo] = useState<"grafico" | "tabela">("grafico");
  const idTabela = useId();

  const grupos = useMemo(
    () => GRUPOS_CATEGORIA.filter((g) => dados.some((d) => (d[g.id] as number) > 0)),
    [dados],
  );

  const linhas = useMemo<Linha[]>(
    () =>
      dados.map((d) => {
        const presentes = grupos.filter((g) => (d[g.id] as number) > 0);
        return { ...d, __base: presentes[0]?.id ?? "", __topo: presentes.at(-1)?.id ?? "" };
      }),
    [dados, grupos],
  );

  const formas = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, criarSegmento(g.id)])), [grupos]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legenda">
          {grupos.map((g) => (
            <li key={g.id} className="inline-flex items-center gap-1.5" title={g.id === "outros" ? DESCRICAO_GRUPO_OUTROS : undefined}>
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.cor }} />
              {g.rotulo}
            </li>
          ))}
        </ul>
        <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5" role="group" aria-label="Forma de exibição">
          {(
            [
              { id: "grafico", rotulo: "Gráfico", icone: ChartColumnStacked },
              { id: "tabela", rotulo: "Tabela", icone: Table2 },
            ] as const
          ).map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              aria-pressed={modo === id}
              aria-controls={id === "tabela" ? idTabela : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                modo === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              <Icone className="size-3.5" aria-hidden />
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {modo === "grafico" ? (
        <div className="mt-4" role="img" aria-label={`${rotuloAcessivel}. Use o botão Tabela para ver os valores.`}>
          <BarChart
            data={linhas}
            responsive
            style={{ width: "100%", height: altura }}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tickFormatter={formatarEixo}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={ConteudoTooltip} isAnimationActive={false} />
            {grupos.map((g) => (
              <Bar
                key={g.id}
                dataKey={g.id}
                name={g.rotulo}
                stackId="total"
                fill={g.cor}
                maxBarSize={28}
                shape={formas[g.id]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </div>
      ) : (
        <div id={idTabela} className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-xs">
            <caption className="sr-only">{rotuloAcessivel}</caption>
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Mês
                </th>
                {grupos.map((g) => (
                  <th key={g.id} scope="col" className="px-3 py-2 text-right font-medium">
                    {g.rotulo}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-semibold text-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => (
                <tr key={l.competencia}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                    {l.rotulo}
                  </th>
                  {grupos.map((g) => (
                    <td key={g.id} className="tabular px-3 py-2 text-right text-muted">
                      {formatarMoedaInteira(l[g.id] as number)}
                    </td>
                  ))}
                  <td className="tabular px-3 py-2 text-right font-semibold text-foreground">
                    {formatarMoedaInteira(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grupos.some((g) => g.id === "outros") && (
        <p className="mt-2 text-xs text-subtle">Outros = {DESCRICAO_GRUPO_OUTROS.toLowerCase()}.</p>
      )}
    </div>
  );
}
