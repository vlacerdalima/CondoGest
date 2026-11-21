"use client";

import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronRight,
  House,
  Lightbulb,
  ReceiptText,
  Upload,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import {
  resumoDoCondominio,
  serieMensalPorGrupo,
  totaisPorCategoria,
  ultimasCompetencias,
} from "@/lib/analise/geral";
import { COMPETENCIA_ATUAL, CONDOMINIOS, obterCondominio, obterUcsDoCondominio, somarMeses, unidadesOcupadas } from "@/lib/dados";
import { formatarCompetencia, formatarKw, formatarPercentual } from "@/lib/formatacao";
import { ItemInsightCompacto } from "../cartao-insight";
import { DistribuicaoCategorias } from "../distribuicao-categorias";
import { formatarMoedaInteira } from "../formato";
import { GraficoGastosMensais } from "../grafico-gastos";
import { ListaContasCompacta } from "../lista-contas-compacta";
import { ROTULOS_TIPO_CONDOMINIO } from "../rotulos";
import { useCarteira } from "../use-carteira";

const JANELA = ultimasCompetencias(12);

export function DetalheCondominio({ condominioId }: { condominioId: string }) {
  const condominio = obterCondominio(condominioId)!;
  const { contas, insights } = useCarteira();

  const doCondominio = useMemo(() => contas.filter((c) => c.condominioId === condominio.id), [contas, condominio.id]);
  const resumo = useMemo(() => resumoDoCondominio(contas, condominio), [contas, condominio]);
  const serie = useMemo(() => serieMensalPorGrupo(doCondominio, JANELA), [doCondominio]);
  const distribuicao = useMemo(() => {
    const janela = new Set(JANELA);
    return totaisPorCategoria(doCondominio.filter((c) => janela.has(c.competencia)));
  }, [doCondominio]);
  const mediaPares = useMemo(() => {
    const pares = CONDOMINIOS.filter((c) => c.tipo === condominio.tipo && c.id !== condominio.id);
    if (pares.length === 0) return undefined;
    return pares.reduce((s, c) => s + resumoDoCondominio(contas, c).porUnidade12, 0) / pares.length;
  }, [contas, condominio]);
  const recentes = useMemo(
    () =>
      [...doCondominio]
        .sort((a, b) => b.competencia.localeCompare(a.competencia) || b.vencimento.localeCompare(a.vencimento))
        .slice(0, 8),
    [doCondominio],
  );
  const insightsDoCondominio = insights.filter((i) => i.condominioId === condominio.id);
  const ucs = obterUcsDoCondominio(condominio.id);
  const ocupadas = unidadesOcupadas(condominio, COMPETENCIA_ATUAL);
  const ocupacao = (ocupadas / condominio.unidades) * 100;
  const totalAno = distribuicao.reduce((s, d) => s + d.valor, 0);
  const IconeTipo = condominio.tipo === "horizontal" ? House : Building2;

  return (
    <div className="space-y-6">
      <nav aria-label="Trilha" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/condominios" className="hover:text-foreground hover:underline">
          Condomínios
        </Link>
        <ChevronRight className="size-4 text-subtle" aria-hidden />
        <span aria-current="page" className="truncate text-foreground">
          {condominio.nome}
        </span>
      </nav>

      <PageHeader
        className="pb-0"
        sobretitulo={
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(--chart-${condominio.corSerie})` }} />
            {ROTULOS_TIPO_CONDOMINIO[condominio.tipo]} · {condominio.bairro}, {condominio.cidade}/{condominio.uf}
          </span>
        }
        titulo={condominio.nome}
        descricao={`${condominio.unidades} unidades · síndico(a): ${condominio.sindico}`}
        acoes={
          <>
            <ButtonLink href={`/contas?condominio=${condominio.slug}`} variante="contorno">
              <ReceiptText aria-hidden />
              Ver contas
            </ButtonLink>
            <ButtonLink href={`/contas/enviar?condominio=${condominio.slug}`} variante="contorno">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
            <ButtonLink href={`/energia/${condominio.slug}`} variante="energia">
              <Zap aria-hidden />
              Ver análise de energia
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          rotulo={`Gasto em ${formatarCompetencia(COMPETENCIA_ATUAL)}`}
          icone={<Wallet className="text-subtle" aria-hidden />}
          valor={formatarMoedaInteira(resumo.gastoMes)}
          variacao={resumo.variacaoMes}
          contexto={`vs. ${formatarCompetencia(somarMeses(COMPETENCIA_ATUAL, -1))} · média 12m ${formatarMoedaInteira(resumo.media12)}`}
        />
        <Stat
          rotulo="Custo por unidade (média 12m)"
          icone={<IconeTipo className="text-subtle" aria-hidden />}
          valor={formatarMoedaInteira(resumo.porUnidade12)}
          variacao={mediaPares ? (resumo.porUnidade12 / mediaPares - 1) * 100 : undefined}
          contexto={mediaPares ? `vs. média dos pares (${formatarMoedaInteira(mediaPares)})` : "sem pares do mesmo tipo"}
        />
        <Stat
          rotulo={`Energia em ${formatarCompetencia(COMPETENCIA_ATUAL)}`}
          icone={<Zap className="text-energy" aria-hidden />}
          valor={formatarMoedaInteira(resumo.energiaMes)}
          variacao={resumo.energiaMesAnterior ? (resumo.energiaMes / resumo.energiaMesAnterior - 1) * 100 : undefined}
          contexto={`${formatarPercentual(resumo.participacaoEnergia)} do gasto do mês`}
          destaque="energia"
        />
        <Stat
          rotulo="Contas em aberto"
          icone={<CalendarClock className="text-subtle" aria-hidden />}
          valor={formatarMoedaInteira(resumo.emAberto.valor)}
          contexto={
            <>
              {resumo.emAberto.quantidade} contas
              {resumo.vencidas.quantidade > 0 && <span className="font-medium text-critical"> · {resumo.vencidas.quantidade} vencida(s)</span>}
              {resumo.vencendo.quantidade > 0 && <span className="font-medium text-warn"> · {resumo.vencendo.quantidade} em 7 dias</span>}
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Evolução dos gastos"
            descricao={`Por categoria, de ${formatarCompetencia(JANELA[0])} a ${formatarCompetencia(COMPETENCIA_ATUAL)}`}
          />
          <CardContent>
            <GraficoGastosMensais dados={serie} rotuloAcessivel={`Gastos mensais de ${condominio.nome} por categoria`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader titulo="Informações" icone={<IconeTipo className="size-4" aria-hidden />} />
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-muted">Tipo</dt>
                  <dd className="mt-0.5 text-foreground">{ROTULOS_TIPO_CONDOMINIO[condominio.tipo]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Unidades</dt>
                  <dd className="mt-0.5 text-foreground">{condominio.unidades}</dd>
                </div>
              </div>
              <div>
                <dt className="flex items-baseline justify-between text-xs text-muted">
                  <span>Ocupação atual</span>
                  <span className="tabular">
                    <span className="font-medium text-foreground">{ocupadas}</span> de {condominio.unidades} ·{" "}
                    {formatarPercentual(ocupacao, { casas: 0 })}
                  </span>
                </dt>
                <dd className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${ocupacao}%` }} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Síndico(a)</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
                  <UserRound className="size-4 text-subtle" aria-hidden />
                  {condominio.sindico}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Áreas e equipamentos comuns</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {condominio.areasComuns.map((a) => (
                    <Badge key={a}>{a}</Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Unidades consumidoras de energia</dt>
                <dd className="mt-1.5 space-y-2">
                  {ucs.map((uc) => (
                    <div key={uc.id} className="rounded-lg border border-border px-3 py-2">
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        <Zap className="size-3.5 text-energy" aria-hidden />
                        {uc.apelido}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        UC {uc.numeroUc} · {uc.subgrupo} {uc.modalidade} · mercado {uc.ambiente}
                        {uc.demandaContratadaKw ? ` · ${formatarKw(uc.demandaContratadaKw)} contratados` : ""}
                      </p>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Para onde vai o dinheiro"
            descricao={`Últimos 12 meses · total de ${formatarMoedaInteira(totalAno)}`}
          />
          <CardContent>
            {distribuicao.length ? (
              <DistribuicaoCategorias itens={distribuicao} />
            ) : (
              <EmptyState titulo="Sem contas no período" />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            titulo="Insights do condomínio"
            descricao={`${insightsDoCondominio.length} ${insightsDoCondominio.length === 1 ? "ponto de atenção" : "pontos de atenção e oportunidades"}`}
            icone={<Lightbulb className="size-4" aria-hidden />}
          />
          <CardContent className="flex-1 px-3 pt-3 pb-2">
            {insightsDoCondominio.length === 0 ? (
              <EmptyState titulo="Nada fora do normal" descricao="Nenhum alerta para este condomínio agora." />
            ) : (
              <ul className="space-y-0.5">
                {insightsDoCondominio.slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <ItemInsightCompacto insight={i} mostrarCondominio={false} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Link
              href={`/insights?condominio=${condominio.slug}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Ver insights do condomínio
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader titulo="Contas recentes" descricao="As últimas contas lançadas para este condomínio" />
        <CardContent className="px-0 pt-3 pb-0">
          {recentes.length ? (
            <ListaContasCompacta contas={recentes} mostrarCondominio={false} />
          ) : (
            <div className="px-5 pb-5">
              <EmptyState titulo="Nenhuma conta ainda" />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Link href={`/contas?condominio=${condominio.slug}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Ver todas as contas do condomínio
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
