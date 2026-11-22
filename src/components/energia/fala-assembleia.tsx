"use client";

import { ArrowLeft, Clock, Printer, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState, estiloCampo, Rotulo } from "@/components/ui/page-header";
import { analisarCondominio, gerarFalaAssembleia, type GraficoSlide } from "@/lib/analise/energia";
import { obterCondominio } from "@/lib/dados";
import { DATA_REFERENCIA } from "@/lib/dados/referencia";
import { useContas } from "@/lib/dados/store";
import { formatarData, formatarMoeda, formatarNumero, formatarNumero1, formatarTarifa } from "@/lib/formatacao";
import { corSerie, reaisCompacto } from "./formato";
import { CaixaTooltip, ChaveCor, conteudoTooltip, EIXO, escalaBonita, useMontado } from "./graficos-base";

function formatarValorSlide(g: GraficoSlide, v: number) {
  switch (g.unidade) {
    case "kW":
      return `${formatarNumero1(v)} kW`;
    case "kWh/dia":
      return `${formatarNumero1(v)} kWh/dia`;
    case "R$/kWh":
      return formatarTarifa(v);
    default:
      return formatarMoeda(Math.round(v)).replace(",00", "");
  }
}

function MiniGrafico({ grafico, cor }: { grafico: GraficoSlide; cor: string }) {
  const montado = useMontado();
  const temDestaque = grafico.barras.some((b) => b.destaque);
  // Com destaque: ênfase (o resto em cinza); sem destaque: a cor do condomínio
  const corBase = temDestaque ? "var(--chart-axis)" : cor;
  const resumo = grafico.barras.map((b) => `${b.rotulo}: ${formatarValorSlide(grafico, b.valor)}`).join("; ");
  const maximo = Math.max(...grafico.barras.map((b) => b.valor), ...grafico.referencias.map((r) => r.valor));
  const escala = escalaBonita(0, maximo * 1.05, 4, true);
  const poucas = grafico.barras.length <= 3;
  return (
    <figure className="flex h-full min-h-0 flex-col">
      <figcaption className="mb-1 text-[0.8em] font-semibold text-foreground">{grafico.titulo}</figcaption>
      <ul className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7em] text-muted">
        {temDestaque && grafico.legendaDestaque && (
          <li className="inline-flex items-center gap-1">
            <ChaveCor cor="var(--energy)" forma="barra" />
            {grafico.legendaDestaque}
          </li>
        )}
        {grafico.referencias.map((r, i) => (
          <li key={r.rotulo} className="inline-flex items-center gap-1">
            <ChaveCor cor={i === 0 ? "var(--muted)" : "var(--energy)"} forma={i === 0 ? "linha" : "tracejado"} />
            {r.rotulo}
          </li>
        ))}
      </ul>
      <div className="h-[190px] sm:h-auto sm:min-h-[150px] sm:flex-1" role="img" aria-label={`${grafico.titulo}. ${resumo}`}>
        {montado && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico.barras} margin={{ top: 14, right: 4, bottom: 0, left: 0 }} barCategoryGap={poucas ? "35%" : "18%"}>
              <XAxis dataKey="rotulo" {...EIXO} interval={poucas ? 0 : "preserveStartEnd"} minTickGap={6} />
              <YAxis {...EIXO} axisLine={false} width={grafico.unidade === "R$" ? 64 : 46} domain={escala.dominio} ticks={escala.ticks} tickFormatter={(v: number) => (grafico.unidade === "R$" ? reaisCompacto(v) : grafico.unidade === "R$/kWh" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : formatarNumero(v))} />
              <Tooltip
                cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }}
                content={conteudoTooltip<{ rotulo: string; valor: number }>((b) => (
                  <CaixaTooltip titulo={b.rotulo} linhas={[{ rotulo: grafico.titulo, valor: formatarValorSlide(grafico, b.valor) }]} />
                ))}
              />
              <Bar
                dataKey="valor"
                maxBarSize={poucas ? 64 : 22}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                label={
                  poucas
                    ? { position: "top", fill: "var(--foreground)", fontSize: 12, fontWeight: 600, formatter: (v: unknown) => formatarValorSlide(grafico, Number(v)) }
                    : undefined
                }
              >
                {grafico.barras.map((b) => (
                  <Cell key={b.rotulo} fill={b.destaque ? "var(--energy)" : corBase} />
                ))}
              </Bar>
              {grafico.referencias.map((r, i) => (
                <ReferenceLine
                  key={r.rotulo}
                  y={r.valor}
                  stroke={i === 0 ? "var(--muted)" : "var(--energy)"}
                  strokeWidth={2}
                  strokeDasharray={i === 0 ? undefined : "6 4"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}

export function FalaAssembleia({ condominioId }: { condominioId: string }) {
  const contas = useContas();
  const params = useSearchParams();
  const idSelect = useId();
  const condominio = obterCondominio(condominioId)!;
  const analise = useMemo(() => analisarCondominio(condominio, contas), [condominio, contas]);
  const [escolha, setEscolha] = useState<string>();
  const acaoUrl = params.get("acao") ?? undefined;
  const acaoId = escolha ?? (analise.recomendacoes.some((r) => r.id === acaoUrl) ? acaoUrl : analise.recomendacoes[0]?.id);
  const fala = useMemo(() => gerarFalaAssembleia(analise, contas, acaoId), [analise, contas, acaoId]);
  const minutos = Math.max(1, Math.round(fala.segundosEstimados / 60));

  return (
    <div className="flex flex-col gap-6">
      <style>{`@media print { @page { size: A4; margin: 12mm; } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      {/* Controles (não imprime) */}
      <div className="no-print flex flex-col gap-4">
        <Link href={`/energia/${condominio.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Energia · {condominio.nome}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">Fala para assembleia</h1>
            <p className="mt-1 max-w-2xl text-[0.95rem] text-muted">
              Roteiro de 3 minutos em linguagem de síndico e um slide de apoio, gerados a partir das contas e da recomendação
              escolhida. Revise, imprima ou apresente.
            </p>
          </div>
          <Button onClick={() => window.print()} variante="energia">
            <Printer aria-hidden />
            Imprimir
          </Button>
        </div>
        {analise.recomendacoes.length > 1 && (
          <div className="max-w-xl">
            <Rotulo htmlFor={idSelect}>Ação a apresentar</Rotulo>
            <select id={idSelect} className={estiloCampo} value={acaoId} onChange={(e) => setEscolha(e.target.value)}>
              {analise.recomendacoes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.prioridade}. {r.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!analise.mesesDeHistorico ? (
        <EmptyState icone={<Zap />} titulo="Sem contas de energia" descricao="Envie as contas de energia para gerar a fala da assembleia." />
      ) : (
        <>
          {/* Slide 16:9 */}
          <section aria-label="Slide de apoio" className="print:break-inside-avoid">
            <p className="no-print mb-2 text-xs font-semibold tracking-wider text-subtle uppercase">Slide de apoio</p>
            <div className="@container overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:aspect-video print:aspect-video print:shadow-none">
              <div className="flex h-full flex-col gap-4 p-5 text-[15px] sm:flex-row sm:gap-6 sm:p-[4cqw] sm:text-[clamp(12px,1.75cqw,22px)]">
                <div className="flex min-w-0 flex-col sm:w-[52%]">
                  <p className="flex items-center gap-1.5 text-[0.8em] font-semibold tracking-wide text-energy uppercase">
                    <Zap className="size-[1.1em]" aria-hidden />
                    Energia · {condominio.nome}
                  </p>
                  <h2 className="mt-[0.5em] text-[1.85em] leading-[1.12] font-extrabold tracking-tight text-balance text-foreground">{fala.slide.titulo}</h2>
                  <div className="mt-[0.9em] rounded-xl bg-energy-soft px-[0.9em] py-[0.6em]">
                    <p className="text-[2.4em] leading-none font-extrabold tracking-tight text-foreground">{fala.slide.numero}</p>
                    <p className="mt-[0.35em] text-[0.85em] font-medium text-muted">{fala.slide.legendaNumero}</p>
                  </div>
                  <ul className="mt-[0.9em] flex flex-col gap-[0.45em] text-[0.95em] text-foreground">
                    {fala.slide.bullets.map((b) => (
                      <li key={b} className="flex gap-[0.5em]">
                        <span className="mt-[0.45em] size-[0.45em] shrink-0 rounded-full bg-energy" aria-hidden />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {fala.slide.grafico && (
                  <div className="min-h-[200px] min-w-0 flex-1 rounded-xl border border-border p-[0.8em]">
                    <MiniGrafico grafico={fala.slide.grafico} cor={corSerie(condominio.corSerie)} />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Roteiro */}
          <section aria-labelledby="titulo-roteiro" className="print:break-before-page">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-muted">
                  {condominio.nome} · assembleia · dados até {analise.ultimoMesCompleto ? analise.ultimoMesCompleto.split("-").reverse().join("/") : "—"}
                </p>
                <h2 id="titulo-roteiro" className="text-xl font-bold text-foreground">
                  Roteiro de 3 minutos
                </h2>
              </div>
              <p className="inline-flex items-center gap-1.5 text-sm text-muted">
                <Clock className="size-4" aria-hidden />
                {fala.palavras} palavras · cerca de {minutos} {minutos === 1 ? "minuto" : "minutos"} em ritmo calmo
              </p>
            </div>
            <ol className="flex flex-col gap-4">
              {fala.blocos.map((b, i) => (
                <li key={b.titulo} className="rounded-xl border border-border bg-surface p-5 print:break-inside-avoid">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-energy-strong text-sm font-bold text-[#2b1d00]">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-foreground">{b.titulo}</h3>
                    <span className="ml-auto text-xs font-medium text-muted">~{b.segundos} s</span>
                  </div>
                  <div className="flex flex-col gap-2 text-[1.02rem] leading-relaxed text-foreground">
                    {b.paragrafos.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">
              Estimativas em faixa, calculadas a partir das contas de energia pelo CondoGest em {formatarData(DATA_REFERENCIA)}. As premissas
              de cada número estão na tela de energia do condomínio.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
