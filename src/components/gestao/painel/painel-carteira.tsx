"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  CloudUpload,
  Lightbulb,
  PiggyBank,
  ReceiptText,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import {
  contasEmAberto,
  economiaPotencial,
  GRUPOS_CATEGORIA,
  resumoDeContas,
  resumoDoCondominio,
  serieMensalPorGrupo,
  ultimasCompetencias,
} from "@/lib/analise/geral";
import { ADMINISTRADORA, COMPETENCIA_ATUAL, CONDOMINIOS, DATA_REFERENCIA, somarMeses } from "@/lib/dados";
import { useContasEnviadas } from "@/lib/dados/store";
import { formatarCompetencia, formatarCompetenciaLonga, formatarMoeda, formatarPercentual } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { ItemInsightCompacto } from "../cartao-insight";
import { formatarDataPorExtenso, formatarFaixaCompacta, formatarMoedaCurta, formatarMoedaInteira, maiusculaInicial } from "../formato";
import { GraficoGastosMensais } from "../grafico-gastos";
import { ListaContasCompacta } from "../lista-contas-compacta";
import { ROTULOS_TIPO_CONDOMINIO } from "../rotulos";
import { useCarteira } from "../use-carteira";
import { Variacao } from "../variacao";

const TOTAL_UNIDADES = CONDOMINIOS.reduce((s, c) => s + c.unidades, 0);
const MES_ANTERIOR = somarMeses(COMPETENCIA_ATUAL, -1);
const MES_ANO_ANTERIOR = somarMeses(COMPETENCIA_ATUAL, -12);

function Kpi({
  rotulo,
  icone,
  valor,
  children,
  destaque,
  href,
  rotuloLink,
}: {
  rotulo: string;
  icone: ReactNode;
  valor: ReactNode;
  children?: ReactNode;
  destaque?: "energia" | "primario";
  href?: string;
  rotuloLink?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,31,29,0.04)]",
        destaque === "energia" && "border-energy-strong/60 bg-energy-soft/40",
        destaque === "primario" && "border-primary/30 bg-primary-soft/40",
      )}
    >
      <p className="flex items-center gap-2 text-sm text-muted [&_svg]:size-4">
        {icone}
        <span className="truncate">{rotulo}</span>
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{valor}</p>
      <div className="mt-1.5 flex flex-1 flex-col gap-1 text-xs text-muted">{children}</div>
      {href && rotuloLink && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 self-start rounded text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {rotuloLink}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function PainelCarteira() {
  const { contas, insights } = useCarteira();
  const enviadas = useContasEnviadas();

  const resumo = useMemo(() => resumoDeContas(contas, COMPETENCIA_ATUAL, DATA_REFERENCIA, TOTAL_UNIDADES), [contas]);
  const serie = useMemo(() => serieMensalPorGrupo(contas, ultimasCompetencias(12)), [contas]);
  const linhasCondominios = useMemo(
    () =>
      CONDOMINIOS.map((c) => ({
        ...resumoDoCondominio(contas, c),
        alertas: insights.filter((i) => i.condominioId === c.id && (i.severidade === "critico" || i.severidade === "atencao")).length,
      })),
    [contas, insights],
  );
  const emAberto = useMemo(() => contasEmAberto(contas).slice(0, 7), [contas]);
  const economia = economiaPotencial(insights);
  const recentes = useMemo(
    () => [...enviadas].sort((a, b) => (b.enviadaEm ?? "").localeCompare(a.enviadaEm ?? "")).slice(0, 3),
    [enviadas],
  );

  // Que grupo mais puxou a variação do mês
  const maiorAlta = useMemo(() => {
    const atual = serie.at(-1);
    const anterior = serie.at(-2);
    if (!atual || !anterior) return undefined;
    const difs = GRUPOS_CATEGORIA.map((g) => ({ g, dif: (atual[g.id] as number) - (anterior[g.id] as number) })).sort(
      (a, b) => Math.abs(b.dif) - Math.abs(a.dif),
    );
    const top = difs[0];
    if (!top || Math.abs(top.dif) < 1) return undefined;
    const tem13 = top.g.id === "pessoal" && contas.some((c) => c.competencia === COMPETENCIA_ATUAL && c.descricao.startsWith("13º"));
    return { ...top, tem13 };
  }, [serie, contas]);

  const primeiroNome = ADMINISTRADORA.gestor.nome.split(" ")[0];
  const dataExtenso = formatarDataPorExtenso(DATA_REFERENCIA);

  return (
    <div className="space-y-6">
      <PageHeader
        className="pb-0"
        sobretitulo={maiusculaInicial(dataExtenso)}
        titulo={`Olá, ${primeiroNome}`}
        descricao={
          <>
            Este é o resumo da carteira da {ADMINISTRADORA.nome}: {CONDOMINIOS.length} condomínios e {TOTAL_UNIDADES} unidades.
            Valores de <span className="font-medium text-foreground">{formatarCompetenciaLonga(COMPETENCIA_ATUAL)}</span>.
          </>
        }
        acoes={
          <>
            <ButtonLink href="/contas" variante="contorno">
              <ReceiptText aria-hidden />
              Ver contas
            </ButtonLink>
            <ButtonLink href="/contas/enviar">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
          </>
        }
      />

      {resumo.vencidas.quantidade > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-critical/30 bg-critical-soft px-4 py-3">
          <AlertOctagon className="size-5 shrink-0 text-critical" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">
              {resumo.vencidas.quantidade} {resumo.vencidas.quantidade === 1 ? "conta vencida" : "contas vencidas"} sem pagamento
            </span>{" "}
            <span className="text-muted">· {formatarMoeda(resumo.vencidas.valor)} · evite multa, juros e corte de fornecimento.</span>
          </p>
          <Link
            href="/contas?status=vencida"
            className="inline-flex items-center gap-1 text-sm font-medium text-critical hover:underline focus-visible:outline-2 focus-visible:outline-critical"
          >
            Ver vencidas
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo={`Gasto total em ${formatarCompetencia(COMPETENCIA_ATUAL)}`} icone={<Wallet className="text-subtle" aria-hidden />} valor={formatarMoedaInteira(resumo.gastoMes)}>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <Variacao valor={resumo.variacaoMes} rotulo={`vs. ${formatarCompetencia(MES_ANTERIOR)}`} />
            <Variacao valor={resumo.variacaoAno} rotulo={`vs. ${formatarCompetencia(MES_ANO_ANTERIOR)}`} />
          </span>
          {maiorAlta && (
            <span>
              {maiorAlta.dif > 0 ? "Maior alta" : "Maior queda"}: {maiorAlta.g.rotulo} ({maiorAlta.dif > 0 ? "+" : ""}
              {formatarMoedaCurta(maiorAlta.dif)}){maiorAlta.tem13 && " — inclui o 13º salário"}
            </span>
          )}
        </Kpi>

        <Kpi
          rotulo={`Energia em ${formatarCompetencia(COMPETENCIA_ATUAL)}`}
          icone={<Zap className="text-energy" aria-hidden />}
          valor={formatarMoedaInteira(resumo.energiaMes)}
          destaque="energia"
          href="/energia"
          rotuloLink="Ver análise de energia"
        >
          <Variacao
            valor={resumo.energiaMesAnterior ? ((resumo.energiaMes / resumo.energiaMesAnterior) - 1) * 100 : undefined}
            rotulo={`vs. ${formatarCompetencia(MES_ANTERIOR)}`}
          />
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-energy-soft" aria-hidden>
              <span className="block h-full rounded-full bg-energy-strong" style={{ width: `${Math.min(100, resumo.participacaoEnergia)}%` }} />
            </span>
            <span className="tabular font-medium text-foreground">{formatarPercentual(resumo.participacaoEnergia)}</span>
            <span>do gasto total</span>
          </span>
        </Kpi>

        <Kpi
          rotulo="Para pagar agora"
          icone={<CalendarClock className="text-subtle" aria-hidden />}
          valor={formatarMoedaInteira(resumo.vencidas.valor + resumo.vencendo.valor)}
          href={resumo.vencidas.quantidade ? "/contas?status=vencida" : "/contas?status=vence_em_breve"}
          rotuloLink="Ver contas"
        >
          <span className="flex items-center gap-1.5">
            <AlertOctagon className={cn("size-3.5", resumo.vencidas.quantidade ? "text-critical" : "text-subtle")} aria-hidden />
            <span className="font-medium text-foreground">
              {resumo.vencidas.quantidade} {resumo.vencidas.quantidade === 1 ? "vencida" : "vencidas"}
            </span>
            <span className="tabular">· {formatarMoedaInteira(resumo.vencidas.valor)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-warn" aria-hidden />
            <span className="font-medium text-foreground">{resumo.vencendo.quantidade} vencem em 7 dias</span>
            <span className="tabular">· {formatarMoedaInteira(resumo.vencendo.valor)}</span>
          </span>
        </Kpi>

        <Kpi
          rotulo="Economia potencial"
          icone={<PiggyBank className="text-primary" aria-hidden />}
          valor={
            economia.quantidade ? (
              <>
                {formatarFaixaCompacta(economia)}
                <span className="text-sm font-medium text-muted">/mês</span>
              </>
            ) : (
              "—"
            )
          }
          destaque="primario"
          href="/insights"
          rotuloLink="Ver insights"
        >
          <span>
            Soma do impacto estimado de {economia.quantidade} {economia.quantidade === 1 ? "insight" : "insights"} — o que dá para
            economizar agindo neles.
          </span>
        </Kpi>
      </div>

      {/* Gráfico + insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Gastos dos últimos 12 meses"
            descricao={`Soma da carteira por categoria, de ${formatarCompetencia(ultimasCompetencias(12)[0])} a ${formatarCompetencia(COMPETENCIA_ATUAL)}`}
          />
          <CardContent>
            <GraficoGastosMensais dados={serie} altura={330} rotuloAcessivel="Gastos mensais da carteira por categoria, últimos 12 meses" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            titulo="Principais insights"
            descricao="O que pede atenção primeiro"
            icone={<Lightbulb className="size-4" aria-hidden />}
          />
          <CardContent className="flex-1 px-3 pt-3 pb-2">
            {insights.length === 0 ? (
              <EmptyState titulo="Nenhum alerta por aqui" descricao="Quando algo fugir do normal, aparece aqui." />
            ) : (
              <ul className="space-y-0.5">
                {insights.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <ItemInsightCompacto insight={i} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/insights" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Ver todos os {insights.length} insights
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Condomínios */}
      <Card>
        <CardHeader
          titulo="Condomínios da carteira"
          descricao={`Gasto de ${formatarCompetencia(COMPETENCIA_ATUAL)}, comparado com ${formatarCompetencia(MES_ANTERIOR)}`}
          acoes={
            <ButtonLink href="/condominios" variante="fantasma" tamanho="sm">
              Ver todos
              <ArrowRight aria-hidden />
            </ButtonLink>
          }
        />
        <CardContent className="px-0 pb-2">
          {/* Tabela (telas médias e grandes) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Resumo por condomínio</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th scope="col" className="px-5 py-2 text-left font-medium">
                    Condomínio
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Gasto no mês
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Variação
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Por unidade
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Energia
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">
                    Alertas
                  </th>
                  <th scope="col" className="w-10 px-3 py-2">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linhasCondominios.map((l) => (
                  <tr key={l.condominio.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--chart-${l.condominio.corSerie})` }} />
                        <div className="min-w-0">
                          <Link href={`/condominios/${l.condominio.slug}`} className="font-medium text-foreground hover:text-primary hover:underline">
                            {l.condominio.nome}
                          </Link>
                          <p className="text-xs text-muted">
                            {ROTULOS_TIPO_CONDOMINIO[l.condominio.tipo]} · {l.condominio.unidades} unidades
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium text-foreground">{formatarMoedaInteira(l.gastoMes)}</td>
                    <td className="px-3 py-3 text-right">
                      <Variacao valor={l.variacaoMes} />
                    </td>
                    <td className="tabular px-3 py-3 text-right text-foreground">{formatarMoedaInteira(l.porUnidadeMes)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="tabular block text-foreground">{formatarMoedaInteira(l.energiaMes)}</span>
                      <span className="tabular text-xs text-muted">{formatarPercentual(l.participacaoEnergia)} do total</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {l.alertas > 0 ? (
                        <Badge tom="atencao">
                          <AlertTriangle aria-hidden />
                          {l.alertas} {l.alertas === 1 ? "alerta" : "alertas"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-subtle">Nenhum</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/condominios/${l.condominio.slug}`}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-primary"
                        aria-label={`Abrir ${l.condominio.nome}`}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões (celular) */}
          <ul className="divide-y divide-border md:hidden">
            {linhasCondominios.map((l) => (
              <li key={l.condominio.id}>
                <Link href={`/condominios/${l.condominio.slug}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2/60">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: `var(--chart-${l.condominio.corSerie})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{l.condominio.nome}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="tabular font-medium text-foreground">{formatarMoedaInteira(l.gastoMes)}</span>
                      <Variacao valor={l.variacaoMes} />
                      <span className="tabular">{formatarMoedaInteira(l.porUnidadeMes)}/unid.</span>
                      <span className="tabular inline-flex items-center gap-1">
                        <Zap className="size-3 text-energy" aria-hidden />
                        {formatarPercentual(l.participacaoEnergia)}
                      </span>
                    </span>
                  </span>
                  {l.alertas > 0 && (
                    <Badge tom="atencao">
                      <AlertTriangle aria-hidden />
                      {l.alertas}
                      <span className="sr-only">{l.alertas === 1 ? "alerta" : "alertas"}</span>
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Vencimentos + envio */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Próximos vencimentos"
            descricao="Contas em aberto, das mais urgentes para as mais distantes"
            icone={<CalendarClock className="size-4" aria-hidden />}
          />
          <CardContent className="px-0 pt-3 pb-0">
            {emAberto.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState titulo="Tudo em dia" descricao="Não há contas em aberto na carteira." />
              </div>
            ) : (
              <ListaContasCompacta contas={emAberto} />
            )}
          </CardContent>
          <CardFooter>
            <Link href="/contas?status=em_aberto" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Ver todas as {resumo.emAberto.quantidade} contas em aberto
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="bg-primary-soft/60 px-5 py-6">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CloudUpload className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">Recebeu uma conta nova?</h2>
            <p className="mt-1 text-sm text-muted">
              Arraste o PDF ou a foto da conta: o CondoGest lê os dados, você confere e o painel se atualiza na hora.
            </p>
            <ButtonLink href="/contas/enviar" tamanho="lg" className="mt-5 w-full">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Enviadas recentemente</p>
            {recentes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Você ainda não enviou contas por aqui.</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-border">
                  {recentes.map((c) => (
                    <li key={c.id}>
                      <Link href={`/contas?conta=${encodeURIComponent(c.id)}`} className="group flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{c.descricao}</span>
                          <span className="block truncate text-xs text-muted">
                            {CONDOMINIOS.find((x) => x.id === c.condominioId)?.nome} · {formatarCompetencia(c.competencia)}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-sm text-foreground">{formatarMoeda(c.valor)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/contas?origem=envio" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Ver todas as enviadas ({enviadas.length})
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
