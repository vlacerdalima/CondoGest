"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CalendarRange,
  Flag,
  Gauge,
  Info,
  Lightbulb,
  Presentation,
  Receipt,
  Scale,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import {
  analisarCondominio,
  calcularLinhaDeBase,
  competenciasEntre,
  linhaDeBaseAjustada,
  resumirBandeiras,
  soma,
  somarEconomias,
  type AnaliseEnergiaCondominio,
  type AnaliseUc,
  type PontoAvaliado,
  type PontoSerie,
} from "@/lib/analise/energia";
import { obterCondominio } from "@/lib/dados";
import { somarMeses } from "@/lib/dados/referencia";
import { useContas } from "@/lib/dados/store";
import {
  formatarCompetencia,
  formatarKw,
  formatarKwhDia,
  formatarMoeda,
  formatarNumero,
  formatarNumero1,
  formatarTarifa,
} from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { CartaoRecomendacao } from "./cartao-recomendacao";
import { Comprovacao } from "./comprovacao";
import { corSerie, faixaReais, pct, reais } from "./formato";
import { CardGlossario, Termo } from "./glossario";
import {
  GraficoConsumo,
  GraficoCustoEmpilhado,
  GraficoDemanda,
  GraficoMercadoLivre,
  type LinhaConsumo,
  type LinhaEmpilhada,
} from "./graficos-energia";
import { ImpactoBandeiras, PontaForaPonta, SeloBandeira } from "./secoes-energia";

/* ------------------------------------------------------------------ */
/* KPIs de uma seleção (todas as contas ou uma UC)                     */
/* ------------------------------------------------------------------ */

function kpisDaSelecao(serie: PontoSerie[], avaliacao: PontoAvaliado[], ate?: string) {
  const completos = serie.filter((p) => p.completo && p.kwh > 0 && (!ate || p.competencia <= ate));
  const p = completos[completos.length - 1];
  if (!p) return null;
  const anomalos = new Set(avaliacao.filter((a) => a.status === "alta" || a.status === "queda").map((a) => a.competencia));
  const linha = calcularLinhaDeBase(
    serie.map((x) => ({ competencia: x.competencia, valor: x.kwhDia, ocupadas: x.ocupadas, anomalo: anomalos.has(x.competencia) })),
    p.competencia,
  );
  const anteriores = completos.filter((x) => x.competencia < p.competencia && x.competencia >= somarMeses(p.competencia, -12));
  const custoMedio = anteriores.length ? soma(anteriores.map((x) => x.custo)) / anteriores.length : undefined;
  const base = linha ? linhaDeBaseAjustada(linha, p.ocupadas) : undefined;
  return {
    ponto: p,
    linha,
    baseAjustada: base,
    variacaoBase: base ? (p.kwhDia / base - 1) * 100 : undefined,
    custoMedio,
    variacaoCusto: custoMedio ? (p.custo / custoMedio - 1) * 100 : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function SeletorUc({
  analise,
  valor,
  onChange,
  corTotal,
  corDaUc,
}: {
  analise: AnaliseEnergiaCondominio;
  valor: string;
  onChange: (v: string) => void;
  corTotal: string;
  corDaUc: (ucId?: string) => string;
}) {
  const ucs = analise.ucs.filter((u) => u.meses.length);
  if (ucs.length <= 1) return null;
  const opcoes = [
    { id: "todas", titulo: "Todas as contas", sub: `${ucs.length} contas somadas`, cor: corTotal },
    ...ucs.map((u) => ({ id: u.uc.id, titulo: u.uc.apelido, sub: u.descricao, cor: corDaUc(u.uc.id) })),
  ];
  return (
    <div role="radiogroup" aria-label="Conta de energia" className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const ativo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              ativo ? "border-primary bg-primary-soft/60" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: o.cor }} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{o.titulo}</span>
              <span className="block truncate text-xs text-muted">{o.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Medidor({ usado, total }: { usado: number; total: number }) {
  const parte = total > 0 ? Math.min(1, usado / total) : 0;
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-energy-soft" role="img" aria-label={`${pct(parte)} da demanda contratada usada no pico`}>
      <div className="h-full rounded-full bg-energy" style={{ width: `${parte * 100}%` }} />
    </div>
  );
}

function Secao({ id, titulo, descricao, icone, children, acoes }: {
  id?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: React.ReactNode;
  children: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader titulo={titulo} descricao={descricao} icone={icone} acoes={acoes} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tela                                                                */
/* ------------------------------------------------------------------ */

export function EnergiaCondominio({ condominioId }: { condominioId: string }) {
  const contas = useContas();
  const condominio = obterCondominio(condominioId)!;
  const analise = useMemo(() => analisarCondominio(condominio, contas), [condominio, contas]);
  const [selecaoBruta, setSelecao] = useState("todas");
  const [porCasa, setPorCasa] = useState(false);
  const [recSelecionada, setRecSelecionada] = useState<string>();

  const ucsComDados = analise.ucs.filter((u) => u.meses.length);
  const selecao = ucsComDados.some((u) => u.uc.id === selecaoBruta) ? selecaoBruta : "todas";
  const ucSel = analise.ucs.find((u) => u.uc.id === selecao);
  const ucsSel = ucSel ? [ucSel] : ucsComDados;
  // Cor segue a entidade: o condomínio usa a sua cor (a mesma da carteira); cada conta,
  // as posições seguintes da paleta, em ordem fixa, pulando a cor do condomínio.
  const corTotal = corSerie(condominio.corSerie);
  const posicoesUc = [1, 2, 3, 4, 5, 6, 7].filter((i) => i !== condominio.corSerie);
  const corDaUc = (ucId?: string) => {
    const u = analise.ucs.find((x) => x.uc.id === ucId);
    if (!u || ucsComDados.length <= 1) return corTotal;
    return corSerie(posicoesUc[(u.ordem - 1) % posicoesUc.length]);
  };
  const corSel = ucSel ? corDaUc(ucSel.uc.id) : corTotal;
  const horizontal = condominio.tipo === "horizontal";
  const usarPorCasa = horizontal && porCasa;
  const ocupadasHoje = analise.kpis.ocupadas;

  const serieSel = ucSel?.serie ?? analise.serie;
  const avaliacaoSel = ucSel?.avaliacao ?? analise.avaliacao;
  const kpis = useMemo(() => kpisDaSelecao(serieSel, avaliacaoSel, analise.ultimoMesCompleto), [serieSel, avaliacaoSel, analise.ultimoMesCompleto]);

  const recomendacoes = useMemo(
    () => (ucSel ? analise.recomendacoes.filter((r) => !r.ucId || r.ucId === ucSel.uc.id) : analise.recomendacoes),
    [analise.recomendacoes, ucSel],
  );
  const potencialSel = somarEconomias(recomendacoes);

  /* ---------- consumo (24 meses) ---------- */
  const linhasConsumo: LinhaConsumo[] = useMemo(() => {
    const ultimos = avaliacaoSel.slice(-24);
    const porComp = new Map(serieSel.map((p) => [p.competencia, p]));
    const anomaliasUc = new Map<string, { texto: string; critico: boolean }[]>();
    if (!ucSel) {
      for (const u of ucsComDados) {
        for (const a of u.avaliacao) {
          if (a.status !== "alta") continue;
          const lista = anomaliasUc.get(a.competencia) ?? [];
          lista.push({ texto: `${u.uc.apelido.replace(/^.*—\s*/, "")} ${pct(a.desvio ?? 0, 0, true)}`, critico: a.severidade === "critico" });
          anomaliasUc.set(a.competencia, lista);
        }
      }
    }
    return ultimos.map((a) => {
      const div = usarPorCasa && a.ocupadas > 0 ? a.ocupadas : 1;
      const ucAnom = anomaliasUc.get(a.competencia);
      const status = a.status === "alta" || a.status === "queda" ? a.status : ucAnom ? "alta" : undefined;
      return {
        competencia: a.competencia,
        rotulo: formatarCompetencia(a.competencia),
        valor: a.valor / div,
        esperado: a.esperado !== null ? a.esperado / div : undefined,
        faixa: a.faixaMin !== null && a.faixaMax !== null ? ([a.faixaMin / div, a.faixaMax / div] as [number, number]) : undefined,
        desvio: a.desvio ?? undefined,
        dias: a.dias,
        ocupadas: a.ocupadas,
        status,
        severidade: a.severidade ?? (ucAnom?.some((x) => x.critico) ? "critico" : ucAnom ? "atencao" : undefined),
        detalhe: ucAnom?.map((x) => x.texto).join(", "),
        parcial: porComp.get(a.competencia) ? !porComp.get(a.competencia)!.completo : false,
      };
    });
  }, [avaliacaoSel, serieSel, ucSel, ucsComDados, usarPorCasa]);

  /* ---------- custo (24 meses) ---------- */
  const seriesCusto = ucsSel.map((u) => ({ chave: u.uc.id, nome: u.uc.apelido, cor: corDaUc(u.uc.id) }));
  // Só meses com todas as faturas: um mês com conta faltando pareceria uma queda de custo
  const linhasCusto: LinhaEmpilhada[] = serieSel.filter((p) => p.completo).slice(-24).map((p) => {
    const linha: LinhaEmpilhada = { competencia: p.competencia, rotulo: formatarCompetencia(p.competencia), total: p.custo };
    for (const u of ucsSel) linha[u.uc.id] = analise.serie.find((x) => x.competencia === p.competencia)?.porUc[u.uc.id]?.custo;
    linha.reaisPorKwh = p.reaisPorKwh;
    linha.kwh = p.kwh;
    return linha;
  });
  const janela = new Set(analise.competenciasJanela);
  const gasto12m = soma(serieSel.filter((p) => janela.has(p.competencia)).map((p) => p.custo));

  const bandeirasSel = useMemo(
    () => (ucSel ? resumirBandeiras(analise.dados.filter((d) => d.uc.id === ucSel.uc.id), analise.competenciasJanela) : analise.bandeiras),
    [analise, ucSel],
  );
  const ucsA4 = ucsSel.filter((u) => u.uc.subgrupo === "A4" && u.meses.some((m) => m.demandaContratadaKw !== undefined));
  const ucsLivre = ucsSel.filter((u) => u.mercadoLivre);
  const mesA4 = ucsA4.length === 1 ? ucsA4[0].ultimoMes : undefined;

  const selecionarParaComprovar = (id: string) => {
    setRecSelecionada(id);
    document.getElementById("comprovacao")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const historico = analise.serie.filter((p) => p.kwh > 0);
  const hrefAssembleia = `/energia/${condominio.slug}/assembleia`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="pb-0"
        sobretitulo={
          <Link href="/energia" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            Energia da carteira
          </Link>
        }
        titulo={condominio.nome}
        descricao={
          <>
            {horizontal ? "Condomínio de casas" : "Condomínio vertical"} · {formatarNumero(condominio.unidades)}{" "}
            {horizontal ? "lotes" : "unidades"}
            {ocupadasHoje ? ` · ${formatarNumero(ocupadasHoje)} ocupadas` : ""} · {condominio.bairro}, {condominio.cidade}/{condominio.uf}
          </>
        }
        acoes={
          <ButtonLink href={hrefAssembleia} variante="energia">
            <Presentation aria-hidden />
            Preparar fala para assembleia
          </ButtonLink>
        }
      />

      {/* Situação dos dados */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          {historico.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-4" aria-hidden />
              Contas de {formatarCompetencia(historico[0].competencia)} a {formatarCompetencia(historico[historico.length - 1].competencia)} (
              {historico.length} meses)
            </span>
          )}
          {analise.ultimoMesCompleto && (
            <span className="inline-flex items-center gap-1.5">
              <Receipt className="size-4" aria-hidden />
              Último mês completo: {formatarCompetencia(analise.ultimoMesCompleto)}
            </span>
          )}
          {analise.contasEnviadas > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Upload className="size-4" aria-hidden />
              {analise.contasEnviadas} {analise.contasEnviadas === 1 ? "conta enviada" : "contas enviadas"} por você
            </span>
          )}
        </div>
        {analise.avisos.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {analise.avisos.map((a) => (
              <li
                key={a.texto}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                  a.tom === "atencao" ? "bg-warn-soft text-foreground" : "bg-surface-2 text-muted",
                )}
              >
                {a.tom === "atencao" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                {a.texto}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!historico.length ? (
        <EmptyState
          icone={<Zap />}
          titulo="Sem contas de energia ainda"
          descricao="Envie as contas de energia deste condomínio para ver o consumo por dia, a linha de base e as recomendações."
          acao={
            <ButtonLink href="/contas/enviar">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Destaque: economia potencial */}
          {analise.recomendacoes.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-energy-strong/60 bg-energy-soft/50 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-energy-strong text-[#2b1d00]">
                <Lightbulb className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">
                  Economia potencial identificada em {analise.recomendacoes.length}{" "}
                  {analise.recomendacoes.length === 1 ? "ação" : "ações"}
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {faixaReais(analise.economiaPotencial)}
                  <span className="text-base font-medium text-muted"> por mês</span>
                </p>
                <p className="text-sm text-foreground">
                  Primeira ação: <strong>{analise.recomendacoes[0].titulo}</strong> ({faixaReais(analise.recomendacoes[0].economiaMensalReais)}/mês)
                </p>
              </div>
              <a
                href="#recomendacoes"
                className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary sm:self-center"
              >
                Ver recomendações
                <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
          )}

          {/* Filtro de conta: vale para tudo abaixo */}
          <SeletorUc analise={analise} valor={selecao} onChange={setSelecao} corTotal={corTotal} corDaUc={corDaUc} />

          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
              <Stat
                destaque="energia"
                icone={<Zap className="text-energy" aria-hidden />}
                rotulo={`Consumo por dia · ${formatarCompetencia(kpis.ponto.competencia)}`}
                valor={formatarKwhDia(kpis.ponto.kwhDia)}
                variacao={kpis.variacaoBase}
                bomQuando="cair"
                contexto={
                  kpis.baseAjustada ? (
                    <>
                      vs. <Termo id="linhaDeBase">linha de base</Termo> ({formatarNumero1(kpis.baseAjustada)}){kpis.linha?.parcial ? " · parcial" : ""}
                    </>
                  ) : (
                    "sem linha de base ainda"
                  )
                }
              />
              <Stat
                icone={<Receipt aria-hidden />}
                rotulo={`Custo do mês · ${formatarCompetencia(kpis.ponto.competencia)}`}
                valor={reais(kpis.ponto.custo)}
                variacao={kpis.variacaoCusto}
                bomQuando="cair"
                contexto="vs. média de 12 meses"
              />
              <Stat
                icone={<Scale aria-hidden />}
                rotulo="Preço médio do kWh"
                valor={formatarTarifa(kpis.ponto.reaisPorKwh)}
                contexto={
                  horizontal && kpis.ponto.ocupadas
                    ? `${reais(kpis.ponto.custoPorUnidade)} por casa ocupada no mês`
                    : "tudo incluído: demanda, impostos, iluminação"
                }
              />
              {mesA4?.demandaContratadaKw ? (
                <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Gauge className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      <Termo id="demandaContratada">Demanda</Termo> no pico
                    </span>
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-foreground">
                    {formatarNumero(mesA4.demandaMedidaKw ?? 0)}
                    <span className="text-base font-medium text-muted"> de {formatarKw(mesA4.demandaContratadaKw)}</span>
                  </div>
                  <Medidor usado={mesA4.demandaMedidaKw ?? 0} total={mesA4.demandaContratadaKw} />
                  <p className="text-xs text-muted">pico de {formatarCompetencia(mesA4.competencia)} · o restante é pago sem uso</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Flag className="size-4" aria-hidden />
                    <Termo id="bandeira">Bandeira</Termo> do mês
                  </div>
                  <div className="pt-1">
                    <SeloBandeira bandeira={kpis.ponto.bandeira} className="text-sm" />
                  </div>
                  <p className="text-xs text-muted">
                    {kpis.ponto.custoBandeira > 0
                      ? `+${reais(kpis.ponto.custoBandeira)} na conta do mês`
                      : ucsSel.every((u) => u.uc.ambiente === "livre")
                        ? "mercado livre: não paga bandeira"
                        : "sem acréscimo neste mês"}
                  </p>
                </div>
              )}
            </div>
          )}
          {kpis && mesA4?.demandaContratadaKw !== undefined && (
            <p className="-mt-3 text-sm text-muted">
              Bandeira de {formatarCompetencia(kpis.ponto.competencia)}: <SeloBandeira bandeira={kpis.ponto.bandeira} />{" "}
              {kpis.ponto.custoBandeira > 0
                ? `— acrescentou ${reais(kpis.ponto.custoBandeira)} à conta.`
                : ucsSel.every((u) => u.uc.ambiente === "livre")
                  ? "— no mercado livre a bandeira não é cobrada sobre a energia."
                  : ""}
            </p>
          )}

          {/* Consumo por dia */}
          <Secao
            titulo={
              <>
                Consumo <Termo id="kwhDia">por dia</Termo>
              </>
            }
            descricao="Cada conta tem de 28 a 33 dias; dividindo pelos dias, os meses ficam comparáveis. A faixa cinza é o normal esperado para o mês (linha de base, estação e ocupação)."
            icone={<Zap className="size-5 text-energy" aria-hidden />}
            acoes={
              horizontal ? (
                <button
                  type="button"
                  aria-pressed={porCasa}
                  onClick={() => setPorCasa((v) => !v)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary",
                    porCasa ? "border-primary bg-primary-soft text-primary" : "border-border-strong text-muted hover:bg-surface-2",
                  )}
                >
                  <Users className="size-4" aria-hidden />
                  Por casa ocupada
                </button>
              ) : undefined
            }
          >
            <GraficoConsumo
              linhas={linhasConsumo}
              cor={corSel}
              nomeSerie={usarPorCasa ? "kWh/dia por casa ocupada" : ucSel ? `Consumo — ${ucSel.uc.apelido.replace(/^.*—\s*/, "")}` : "Consumo total"}
              unidade={usarPorCasa ? "kWh/dia por casa" : "kWh/dia"}
              casas={usarPorCasa ? 2 : 1}
              linhaDeBase={kpis?.linha ? (usarPorCasa ? kpis.linha.valor / Math.max(1, kpis.linha.ocupacaoMedia) : kpis.linha.valor) : undefined}
            />
            <EpisodiosAnomalia ucs={ucsSel} />
            {usarPorCasa && (
              <p className="mt-3 text-xs text-muted">
                Por casa ocupada: consumo das áreas comuns dividido pelas unidades ocupadas no mês. Ajuda a ver se o consumo cresce
                mais rápido que o condomínio.
              </p>
            )}
          </Secao>

          {/* Custo */}
          <Secao
            titulo="Custo mensal"
            descricao={`Valor das contas em reais (separado do consumo). Nos últimos 12 meses: ${reais(gasto12m)}.`}
            icone={<Receipt className="size-5" aria-hidden />}
          >
            <GraficoCustoEmpilhado
              linhas={linhasCusto}
              series={seriesCusto}
              rotulo="Custo mensal de energia, em reais"
              extraTooltip={(l) => [
                { rotulo: "Preço médio do kWh", valor: formatarTarifa(Number(l.reaisPorKwh ?? 0)), discreta: true },
                { rotulo: "Consumo", valor: `${formatarNumero(Number(l.kwh ?? 0))} kWh`, discreta: true },
              ]}
            />
            {ucsLivre.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Contas no mercado livre somam a fatura da distribuidora e a da comercializadora; o consumo (kWh) é contado uma vez só.
              </p>
            )}
          </Secao>

          {/* Média tensão: demanda e ponta */}
          {ucsA4.map((u) => (
            <SecaoMediaTensao key={u.uc.id} analise={u} sugerida={analise.recomendacoes.find((r) => r.tipo === "ajustar_demanda" && r.ucId === u.uc.id)} cor={corDaUc(u.uc.id)} />
          ))}

          {/* Mercado livre */}
          {ucsLivre.map((u) => (
            <SecaoMercadoLivre key={u.uc.id} analise={u} cor={corDaUc(u.uc.id)} />
          ))}

          {/* Bandeiras */}
          {bandeirasSel.temCativo && (
            <Secao
              titulo={
                <>
                  Impacto das <Termo id="bandeira">bandeiras</Termo> nos últimos 12 meses
                </>
              }
              descricao="Quanto as bandeiras amarela e vermelha acrescentaram às contas no mercado cativo."
              icone={<Flag className="size-5" aria-hidden />}
            >
              <ImpactoBandeiras resumo={bandeirasSel} />
            </Secao>
          )}

          {/* Recomendações */}
          <section id="recomendacoes" className="scroll-mt-6" aria-labelledby="titulo-recomendacoes">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="titulo-recomendacoes" className="text-lg font-bold text-foreground">
                  Recomendações com número
                </h2>
                <p className="text-sm text-muted">
                  Ordenadas por prioridade (economia, esforço e retorno). Faixas mín–máx com as premissas abertas.
                </p>
              </div>
              {recomendacoes.length > 0 && (
                <p className="text-sm text-muted">
                  Soma: <strong className="tabular text-foreground">{faixaReais(potencialSel)}/mês</strong>
                </p>
              )}
            </div>
            {recomendacoes.length ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {recomendacoes.map((r) => (
                    <CartaoRecomendacao
                      key={r.id}
                      rec={r}
                      onSimular={(x) => selecionarParaComprovar(x.id)}
                      hrefAssembleia={`${hrefAssembleia}?acao=${encodeURIComponent(r.id)}`}
                    />
                  ))}
                </div>
                {recomendacoes.length > 1 && (
                  <p className="mt-3 text-xs text-muted">
                    A soma é simples: ações sobre a mesma conta podem se sobrepor (por exemplo, LED reduz o kWh sobre o qual a assinatura dá
                    desconto). Por isso a recomendação é fazer uma de cada vez e medir.
                  </p>
                )}
              </>
            ) : (
              <EmptyState
                icone={<Lightbulb />}
                titulo="Nenhuma ação com economia relevante nesta conta"
                descricao="Com os dados atuais não encontramos desperdício que valha a pena. Continue enviando as contas: a análise roda a cada mês."
              />
            )}
          </section>

          {/* Comprovação */}
          {analise.recomendacoes.length > 0 && (
            <Comprovacao
              analise={analise}
              recomendacoes={analise.recomendacoes}
              selecionadaId={recSelecionada}
              onSelecionar={setRecSelecionada}
              cor={corDaUc}
            />
          )}

          {/* Assembleia */}
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center">
            <Presentation className="size-8 shrink-0 text-energy" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Levar para a assembleia</p>
              <p className="text-sm text-muted">
                Roteiro de 3 minutos (o problema, o número e a decisão que pedimos) e um slide de apoio, prontos para imprimir.
              </p>
            </div>
            <ButtonLink href={hrefAssembleia} variante="energia">
              Preparar fala para assembleia
            </ButtonLink>
          </div>

          <CardGlossario
            termos={[
              "kwhDia",
              "linhaDeBase",
              "mediaTensao",
              "demandaContratada",
              "demandaOciosa",
              "horarioPonta",
              "bandeira",
              "mercadoLivre",
              "tusdTe",
              "fatorPotencia",
              "assinatura",
              "payback",
            ]}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seções por UC                                                       */
/* ------------------------------------------------------------------ */

function EpisodiosAnomalia({ ucs }: { ucs: AnaliseUc[] }) {
  const episodios = ucs.flatMap((u) => u.episodios.map((e) => ({ ...e, uc: u })));
  if (!episodios.length) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <Info className="size-4" aria-hidden />
        Nenhum mês fora do normal nos dados.
      </p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {episodios.map((e) => (
        <li
          key={`${e.uc.uc.id}-${e.inicio}`}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
            e.severidade === "critico" ? "bg-critical-soft" : "bg-warn-soft",
          )}
        >
          <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", e.severidade === "critico" ? "text-critical" : "text-warn")} aria-hidden />
          <span className="text-foreground">
            <strong>
              {e.inicio === e.fim ? formatarCompetencia(e.inicio) : `${formatarCompetencia(e.inicio)} a ${formatarCompetencia(e.fim)}`}
              {e.ativo ? " (continua)" : ""}:
            </strong>{" "}
            {e.uc.uc.apelido} {pct(e.desvioMedio, 0, true)} acima do esperado — cerca de {formatarNumero(e.excessoKwhDiaMedio)} kWh/dia a mais,{" "}
            {reais(e.custoExcesso)} {e.ativo ? "até agora" : "no total"}.
          </span>
        </li>
      ))}
    </ul>
  );
}

function SecaoMediaTensao({
  analise,
  sugerida,
  cor,
}: {
  analise: AnaliseUc;
  sugerida?: { titulo: string; economiaMensalReais: { min: number; max: number } };
  cor: string;
}) {
  const meses = analise.meses.slice(-12);
  const linhas = meses.map((m) => ({
    competencia: m.competencia,
    rotulo: formatarCompetencia(m.competencia),
    medida: m.demandaMedidaKw,
    contratada: m.demandaContratadaKw,
  }));
  const medidas = meses.map((m) => m.demandaMedidaKw).filter((v): v is number => v !== undefined);
  const contratada = [...meses].reverse().find((m) => m.demandaContratadaKw)?.demandaContratadaKw;
  const maior = medidas.length ? Math.max(...medidas) : undefined;
  const media = medidas.length ? soma(medidas) / medidas.length : undefined;
  const ociosaKw = contratada && media !== undefined ? Math.max(0, contratada - media) : 0;
  const tarifaKw = analise.tarifas.demanda;
  const valorSugerido = sugerida ? Number(/para (\d+)/.exec(sugerida.titulo)?.[1] ?? NaN) : NaN;
  const temPonta = analise.meses.some((m) => m.pontaKwh !== undefined);
  const mesesReativo = meses.filter((m) => m.componentes.reativo > 0);

  return (
    <>
      <Secao
        titulo={
          <>
            <Termo id="demandaContratada">Demanda contratada</Termo> × medida — {analise.uc.apelido}
          </>
        }
        descricao="A demanda é a potência reservada na rede: na média tensão ela é paga todo mês, usando ou não."
        icone={<Gauge className="size-5" aria-hidden />}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <GraficoDemanda linhas={linhas} cor={cor} sugerida={Number.isFinite(valorSugerido) ? valorSugerido : undefined} />
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {contratada && (
                <div>
                  <dt className="text-xs text-muted">Contratada (paga)</dt>
                  <dd className="tabular text-lg font-semibold text-foreground">{formatarKw(contratada)}</dd>
                </div>
              )}
              {maior !== undefined && (
                <div>
                  <dt className="text-xs text-muted">Maior medida em 12 meses</dt>
                  <dd className="tabular text-lg font-semibold text-foreground">{formatarKw(maior)}</dd>
                </div>
              )}
              {ociosaKw > 0 && (
                <div className="col-span-2 lg:col-span-1">
                  <dt className="text-xs text-muted">
                    <Termo id="demandaOciosa">Demanda ociosa</Termo> (média)
                  </dt>
                  <dd className="tabular text-lg font-semibold text-foreground">
                    {formatarKw(ociosaKw)}
                    {tarifaKw ? <span className="text-sm font-medium text-muted"> ≈ {reais(ociosaKw * tarifaKw)}/mês</span> : null}
                  </dd>
                </div>
              )}
            </dl>
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
              <strong className="text-foreground">Demanda ociosa</strong> é a parte paga e não usada
              {contratada && maior !== undefined
                ? ` — como pagar um plano de internet de ${formatarNumero(contratada)} mega quando o uso nunca passa de ${formatarNumero(maior)}`
                : ""}
              .{" "}
              {sugerida ? (
                <>
                  Dá para reduzir mantendo uma folga de segurança (passar da contratada gera multa). Proposta:{" "}
                  <strong className="text-foreground">{formatarNumero(valorSugerido)} kW</strong>, economia de{" "}
                  {faixaReais(sugerida.economiaMensalReais)}/mês.
                </>
              ) : (
                "Aqui a folga é pequena: a demanda está bem ajustada, e reduzir mais arriscaria multa de ultrapassagem."
              )}
            </p>
          </div>
        </div>
      </Secao>
      {mesesReativo.length > 0 && (
        <Secao
          titulo={
            <>
              <Termo id="fatorPotencia">Reativo excedente</Termo> — {analise.uc.apelido}
            </>
          }
          descricao="Multa cobrada quando o fator de potência fica abaixo de 0,92 (motores de bombas e elevadores sem correção)."
          icone={<AlertTriangle className="size-5 text-warn" aria-hidden />}
        >
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <p className="text-sm text-muted">Multa nos últimos 12 meses</p>
              <p className="text-2xl font-semibold text-foreground">{reais(soma(mesesReativo.map((m) => m.componentes.reativo)))}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Meses com cobrança</p>
              <p className="text-2xl font-semibold text-foreground">
                {mesesReativo.length} de {meses.length}
              </p>
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {meses.map((m) => (
              <li key={m.competencia} className="rounded-lg border border-border p-2">
                <p className="text-xs font-medium text-muted">{formatarCompetencia(m.competencia)}</p>
                <p className="tabular mt-1 text-sm font-semibold text-foreground">
                  {m.componentes.reativo > 0 ? reais(m.componentes.reativo) : "—"}
                </p>
                {(m.reativoKvarh ?? 0) > 0 && <p className="tabular text-xs text-muted">{formatarNumero(m.reativoKvarh!)} kvarh</p>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">
            Quando a cobrança aparece em alguns meses e some em outros, o mais comum é um banco de capacitores existente com defeito.
            Veja a recomendação abaixo.
          </p>
        </Secao>
      )}
      {temPonta && (
        <Secao
          titulo={
            <>
              <Termo id="horarioPonta">Ponta</Termo> × fora de ponta — {analise.uc.apelido}
            </>
          }
          descricao="Quanto custa cada kWh em cada horário e quanto do consumo cai no horário mais caro (últimos 12 meses)."
          icone={<Zap className="size-5" aria-hidden />}
        >
          <PontaForaPonta analise={analise} />
        </Secao>
      )}
    </>
  );
}

function SecaoMercadoLivre({ analise, cor }: { analise: AnaliseUc; cor: string }) {
  const ml = analise.mercadoLivre!;
  const ultimos = ml.meses.slice(-12);
  const linhas = ultimos.map((m) => ({
    competencia: m.competencia,
    rotulo: formatarCompetencia(m.competencia),
    real: m.custoReal,
    cativo: m.custoCativo,
    economia: m.economia,
    acumulada: m.economiaAcumulada,
  }));
  const intervalo = ml.inicio ? competenciasEntre(ml.inicio, ml.meses[ml.meses.length - 1].competencia).length : ml.meses.length;
  return (
    <Secao
      titulo={
        <>
          <Termo id="mercadoLivre">Mercado livre</Termo>: quanto pagou × quanto pagaria no cativo — {analise.uc.apelido}
        </>
      }
      descricao="A fatura da distribuidora informa quanto a mesma energia custaria se o condomínio continuasse no mercado cativo."
      icone={<Scale className="size-5" aria-hidden />}
    >
      <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat destaque="primario" rotulo={`Economia em ${ml.meses12m} meses`} valor={reais(ml.economia12m)} contexto={`${pct(ml.percentual12m, 1)} mais barato que o cativo`} />
        <Stat rotulo="Economia média por mês" valor={reais(ml.economia12m / Math.max(1, ml.meses12m))} contexto="distribuidora + comercializadora" />
        <Stat rotulo="Acumulada no histórico" valor={reais(ml.economiaTotal)} contexto={`${intervalo} meses desde ${ml.inicio ? formatarCompetencia(ml.inicio) : "—"}`} />
        <Stat
          rotulo="Preço no contrato"
          valor={ml.precoMwh ? `${formatarMoeda(ml.precoMwh)}` : "—"}
          contexto={ml.precoMwh ? `por MWh (= ${formatarTarifa(ml.precoMwh / 1000)}, sem ICMS)` : "não informado na conta"}
        />
      </div>
      <GraficoMercadoLivre linhas={linhas} cor={cor} />
      <p className="mt-3 text-sm text-muted">
        {ml.percentual12m >= 0.1
          ? "O contrato está valendo a pena. Ainda assim, vale comparar o preço com o mercado perto da renovação e não fechar prazos longos sem assessoria."
          : "A economia está baixa para o mercado livre: vale buscar propostas de outras comercializadoras."}{" "}
        Bandeira tarifária não é cobrada sobre a energia comprada no mercado livre.
      </p>
    </Secao>
  );
}
