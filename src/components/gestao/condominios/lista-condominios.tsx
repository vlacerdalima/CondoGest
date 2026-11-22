"use client";

import { AlertTriangle, ArrowRight, Building2, House, MapPin, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { resumoDeContas, resumoDoCondominio, totalPorCompetenciaDoCondominio } from "@/lib/analise/geral";
import { COMPETENCIA_ATUAL, CONDOMINIOS, DATA_REFERENCIA, somarMeses, unidadesOcupadas } from "@/lib/dados";
import { formatarCompetencia, formatarPercentual } from "@/lib/formatacao";
import { formatarMoedaInteira } from "../formato";
import { ROTULOS_TIPO_CONDOMINIO } from "../rotulos";
import { Sparkline } from "../sparkline";
import { useCarteira } from "../use-carteira";
import { Variacao } from "../variacao";

const TOTAL_UNIDADES = CONDOMINIOS.reduce((s, c) => s + c.unidades, 0);

export function ListaCondominios() {
  const { contas, insights } = useCarteira();

  const cartoes = useMemo(
    () =>
      CONDOMINIOS.map((c) => ({
        resumo: resumoDoCondominio(contas, c),
        serie: totalPorCompetenciaDoCondominio(contas, c.id, 12).map((p) => ({ rotulo: formatarCompetencia(p.competencia), valor: p.valor })),
        alertas: insights.filter((i) => i.condominioId === c.id && (i.severidade === "critico" || i.severidade === "atencao")).length,
        ocupadas: unidadesOcupadas(c, COMPETENCIA_ATUAL),
      })),
    [contas, insights],
  );
  const carteira = useMemo(() => resumoDeContas(contas, COMPETENCIA_ATUAL, DATA_REFERENCIA, TOTAL_UNIDADES), [contas]);

  return (
    <div>
      <PageHeader
        titulo="Condomínios"
        descricao={`${CONDOMINIOS.length} condomínios na carteira · ${TOTAL_UNIDADES} unidades · gasto total de ${formatarMoedaInteira(
          carteira.gastoMes,
        )} em ${formatarCompetencia(COMPETENCIA_ATUAL)}.`}
        acoes={
          <ButtonLink href="/contas/enviar">
            <Upload aria-hidden />
            Enviar conta
          </ButtonLink>
        }
      />

      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        {cartoes.map(({ resumo, serie, alertas, ocupadas }) => {
          const c = resumo.condominio;
          const ocupacao = (ocupadas / c.unidades) * 100;
          const IconeTipo = c.tipo === "horizontal" ? House : Building2;
          return (
            <li key={c.id} className="flex flex-col rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,31,29,0.04)]">
              <div className="flex items-start gap-3 px-5 pt-5">
                <span
                  aria-hidden
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted"
                >
                  <IconeTipo className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 font-semibold text-foreground">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--chart-${c.corSerie})` }} />
                    <Link href={`/condominios/${c.slug}`} className="truncate hover:text-primary hover:underline">
                      {c.nome}
                    </Link>
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {c.bairro} · {c.cidade}/{c.uf}
                    </span>
                  </p>
                </div>
                {alertas > 0 && (
                  <Badge tom="atencao">
                    <AlertTriangle aria-hidden />
                    {alertas} {alertas === 1 ? "alerta" : "alertas"}
                  </Badge>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3 px-5">
                <div>
                  <dt className="text-xs text-muted">Gasto em {formatarCompetencia(COMPETENCIA_ATUAL)}</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{formatarMoedaInteira(resumo.gastoMes)}</dd>
                  <dd>
                    <Variacao valor={resumo.variacaoMes} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Por unidade</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{formatarMoedaInteira(resumo.porUnidadeMes)}</dd>
                  <dd className="text-xs text-muted">média 12m: {formatarMoedaInteira(resumo.porUnidade12)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted">
                    <Zap className="size-3 text-energy" aria-hidden />
                    Energia
                  </dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{formatarMoedaInteira(resumo.energiaMes)}</dd>
                  <dd className="text-xs text-muted">{formatarPercentual(resumo.participacaoEnergia)} do total</dd>
                </div>
              </dl>

              <div className="mt-3 px-3">
                <Sparkline
                  dados={serie}
                  cor={`var(--chart-${c.corSerie})`}
                  rotulo={`Gasto mensal de ${c.nome} de ${serie[0]?.rotulo} a ${serie.at(-1)?.rotulo}`}
                />
                <p className="px-2 text-[11px] text-subtle">
                  Gasto mensal · {formatarCompetencia(somarMeses(COMPETENCIA_ATUAL, -11))} a {formatarCompetencia(COMPETENCIA_ATUAL)}
                </p>
              </div>

              <div className="mt-4 px-5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted">{ROTULOS_TIPO_CONDOMINIO[c.tipo]}</span>
                  <span className="tabular text-muted">
                    <span className="font-medium text-foreground">{ocupadas}</span> de {c.unidades} unidades ocupadas
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(ocupacao)}
                  aria-label={`Ocupação: ${formatarPercentual(ocupacao, { casas: 0 })}`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${ocupacao}%` }} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-border px-5 py-3">
                <ButtonLink href={`/condominios/${c.slug}`} variante="secundaria" tamanho="sm" className="flex-1">
                  Ver detalhes
                  <ArrowRight aria-hidden />
                </ButtonLink>
                <ButtonLink href={`/energia/${c.slug}`} variante="contorno" tamanho="sm" className="flex-1">
                  <Zap className="text-energy" aria-hidden />
                  Energia
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
