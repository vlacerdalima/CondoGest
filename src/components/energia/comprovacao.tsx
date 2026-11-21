"use client";

import { AlertTriangle, CheckCircle2, Clock, FlaskConical, HelpCircle, Ruler, XCircle, type LucideIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  Area,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { estiloCampo, Rotulo } from "@/components/ui/page-header";
import {
  comprovarAcao,
  formatarValorMetrica,
  type AnaliseEnergiaCondominio,
  type RecomendacaoEnergia,
  type Veredito,
} from "@/lib/analise/energia";
import { formatarCompetencia, formatarCompetenciaLonga, formatarMoeda, formatarNumero } from "@/lib/formatacao";
import { faixaReais, pct, reais, reaisCompacto } from "./formato";
import { CaixaTooltip, conteudoTooltip, EIXO, GRADE, QuadroGrafico, type ItemLegenda, type LinhaTooltip } from "./graficos-base";

const VEREDITOS: Record<Veredito, { rotulo: string; tom: "ok" | "atencao" | "critico" | "neutro"; icone: LucideIcon }> = {
  confirmada: { rotulo: "Economia confirmada", tom: "ok", icone: CheckCircle2 },
  parcial: { rotulo: "Sinal de economia, ainda incerto", tom: "atencao", icone: AlertTriangle },
  nao_observada: { rotulo: "Economia não apareceu", tom: "critico", icone: XCircle },
  inconclusiva: { rotulo: "Cedo para concluir", tom: "neutro", icone: HelpCircle },
  aguardando: { rotulo: "Aguardando a próxima conta", tom: "neutro", icone: Clock },
};

interface LinhaGrafico {
  competencia: string;
  rotulo: string;
  fase: string;
  real?: number;
  esperado?: number;
  faixa?: [number, number];
}

export function Comprovacao({
  analise,
  recomendacoes,
  selecionadaId,
  onSelecionar,
  cor,
}: {
  analise: AnaliseEnergiaCondominio;
  recomendacoes: RecomendacaoEnergia[];
  selecionadaId?: string;
  onSelecionar: (id: string) => void;
  cor: (ucId?: string) => string;
}) {
  const idAcao = useId();
  const idMes = useId();
  const rec = recomendacoes.find((r) => r.id === selecionadaId) ?? recomendacoes[0];
  const [mesPorAcao, setMesPorAcao] = useState<Record<string, string>>({});
  const mes = rec ? (mesPorAcao[rec.id] ?? "") : "";
  const resultado = useMemo(() => (rec ? comprovarAcao(analise, rec, mes || null) : null), [analise, rec, mes]);

  if (!rec || !resultado) return null;
  const corSerie = cor(rec.ucId);
  const fmt = (v: number) => formatarValorMetrica(rec.metrica, v);
  const linhas: LinhaGrafico[] = resultado.pontos.map((p) => ({
    competencia: p.competencia,
    rotulo: formatarCompetencia(p.competencia),
    fase: p.fase,
    real: p.real,
    esperado: p.esperado,
    faixa: p.comAcaoMin !== undefined && p.comAcaoMax !== undefined ? [p.comAcaoMin, p.comAcaoMax] : undefined,
  }));
  const base = resultado.linhaDeBase;
  const inicioAcao = resultado.modo === "simulacao" ? resultado.simulacao?.inicio : resultado.mesImplementacao;
  const legenda: ItemLegenda[] = [
    { rotulo: "Real", cor: corSerie, forma: "linha" },
    { rotulo: "Esperado sem a ação", cor: "var(--chart-axis)", forma: "tracejado" },
    { rotulo: "Com a ação (faixa estimada)", cor: corSerie, forma: "faixa" },
    ...(base ? [{ rotulo: "Meses da linha de base", cor: "var(--chart-grid)", forma: "barra" as const }] : []),
  ];
  const valores = linhas.flatMap((l) => [l.real, l.esperado, ...(l.faixa ?? [])]).filter((v): v is number => v !== undefined);
  const minimo = valores.length ? Math.min(...valores) : 0;
  const maximo = valores.length ? Math.max(...valores) : 1;
  const tickY = (v: number) =>
    rec.metrica === "reais_por_kwh"
      ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : resultado.definicao.moeda
        ? reaisCompacto(v)
        : formatarNumero(v);

  const veredito = resultado.medicao ? VEREDITOS[resultado.medicao.veredito] : null;

  return (
    <Card id="comprovacao" className="scroll-mt-6">
      <CardHeader
        icone={<Ruler className="size-5" aria-hidden />}
        titulo="Comprovação antes/depois"
        descricao="Escolha a ação e quando ela foi feita. Sem data, mostramos a simulação — e o método já fica pronto para medir depois."
      />
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor={idAcao}>Ação</Rotulo>
            <select id={idAcao} className={estiloCampo} value={rec.id} onChange={(e) => onSelecionar(e.target.value)}>
              {recomendacoes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.prioridade}. {r.titulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo htmlFor={idMes} dica="o mês da ação fica de fora">
              Mês em que a ação foi feita
            </Rotulo>
            <select
              id={idMes}
              className={estiloCampo}
              value={mes}
              onChange={(e) => setMesPorAcao((m) => ({ ...m, [rec.id]: e.target.value }))}
            >
              <option value="">Ainda não implementada — simulação</option>
              {[...resultado.mesesDisponiveis].reverse().map((c) => (
                <option key={c} value={c}>
                  {formatarCompetenciaLonga(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {resultado.modo === "simulacao" ? (
                <Badge tom="energia">
                  <FlaskConical aria-hidden />
                  Simulação
                </Badge>
              ) : (
                <Badge tom="primario">
                  <Ruler aria-hidden />
                  Medição com as contas
                </Badge>
              )}
              <span className="text-sm font-medium text-foreground">
                {resultado.definicao.rotulo} ({resultado.definicao.unidade})
              </span>
              {resultado.ucApelido && <span className="text-sm text-muted">· {resultado.ucApelido}</span>}
            </div>
            <QuadroGrafico
              altura={270}
              legenda={legenda}
              rotulo={`${resultado.definicao.rotulo}: antes e depois da ação`}
              tabela={{
                colunas: ["Mês", "Fase", "Real", "Esperado sem a ação", "Com a ação (faixa)"],
                linhas: linhas.map((l) => [
                  l.rotulo,
                  { base: "Linha de base", antes: "Antes", transicao: "Mês da ação", depois: "Depois", projecao: "Projeção" }[l.fase] ?? l.fase,
                  l.real !== undefined ? fmt(l.real) : "—",
                  l.esperado !== undefined ? fmt(l.esperado) : "—",
                  l.faixa ? `${fmt(l.faixa[0])} – ${fmt(l.faixa[1])}` : "—",
                ]),
                numericas: [2, 3, 4],
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={linhas} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRADE} />
                  <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis
                    {...EIXO}
                    axisLine={false}
                    width={56}
                    domain={[Math.max(0, minimo * 0.88), maximo * 1.06]}
                    tickFormatter={tickY}
                    tickCount={5}
                  />
                  {base && (
                    <ReferenceArea
                      x1={formatarCompetencia(base.inicio)}
                      x2={formatarCompetencia(base.fim)}
                      fill="var(--chart-grid)"
                      fillOpacity={0.55}
                      stroke="none"
                      label={{ value: "Linha de base", position: "insideTop", fill: "var(--muted)", fontSize: 11 }}
                    />
                  )}
                  {base && (
                    <ReferenceLine
                      segment={[
                        { x: formatarCompetencia(base.inicio), y: base.valor },
                        { x: formatarCompetencia(base.fim), y: base.valor },
                      ]}
                      stroke="var(--muted)"
                      strokeWidth={1.5}
                    />
                  )}
                  {inicioAcao && linhas.some((l) => l.competencia === inicioAcao) && (
                    <ReferenceLine
                      x={formatarCompetencia(inicioAcao)}
                      stroke="var(--energy)"
                      strokeWidth={1.5}
                      label={{ value: "Ação", position: "insideTopRight", fill: "var(--foreground)", fontSize: 11 }}
                    />
                  )}
                  <Tooltip
                    cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                    content={conteudoTooltip<LinhaGrafico>((l) => {
                      const ls: LinhaTooltip[] = [];
                      if (l.real !== undefined) ls.push({ rotulo: "Real", valor: fmt(l.real), cor: corSerie });
                      if (l.esperado !== undefined && l.fase !== "base" && l.fase !== "antes")
                        ls.push({ rotulo: "Esperado sem a ação", valor: fmt(l.esperado), cor: "var(--chart-axis)", forma: "tracejado" });
                      if (l.faixa && l.fase !== "base" && l.fase !== "antes")
                        ls.push({ rotulo: "Com a ação", valor: `${fmt(l.faixa[0])} – ${fmt(l.faixa[1])}`, cor: corSerie, forma: "faixa" });
                      return (
                        <CaixaTooltip
                          titulo={formatarCompetenciaLonga(l.competencia)}
                          linhas={ls}
                          rodape={
                            { base: "Mês usado na linha de base", antes: "Antes da ação", transicao: "Mês da ação (fica de fora)", depois: "Depois da ação", projecao: "Projeção" }[l.fase]
                          }
                        />
                      );
                    })}
                  />
                  <Area dataKey="faixa" stroke="none" fill={corSerie} fillOpacity={0.2} isAnimationActive={false} activeDot={false} />
                  <Line dataKey="esperado" stroke="var(--chart-axis)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} activeDot={false} />
                  <Line
                    dataKey="real"
                    stroke={corSerie}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: corSerie }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </QuadroGrafico>
          </div>

          <div className="flex flex-col gap-4">
            {resultado.simulacao && (
              <div className="rounded-xl border border-energy-strong/50 bg-energy-soft/40 p-4">
                <p className="text-sm text-muted">Se a ação for feita agora</p>
                <dl className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted">Esperado sem a ação</dt>
                    <dd className="tabular text-lg font-semibold text-foreground">{fmt(resultado.simulacao.esperadoMedio)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Com a ação</dt>
                    <dd className="tabular text-lg font-semibold text-foreground">
                      {fmt(resultado.simulacao.comAcao.min)} – {fmt(resultado.simulacao.comAcao.max).replace(/^R\$\s/, "")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Redução</dt>
                    <dd className="tabular text-lg font-semibold text-foreground">
                      {pct(resultado.simulacao.reducaoPercentual.min, 1)} – {pct(resultado.simulacao.reducaoPercentual.max, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Economia</dt>
                    <dd className="tabular text-lg font-semibold text-foreground">{faixaReais(resultado.simulacao.economiaReais)}/mês</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-foreground">{resultado.simulacao.texto}</p>
              </div>
            )}
            {resultado.medicao && veredito && (
              <div className="rounded-xl border border-border p-4">
                <Badge tom={veredito.tom} className="text-sm">
                  <veredito.icone aria-hidden />
                  {veredito.rotulo}
                </Badge>
                {resultado.mesesDepois.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-muted">Economia média</dt>
                      <dd className="tabular text-lg font-semibold text-foreground">
                        {fmt(resultado.medicao.economiaMedia)} ({pct(resultado.medicao.economiaPercentual, 1, true)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Em reais</dt>
                      <dd className="tabular text-lg font-semibold text-foreground">
                        {reais(resultado.medicao.economiaReaisMes)}/mês
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Total desde a ação ({resultado.mesesDepois.length} meses)</dt>
                      <dd className="tabular text-lg font-semibold text-foreground">{formatarMoeda(resultado.medicao.economiaReaisTotal)}</dd>
                    </div>
                  </dl>
                )}
                <p className="mt-3 text-sm text-foreground">{resultado.medicao.texto}</p>
              </div>
            )}
            {resultado.avisos.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-xs text-muted">
                {resultado.avisos.map((a) => (
                  <li key={a} className="flex gap-1.5">
                    <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-surface-2/70 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Regra de comparação (a mesma antes e depois)</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            {resultado.regra.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          {base && (
            <p className="mt-3 text-sm text-foreground">
              Linha de base: <strong className="tabular">{fmt(base.valor)}</strong>, média de {base.meses.length}{" "}
              {base.meses.length === 1 ? "mês" : "meses"} ({formatarCompetencia(base.inicio)} a {formatarCompetencia(base.fim)})
              {resultado.definicao.ajusta && <>, com {formatarNumero(base.ocupacaoMedia)} unidades ocupadas em média</>}. Variação
              normal: ±{pct(Math.max(base.variacaoNormal, 0.03), 1)}.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
