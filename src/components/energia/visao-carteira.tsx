"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, ChevronRight, Lightbulb, Minus, Receipt, Scale, Trophy, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { SeveridadeBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { insightsDasAnalises, resumirCarteiraEnergia, type LinhaCarteiraEnergia } from "@/lib/analise/energia";
import { CONDOMINIOS } from "@/lib/dados";
import { useContas } from "@/lib/dados/store";
import { formatarCompetencia, formatarCompetenciaLonga, formatarKwhDia, formatarNumero, formatarTarifa } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { ItemRecomendacao } from "./cartao-recomendacao";
import { corSerie, faixaReais, pct, reais, reaisCompacto } from "./formato";
import { Termo } from "./glossario";
import { GraficoCustoEmpilhado, type LinhaEmpilhada } from "./graficos-energia";

function Variacao({ valor }: { valor?: number }) {
  if (valor === undefined || !Number.isFinite(valor)) return <span className="text-muted">—</span>;
  const neutro = Math.abs(valor) < 0.05;
  const Icone = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", neutro ? "text-muted" : valor > 0 ? "text-critical" : "text-ok")}>
      <Icone className="size-3.5" aria-hidden />
      {pct(valor, 1, true)}
      <span className="sr-only">{neutro ? " (dentro do normal)" : valor > 0 ? " (acima da linha de base)" : " (abaixo da linha de base)"}</span>
    </span>
  );
}

function TabelaRanking({ linhas }: { linhas: LinhaCarteiraEnergia[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">Condomínios ordenados pela economia potencial de energia</caption>
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 pl-5 text-left font-medium">Condomínio</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Consumo por dia</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              vs. <Termo id="linhaDeBase">linha de base</Termo>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Custo do mês</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Por unidade ocupada</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Ações</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Economia potencial</th>
            <th scope="col" className="py-2 pr-5 pl-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody className="tabular">
          {linhas.map((l) => (
            <tr key={l.condominio.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
              <th scope="row" className="py-3 pr-3 pl-5 text-left font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: corSerie(l.condominio.corSerie) }} aria-hidden />
                  <span className="min-w-0">
                    <Link href={`/energia/${l.condominio.slug}`} className="hover:underline">
                      {l.condominio.nome}
                    </Link>
                    <span className="block text-xs font-normal text-muted">
                      {l.analise.ucs.filter((u) => u.meses.length).map((u) => u.descricao).join(" + ") || "sem contas"}
                    </span>
                  </span>
                  {l.anomaliaAtiva && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn">
                      <AlertTriangle className="size-3" aria-hidden />
                      anomalia
                    </span>
                  )}
                </span>
              </th>
              <td className="px-3 py-3 text-right whitespace-nowrap text-foreground">{l.kwhDia !== undefined ? formatarKwhDia(l.kwhDia) : "—"}</td>
              <td className="px-3 py-3 text-right whitespace-nowrap">
                <Variacao valor={l.variacaoVsBase} />
              </td>
              <td className="px-3 py-3 text-right whitespace-nowrap text-foreground">{l.custo !== undefined ? reais(l.custo) : "—"}</td>
              <td className="px-3 py-3 text-right whitespace-nowrap text-foreground">
                {l.custoPorUnidade !== undefined ? reais(l.custoPorUnidade) : "—"}
                {l.ocupadas ? <span className="block text-xs text-muted">{formatarNumero(l.ocupadas)} ocupadas</span> : null}
              </td>
              <td className="px-3 py-3 text-right text-foreground">{l.recomendacoes}</td>
              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-foreground">
                {l.recomendacoes ? `${faixaReais(l.economiaPotencial)}/mês` : "—"}
              </td>
              <td className="py-3 pr-5 pl-3 text-right">
                <Link
                  href={`/energia/${l.condominio.slug}`}
                  className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
                  aria-label={`Abrir energia de ${l.condominio.nome}`}
                >
                  Abrir
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VisaoCarteiraEnergia() {
  const contas = useContas();
  const resumo = useMemo(() => resumirCarteiraEnergia(contas, CONDOMINIOS), [contas]);
  const insights = useMemo(() => insightsDasAnalises(resumo.linhas.map((l) => l.analise)), [resumo]);
  const linhasOrdenadas = [...resumo.linhas].sort(
    (a, b) => b.economiaPotencial.max - a.economiaPotencial.max || (b.custo ?? 0) - (a.custo ?? 0),
  );
  const condominiosComAcao = resumo.linhas.filter((l) => l.recomendacoes > 0).length;

  const series = CONDOMINIOS.map((c) => ({ chave: c.id, nome: c.nome, cor: corSerie(c.corSerie) })).filter((s) =>
    resumo.serieCusto.some((m) => m.porCondominio[s.chave] !== undefined),
  );
  const linhasCusto: LinhaEmpilhada[] = resumo.serieCusto.map((m) => ({
    competencia: m.competencia,
    rotulo: formatarCompetencia(m.competencia),
    total: m.total,
    ...m.porCondominio,
  }));
  const mediaCusto = linhasCusto.length ? linhasCusto.reduce((s, l) => s + l.total, 0) / linhasCusto.length : 0;

  if (!resumo.competencia) {
    return (
      <>
        <PageHeader titulo="Energia da carteira" />
        <EmptyState
          icone={<Zap />}
          titulo="Ainda não há contas de energia"
          descricao="Envie as contas de energia dos condomínios para ver consumo por dia, linha de base e recomendações."
          acao={
            <ButtonLink href="/contas/enviar">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="pb-0"
        sobretitulo={
          <span className="inline-flex items-center gap-1.5 text-energy">
            <Zap className="size-4" aria-hidden />
            Foco do CondoGest
          </span>
        }
        titulo="Energia da carteira"
        descricao={
          <>
            Consumo por dia, <Termo id="linhaDeBase">linha de base</Termo> e recomendações com número para os {CONDOMINIOS.length}{" "}
            condomínios. Último mês completo em todos: {formatarCompetenciaLonga(resumo.competencia)}.
            {resumo.contasEnviadas > 0 && ` Inclui ${resumo.contasEnviadas} ${resumo.contasEnviadas === 1 ? "conta enviada" : "contas enviadas"} por você.`}
          </>
        }
      />

      {/* Destaque */}
      <div className="flex flex-col gap-3 rounded-xl border border-energy-strong/60 bg-energy-soft/50 p-5 sm:flex-row sm:items-center">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-energy-strong text-[#2b1d00]">
          <Lightbulb className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Economia potencial identificada na carteira</p>
          <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {faixaReais(resumo.economiaPotencial)}
            <span className="text-base font-medium text-muted"> por mês</span>
          </p>
          <p className="text-sm text-foreground">
            {reaisCompacto(resumo.economiaPotencial.min * 12)} a {reaisCompacto(resumo.economiaPotencial.max * 12)} por ano ·{" "}
            {resumo.recomendacoes.length} ações em {condominiosComAcao} condomínios
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat
          icone={<Receipt aria-hidden />}
          rotulo={`Gasto com energia · ${formatarCompetencia(resumo.competencia)}`}
          valor={reais(resumo.gasto)}
          variacao={resumo.variacaoGasto !== undefined ? resumo.variacaoGasto * 100 : undefined}
          bomQuando="cair"
          contexto="vs. média de 12 meses"
        />
        <Stat
          icone={<Zap className="text-energy" aria-hidden />}
          rotulo={`Consumo · ${formatarCompetencia(resumo.competencia)}`}
          valor={`${formatarNumero(resumo.kwh)} kWh`}
          contexto={`${formatarKwhDia(resumo.kwhDia)} somando os condomínios`}
        />
        <Stat
          icone={<Scale aria-hidden />}
          rotulo="Preço médio do kWh"
          valor={formatarTarifa(resumo.reaisPorKwh)}
          contexto="tudo incluído, média da carteira"
        />
        <Stat
          destaque="primario"
          icone={<Trophy aria-hidden />}
          rotulo={
            <>
              Economia do <Termo id="mercadoLivre">mercado livre</Termo>
            </>
          }
          valor={reais(resumo.economiaLivre12m)}
          contexto={resumo.ucsNoLivre ? `últimos 12 meses · ${resumo.ucsNoLivre} ${resumo.ucsNoLivre === 1 ? "conta" : "contas"}` : "nenhuma conta no livre"}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Custo de energia por condomínio"
          descricao={`Últimos 12 meses, em reais. Média da carteira: ${reais(mediaCusto)} por mês.`}
          icone={<Receipt className="size-5" aria-hidden />}
        />
        <CardContent>
          <GraficoCustoEmpilhado
            linhas={linhasCusto}
            series={series}
            rotulo="Custo mensal de energia por condomínio, últimos 12 meses"
            altura={280}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          titulo="Ranking de condomínios"
          descricao="Ordenado pela economia potencial. Consumo por dia do último mês completo, comparado com a linha de base ajustada pela ocupação."
          icone={<Trophy className="size-5" aria-hidden />}
        />
        <div className="pt-3 pb-1">
          <TabelaRanking linhas={linhasOrdenadas} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Principais recomendações"
            descricao="As ações de maior retorno da carteira, com economia em faixa."
            icone={<Lightbulb className="size-5 text-energy" aria-hidden />}
          />
          <CardContent className="px-2 pt-3">
            {resumo.recomendacoes.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {resumo.recomendacoes.slice(0, 6).map((r) => (
                  <ItemRecomendacao key={`${r.condominioId}-${r.id}`} rec={r} condominioNome={r.condominio.nome} href={`/energia/${r.condominio.slug}#recomendacoes`} />
                ))}
              </ul>
            ) : (
              <p className="px-3 text-sm text-muted">Nenhuma recomendação com os dados atuais.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            titulo="Alertas de energia"
            descricao="O que mudou nas contas e merece atenção."
            icone={<Bell className="size-5" aria-hidden />}
          />
          <CardContent className="px-2 pt-3">
            {insights.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {insights.slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <Link
                      href={i.href ?? "/energia"}
                      className="group flex flex-col gap-1 rounded-lg px-3 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SeveridadeBadge severidade={i.severidade} />
                        {i.impactoMensal && i.impactoMensal.max > 0 && (
                          <span className="tabular text-xs font-medium text-muted">{faixaReais(i.impactoMensal)}/mês</span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{i.titulo}</p>
                      <p className="text-sm text-muted">{i.descricao}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 text-sm text-muted">Nenhum alerta de energia.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
