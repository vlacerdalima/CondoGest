"use client";

import { AlertTriangle } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarCompetenciaLonga, formatarMoeda, formatarNumero, formatarNumero1 } from "@/lib/formatacao";
import { faixaReais, pct, reais, reaisCompacto } from "./formato";
import {
  CaixaTooltip,
  conteudoTooltip,
  EIXO,
  GRADE,
  QuadroGrafico,
  type ItemLegenda,
  type LinhaTooltip,
  type TabelaDados,
} from "./graficos-base";

const MARGEM = { top: 12, right: 8, bottom: 0, left: 0 };

/* ------------------------------------------------------------------ */
/* Consumo por dia com faixa normal e anomalias                        */
/* ------------------------------------------------------------------ */

export interface LinhaConsumo {
  competencia: string;
  rotulo: string;
  valor: number;
  esperado?: number;
  faixa?: [number, number];
  desvio?: number;
  dias: number;
  ocupadas: number;
  /** "alta" (acima do normal) ou "queda" (abaixo do normal) */
  status?: "alta" | "queda";
  severidade?: "atencao" | "critico";
  /** Texto da anomalia (ex.: qual conta) */
  detalhe?: string;
  parcial?: boolean;
}

function corStatus(l: Pick<LinhaConsumo, "status" | "severidade">) {
  if (l.status === "queda") return "var(--chart-axis)";
  return l.severidade === "critico" ? "var(--critical)" : "var(--warn)";
}

export function GraficoConsumo({
  linhas,
  cor,
  nomeSerie,
  unidade,
  linhaDeBase,
  casas = 1,
}: {
  linhas: LinhaConsumo[];
  cor: string;
  nomeSerie: string;
  unidade: string;
  linhaDeBase?: number;
  casas?: 1 | 2;
}) {
  const fmt = (v: number) =>
    casas === 2 ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatarNumero1(v);
  const temFaixa = linhas.some((l) => l.faixa);
  const temAlta = linhas.some((l) => l.status === "alta");
  const temQueda = linhas.some((l) => l.status === "queda");
  const legenda: ItemLegenda[] = [
    { rotulo: nomeSerie, cor, forma: "linha" },
    ...(temFaixa ? [{ rotulo: "Faixa normal esperada", cor: "var(--chart-axis)", forma: "faixa" as const }] : []),
    ...(linhaDeBase ? [{ rotulo: "Linha de base (12 meses)", cor: "var(--muted)", forma: "tracejado" as const }] : []),
    ...(temAlta ? [{ rotulo: "Acima do normal", cor: "var(--warn)", forma: "ponto" as const }] : []),
    ...(temQueda ? [{ rotulo: "Abaixo do normal", cor: "var(--chart-axis)", forma: "ponto" as const }] : []),
  ];
  const tabela: TabelaDados = {
    colunas: ["Mês", unidade, "Esperado", "Faixa normal", "Desvio", "Dias", "Situação"],
    linhas: linhas.map((l) => [
      l.rotulo,
      fmt(l.valor),
      l.esperado !== undefined ? fmt(l.esperado) : "—",
      l.faixa ? `${fmt(l.faixa[0])} – ${fmt(l.faixa[1])}` : "—",
      l.desvio !== undefined ? pct(l.desvio, 1, true) : "—",
      l.dias,
      l.status === "alta" ? `Acima do normal${l.detalhe ? ` (${l.detalhe})` : ""}` : l.status === "queda" ? "Abaixo do normal" : l.esperado !== undefined ? "Normal" : "Sem referência",
    ]),
  };
  const valores = linhas.flatMap((l) => [l.valor, ...(l.faixa ?? [])]).filter((v) => v > 0);
  const minimo = valores.length ? Math.min(...valores) : 0;
  const maximo = valores.length ? Math.max(...valores, linhaDeBase ?? 0) : 1;

  return (
    <QuadroGrafico altura={280} legenda={legenda} tabela={tabela} rotulo={`${nomeSerie} por mês, em ${unidade}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={linhas} margin={MARGEM}>
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" minTickGap={18} />
          <YAxis
            {...EIXO}
            axisLine={false}
            width={casas === 2 ? 44 : 48}
            domain={[Math.max(0, minimo * 0.9), maximo * 1.06]}
            tickFormatter={(v: number) => (casas === 2 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : formatarNumero(v))}
            tickCount={5}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={conteudoTooltip<LinhaConsumo>((l) => {
              const linhasTip: LinhaTooltip[] = [{ rotulo: nomeSerie, valor: `${fmt(l.valor)} ${unidade}`, cor, forma: "linha" }];
              if (l.esperado !== undefined) linhasTip.push({ rotulo: "Esperado", valor: fmt(l.esperado), discreta: true });
              if (l.faixa) linhasTip.push({ rotulo: "Faixa normal", valor: `${fmt(l.faixa[0])} – ${fmt(l.faixa[1])}`, discreta: true });
              if (l.desvio !== undefined) linhasTip.push({ rotulo: "Desvio", valor: pct(l.desvio, 1, true), discreta: true });
              linhasTip.push({ rotulo: "Dias do ciclo", valor: l.dias, discreta: true });
              linhasTip.push({ rotulo: "Unidades ocupadas", valor: l.ocupadas, discreta: true });
              return (
                <CaixaTooltip
                  titulo={formatarCompetenciaLonga(l.competencia)}
                  linhas={linhasTip}
                  rodape={
                    l.status === "alta" ? (
                      <span className="inline-flex items-start gap-1 text-foreground">
                        <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
                        Acima do normal{l.detalhe ? `: ${l.detalhe}` : ""}
                      </span>
                    ) : l.status === "queda"
                        ? "Abaixo do normal (confira a leitura)"
                        : l.parcial
                          ? "Mês com conta faltando"
                          : undefined
                  }
                />
              );
            })}
          />
          {temFaixa && (
            <Area
              dataKey="faixa"
              stroke="none"
              fill="var(--chart-axis)"
              fillOpacity={0.14}
              isAnimationActive={false}
              activeDot={false}
              connectNulls={false}
            />
          )}
          {linhaDeBase && (
            <ReferenceLine y={linhaDeBase} stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.25} ifOverflow="extendDomain" />
          )}
          <Line
            dataKey="valor"
            stroke={cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: cor }}
            dot={(props: { cx?: number; cy?: number; payload?: LinhaConsumo; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (!payload?.status || cx === undefined || cy === undefined) return <g key={`d-${index}`} />;
              return (
                <circle key={`d-${index}`} cx={cx} cy={cy} r={5.5} fill={corStatus(payload)} stroke="var(--surface)" strokeWidth={2} />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </QuadroGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* Custo mensal empilhado (por UC ou por condomínio)                   */
/* ------------------------------------------------------------------ */

export interface SerieEmpilhada {
  chave: string;
  nome: string;
  cor: string;
}

export interface LinhaEmpilhada {
  competencia: string;
  rotulo: string;
  total: number;
  [chave: string]: number | string | undefined;
}

export function GraficoCustoEmpilhado({
  linhas,
  series,
  rotulo,
  altura = 260,
  extraTooltip,
  mediaReferencia,
}: {
  linhas: LinhaEmpilhada[];
  series: SerieEmpilhada[];
  rotulo: string;
  altura?: number;
  extraTooltip?: (l: LinhaEmpilhada) => LinhaTooltip[];
  mediaReferencia?: { valor: number; rotulo: string };
}) {
  const legenda: ItemLegenda[] =
    series.length > 1
      ? series.map((s) => ({ rotulo: s.nome, cor: s.cor, forma: "barra" as const }))
      : [];
  if (mediaReferencia) legenda.push({ rotulo: mediaReferencia.rotulo, cor: "var(--muted)", forma: "tracejado" });
  const tabela: TabelaDados = {
    colunas: ["Mês", ...series.map((s) => s.nome), ...(series.length > 1 ? ["Total"] : [])],
    linhas: linhas.map((l) => [
      l.rotulo,
      ...series.map((s) => (typeof l[s.chave] === "number" ? formatarMoeda(l[s.chave] as number) : "—")),
      ...(series.length > 1 ? [formatarMoeda(l.total)] : []),
    ]),
  };
  return (
    <QuadroGrafico altura={altura} legenda={legenda} tabela={tabela} rotulo={rotulo}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={MARGEM} barCategoryGap="22%">
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...EIXO} axisLine={false} width={58} tickFormatter={reaisCompacto} tickCount={5} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }}
            content={conteudoTooltip<LinhaEmpilhada>((l) => (
              <CaixaTooltip
                titulo={formatarCompetenciaLonga(l.competencia)}
                linhas={[
                  ...[...series].reverse().map((s) => ({
                    rotulo: s.nome,
                    valor: typeof l[s.chave] === "number" ? formatarMoeda(l[s.chave] as number) : "—",
                    cor: s.cor,
                    forma: "barra" as const,
                  })),
                  ...(series.length > 1 ? [{ rotulo: "Total", valor: formatarMoeda(l.total) }] : []),
                  ...(extraTooltip?.(l) ?? []),
                ]}
              />
            ))}
          />
          {mediaReferencia && (
            <ReferenceLine y={mediaReferencia.valor} stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.25} />
          )}
          {series.map((s, i) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              name={s.nome}
              stackId="custo"
              fill={s.cor}
              maxBarSize={24}
              stroke="var(--surface)"
              strokeWidth={series.length > 1 ? 1.5 : 0}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </QuadroGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* Demanda medida × contratada                                         */
/* ------------------------------------------------------------------ */

export interface LinhaDemanda {
  competencia: string;
  rotulo: string;
  medida?: number;
  contratada?: number;
}

export function GraficoDemanda({
  linhas,
  cor,
  sugerida,
}: {
  linhas: LinhaDemanda[];
  cor: string;
  sugerida?: number;
}) {
  const maxMedida = Math.max(0, ...linhas.map((l) => l.medida ?? 0));
  const contratadaAtual = [...linhas].reverse().find((l) => l.contratada)?.contratada;
  const ociosa = contratadaAtual && maxMedida && contratadaAtual > maxMedida;
  const legenda: ItemLegenda[] = [
    { rotulo: "Demanda medida (pico do mês)", cor, forma: "barra" },
    { rotulo: "Demanda contratada (paga)", cor: "var(--muted)", forma: "linha" },
    ...(ociosa ? [{ rotulo: "Demanda ociosa", cor: "var(--energy-strong)", forma: "faixa" as const }] : []),
    ...(sugerida ? [{ rotulo: `Proposta: ${formatarNumero(sugerida)} kW`, cor: "var(--energy)", forma: "tracejado" as const }] : []),
  ];
  const tabela: TabelaDados = {
    colunas: ["Mês", "Medida (kW)", "Contratada (kW)", "Uso da contratada"],
    linhas: linhas.map((l) => [
      l.rotulo,
      l.medida !== undefined ? formatarNumero1(l.medida) : "—",
      l.contratada !== undefined ? formatarNumero(l.contratada) : "—",
      l.medida !== undefined && l.contratada ? pct(l.medida / l.contratada) : "—",
    ]),
  };
  return (
    <QuadroGrafico altura={260} legenda={legenda} tabela={tabela} rotulo="Demanda medida e demanda contratada por mês, em kW">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={linhas} margin={MARGEM} barCategoryGap="25%">
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...EIXO} axisLine={false} width={44} domain={[0, (m: number) => Math.ceil((m * 1.1) / 10) * 10]} tickFormatter={(v: number) => `${v}`} unit=" kW" tickCount={5} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }}
            content={conteudoTooltip<LinhaDemanda>((l) => (
              <CaixaTooltip
                titulo={formatarCompetenciaLonga(l.competencia)}
                linhas={[
                  { rotulo: "Medida", valor: l.medida !== undefined ? `${formatarNumero1(l.medida)} kW` : "—", cor, forma: "barra" },
                  { rotulo: "Contratada", valor: l.contratada !== undefined ? `${formatarNumero(l.contratada)} kW` : "—", cor: "var(--muted)" },
                  ...(l.medida !== undefined && l.contratada
                    ? [{ rotulo: "Paga e não usada", valor: `${formatarNumero1(Math.max(0, l.contratada - l.medida))} kW`, discreta: true }]
                    : []),
                ]}
              />
            ))}
          />
          {ociosa && (
            <ReferenceArea
              y1={maxMedida}
              y2={contratadaAtual}
              fill="var(--energy-strong)"
              fillOpacity={0.16}
              stroke="none"
              label={{ value: "Demanda ociosa: paga e nunca usada", position: "insideTop", fill: "var(--muted)", fontSize: 11 }}
            />
          )}
          <Bar dataKey="medida" fill={cor} maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line dataKey="contratada" type="stepAfter" stroke="var(--muted)" strokeWidth={2} dot={false} isAnimationActive={false} activeDot={false} />
          {sugerida && (
            <ReferenceLine
              y={sugerida}
              stroke="var(--energy)"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{ value: `Proposta ${formatarNumero(sugerida)} kW`, position: "insideBottomRight", fill: "var(--muted)", fontSize: 11 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </QuadroGrafico>
  );
}

/* ------------------------------------------------------------------ */
/* Mercado livre: custo real × custo se fosse cativo                   */
/* ------------------------------------------------------------------ */

export interface LinhaMercadoLivre {
  competencia: string;
  rotulo: string;
  real: number;
  cativo: number;
  economia: number;
  acumulada: number;
}

export function GraficoMercadoLivre({ linhas, cor }: { linhas: LinhaMercadoLivre[]; cor: string }) {
  const legenda: ItemLegenda[] = [
    { rotulo: "Quanto pagou (distribuidora + comercializadora)", cor, forma: "barra" },
    { rotulo: "Quanto custaria no mercado cativo", cor: "var(--chart-axis)", forma: "barra" },
  ];
  const tabela: TabelaDados = {
    colunas: ["Mês", "Pagou", "Custaria no cativo", "Economia", "Economia acumulada"],
    linhas: linhas.map((l) => [l.rotulo, formatarMoeda(l.real), formatarMoeda(l.cativo), formatarMoeda(l.economia), formatarMoeda(l.acumulada)]),
  };
  return (
    <QuadroGrafico altura={250} legenda={legenda} tabela={tabela} rotulo="Custo real no mercado livre e custo equivalente no mercado cativo, por mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={linhas} margin={MARGEM} barCategoryGap="20%" barGap={2}>
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...EIXO} axisLine={false} width={58} tickFormatter={reaisCompacto} tickCount={5} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }}
            content={conteudoTooltip<LinhaMercadoLivre>((l) => (
              <CaixaTooltip
                titulo={formatarCompetenciaLonga(l.competencia)}
                linhas={[
                  { rotulo: "Pagou", valor: formatarMoeda(l.real), cor, forma: "barra" },
                  { rotulo: "No cativo custaria", valor: formatarMoeda(l.cativo), cor: "var(--chart-axis)", forma: "barra" },
                  { rotulo: "Economia do mês", valor: `${reais(l.economia)} (${pct(l.cativo > 0 ? l.economia / l.cativo : 0)})` },
                  { rotulo: "Acumulada", valor: reais(l.acumulada), discreta: true },
                ]}
              />
            ))}
          />
          <Bar dataKey="real" fill={cor} maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="cativo" fill="var(--chart-axis)" fillOpacity={0.55} maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </QuadroGrafico>
  );
}

/** Faixa de economia em destaque (usado em cartões) */
export function ValorFaixa({ faixa, sufixo = "/mês" }: { faixa: { min: number; max: number }; sufixo?: string }) {
  return (
    <span className="whitespace-nowrap">
      {faixaReais(faixa)}
      <span className="text-[0.7em] font-medium text-muted">{sufixo}</span>
    </span>
  );
}
