/**
 * Análises de energia (kWh/dia, linha de base, anomalias, recomendações, insights).
 *
 * DONO: agente "Energia". O Painel importa `gerarInsightsEnergia` (assinatura
 * mantida). As telas de energia usam `analisarCondominio` e `resumirCarteiraEnergia`.
 *
 * Módulos:
 *  - energia-dados.ts        → contas → modelo único por UC/mês (kWh/dia, componentes, tarifas)
 *  - energia-anomalias.ts    → linha de base, faixa normal, anomalias
 *  - energia-base.ts         → base de análise do condomínio
 *  - energia-recomendacoes.ts→ recomendações com número (faixa, premissas, prioridade)
 *  - energia-comprovacao.ts  → antes/depois (medição ou simulação)
 *  - energia-assembleia.ts   → roteiro de 3 minutos + slide
 */
import { somarMeses } from "../dados/referencia";
import { formatarCompetencia, formatarMoeda, formatarNumero, formatarPercentual } from "../formatacao";
import type { Bandeira, Competencia, Condominio, Conta, Insight, Severidade } from "../tipos";
import { linhaDeBaseAjustada } from "./energia-anomalias";
import { montarBaseAnalise, type BaseAnalise } from "./energia-base";
import { competenciasEntre, media, soma, ROTULOS_BANDEIRA, type Faixa } from "./energia-dados";
import { recomendacoesDaBase, somarEconomias, type RecomendacaoEnergia } from "./energia-recomendacoes";

export * from "./energia-dados";
export * from "./energia-anomalias";
export * from "./energia-base";
export * from "./energia-recomendacoes";
export * from "./energia-comprovacao";
export * from "./energia-assembleia";

/* ------------------------------------------------------------------ */
/* Condomínio                                                          */
/* ------------------------------------------------------------------ */

export interface KpisEnergia {
  competencia?: Competencia;
  kwh?: number;
  kwhDia?: number;
  /** Linha de base (12 meses anteriores) levada para a ocupação do mês */
  linhaDeBaseAjustada?: number;
  variacaoVsBase?: number;
  custo?: number;
  custoMedio12m?: number;
  variacaoCusto?: number;
  reaisPorKwh?: number;
  bandeira?: Bandeira;
  ocupadas?: number;
  kwhDiaPorUnidade?: number;
  custoPorUnidade?: number;
  gasto12m?: number;
}

export interface AnaliseEnergiaCondominio extends BaseAnalise {
  recomendacoes: RecomendacaoEnergia[];
  /** Soma simples das recomendações (ações sobre a mesma conta podem se sobrepor) */
  economiaPotencial: Faixa;
  kpis: KpisEnergia;
}

export function analisarCondominio(condominio: Condominio, contas: Conta[]): AnaliseEnergiaCondominio {
  const base = montarBaseAnalise(condominio, contas);
  const recomendacoes = recomendacoesDaBase(base);
  const p = base.ultimoPonto;
  const kpis: KpisEnergia = {};
  if (p) {
    const anteriores = base.serie.filter(
      (x) => x.completo && x.competencia < p.competencia && x.competencia >= somarMeses(p.competencia, -12),
    );
    const custoMedio12m = anteriores.length ? media(anteriores.map((x) => x.custo)) : undefined;
    const linha = base.linhaDeBase ? linhaDeBaseAjustada(base.linhaDeBase, p.ocupadas) : undefined;
    const janela = base.serie.filter((x) => x.completo && base.competenciasJanela.includes(x.competencia));
    Object.assign(kpis, {
      competencia: p.competencia,
      kwh: p.kwh,
      kwhDia: p.kwhDia,
      linhaDeBaseAjustada: linha,
      variacaoVsBase: linha ? p.kwhDia / linha - 1 : undefined,
      custo: p.custo,
      custoMedio12m,
      variacaoCusto: custoMedio12m ? p.custo / custoMedio12m - 1 : undefined,
      reaisPorKwh: p.reaisPorKwh,
      bandeira: p.bandeira,
      ocupadas: p.ocupadas,
      kwhDiaPorUnidade: p.kwhDiaPorUnidade,
      custoPorUnidade: p.custoPorUnidade,
      gasto12m: soma(janela.map((x) => x.custo)),
    } satisfies KpisEnergia);
  }
  return { ...base, recomendacoes, economiaPotencial: somarEconomias(recomendacoes), kpis };
}

/* ------------------------------------------------------------------ */
/* Carteira                                                            */
/* ------------------------------------------------------------------ */

export interface LinhaCarteiraEnergia {
  condominio: Condominio;
  analise: AnaliseEnergiaCondominio;
  competencia?: Competencia;
  kwhDia?: number;
  variacaoVsBase?: number;
  custo?: number;
  custoPorUnidade?: number;
  ocupadas?: number;
  recomendacoes: number;
  economiaPotencial: Faixa;
  anomaliaAtiva: boolean;
}

export interface MesCustoCarteira {
  competencia: Competencia;
  total: number;
  porCondominio: Record<string, number>;
}

export interface RecomendacaoCarteira extends RecomendacaoEnergia {
  condominio: Condominio;
}

export interface ResumoCarteiraEnergia {
  /** Último mês completo em TODOS os condomínios com dados */
  competencia?: Competencia;
  gasto: number;
  gastoMedio12m?: number;
  variacaoGasto?: number;
  kwh: number;
  kwhDia: number;
  reaisPorKwh: number;
  economiaLivre12m: number;
  ucsNoLivre: number;
  economiaPotencial: Faixa;
  linhas: LinhaCarteiraEnergia[];
  serieCusto: MesCustoCarteira[];
  recomendacoes: RecomendacaoCarteira[];
  contasEnviadas: number;
}

export function resumirCarteiraEnergia(contas: Conta[], condominios: Condominio[]): ResumoCarteiraEnergia {
  const analises = condominios.map((c) => analisarCondominio(c, contas));
  const comDados = analises.filter((a) => a.ultimoMesCompleto);
  const competencia = comDados.length ? comDados.map((a) => a.ultimoMesCompleto!).sort()[0] : undefined;

  const pontoEm = (a: AnaliseEnergiaCondominio, c: Competencia) => a.serie.find((p) => p.competencia === c && p.completo);
  const totalEm = (c: Competencia) => {
    const pontos = comDados.map((a) => pontoEm(a, c));
    return pontos.every(Boolean) ? soma(pontos.map((p) => p!.custo)) : undefined;
  };

  let gasto = 0;
  let kwh = 0;
  let kwhDia = 0;
  let gastoMedio12m: number | undefined;
  const serieCusto: MesCustoCarteira[] = [];
  if (competencia) {
    for (const a of comDados) {
      const p = pontoEm(a, competencia);
      gasto += p?.custo ?? 0;
      kwh += p?.kwh ?? 0;
      kwhDia += p?.kwhDia ?? 0;
    }
    const anteriores = competenciasEntre(somarMeses(competencia, -12), somarMeses(competencia, -1))
      .map(totalEm)
      .filter((v): v is number => v !== undefined);
    gastoMedio12m = anteriores.length ? media(anteriores) : undefined;
    for (const c of competenciasEntre(somarMeses(competencia, -11), competencia)) {
      const porCondominio: Record<string, number> = {};
      for (const a of analises) {
        const p = a.serie.find((x) => x.competencia === c);
        if (p) porCondominio[a.condominio.id] = p.custo;
      }
      serieCusto.push({ competencia: c, total: soma(Object.values(porCondominio)), porCondominio });
    }
  }

  const linhas: LinhaCarteiraEnergia[] = analises.map((a) => ({
    condominio: a.condominio,
    analise: a,
    competencia: a.kpis.competencia,
    kwhDia: a.kpis.kwhDia,
    variacaoVsBase: a.kpis.variacaoVsBase,
    custo: a.kpis.custo,
    custoPorUnidade: a.kpis.custoPorUnidade,
    ocupadas: a.kpis.ocupadas,
    recomendacoes: a.recomendacoes.length,
    economiaPotencial: a.economiaPotencial,
    anomaliaAtiva: a.episodios.some((e) => e.ativo),
  }));

  const recomendacoes = analises
    .flatMap((a) => a.recomendacoes.map((r) => ({ ...r, condominio: a.condominio })))
    .sort((x, y) => y.pontuacao - x.pontuacao);
  const ucsLivre = analises.flatMap((a) => a.ucs.filter((u) => u.mercadoLivre));

  return {
    competencia,
    gasto,
    gastoMedio12m,
    variacaoGasto: gastoMedio12m ? gasto / gastoMedio12m - 1 : undefined,
    kwh,
    kwhDia,
    reaisPorKwh: kwh > 0 ? gasto / kwh : 0,
    economiaLivre12m: soma(ucsLivre.map((u) => u.mercadoLivre!.economia12m)),
    ucsNoLivre: ucsLivre.length,
    economiaPotencial: somarEconomias(recomendacoes),
    linhas,
    serieCusto,
    recomendacoes,
    contasEnviadas: soma(analises.map((a) => a.contasEnviadas)),
  };
}

/* ------------------------------------------------------------------ */
/* Insights (Painel / alertas)                                         */
/* ------------------------------------------------------------------ */

const reais = (v: number) => formatarMoeda(Math.round(v)).replace(",00", "");
const pct = (v: number, casas = 0) => formatarPercentual(v * 100, { casas });
const ORDEM_SEVERIDADE: Record<Severidade, number> = { critico: 0, atencao: 1, oportunidade: 2, info: 3 };

/** Insights de energia de um condomínio (a partir de uma análise pronta) */
export function insightsDoCondominio(a: AnaliseEnergiaCondominio): Insight[] {
  const c = a.condominio;
  const href = `/energia/${c.slug}`;
  const lista: Insight[] = [];
  const recPorTipo = (tipo: RecomendacaoEnergia["tipo"], ucId?: string) =>
    a.recomendacoes.find((r) => r.tipo === tipo && (!ucId || r.ucId === ucId));

  // Anomalias
  for (const u of a.ucs) {
    for (const ep of u.episodios) {
      if (ep.ativo) {
        const rec = recPorTipo("corrigir_anomalia", u.uc.id);
        lista.push({
          id: `energia-anomalia-${u.uc.id}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: ep.severidade,
          titulo: `${c.nome}: consumo ${pct(ep.desvioMedio)} acima do normal`,
          descricao: `Desde ${formatarCompetencia(ep.inicio)}, a conta "${u.uc.apelido}" gasta cerca de ${formatarNumero(ep.excessoKwhDiaRecente)} kWh por dia a mais do que o esperado para a época e a ocupação. Vale uma vistoria elétrica.`,
          impactoMensal: rec?.economiaMensalReais,
          href,
        });
      } else {
        const rec = recPorTipo("checagem_mensal", u.uc.id);
        if (!rec) continue;
        const periodo = ep.inicio === ep.fim ? formatarCompetencia(ep.inicio) : `${formatarCompetencia(ep.inicio)}–${formatarCompetencia(ep.fim)}`;
        lista.push({
          id: `energia-anomalia-passada-${u.uc.id}-${ep.inicio}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "atencao",
          titulo: `${c.nome}: consumo fora do normal em ${periodo}`,
          descricao: `A conta "${u.uc.apelido}" ficou ${pct(ep.desvioMedio)} acima do esperado e custou ${reais(ep.custoExcesso)} a mais. Conferir o consumo todo mês evita que isso se repita sem ninguém ver.`,
          impactoMensal: rec.economiaMensalReais,
          href,
        });
      }
    }
  }

  // Recomendações que viram alerta/oportunidade
  for (const r of a.recomendacoes) {
    switch (r.tipo) {
      case "ajustar_demanda":
        lista.push({
          id: `energia-demanda-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "oportunidade",
          titulo: `${c.nome}: demanda contratada maior que o necessário`,
          descricao: `${r.descricao} Reduzir não exige obra.`,
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "aumentar_demanda":
        lista.push({
          id: `energia-ultrapassagem-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "atencao",
          titulo: `${c.nome}: multa por passar da demanda contratada`,
          descricao: r.descricao,
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "fator_potencia":
        lista.push({
          id: `energia-reativo-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "atencao",
          titulo: `${c.nome}: multa de energia reativa na conta`,
          descricao: `${r.descricao} Normalmente é banco de capacitores com defeito ou ausente.`,
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "migrar_mercado_livre":
        lista.push({
          id: `energia-mercado-livre-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "oportunidade",
          titulo: `${c.nome}: pode comprar energia no mercado livre`,
          descricao: "A conta de média tensão ainda paga a tarifa da distribuidora. No mercado livre a mesma energia costuma sair 15% a 25% mais barata.",
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "revisar_contrato_livre":
        lista.push({
          id: `energia-contrato-livre-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "oportunidade",
          titulo: `${c.nome}: contrato do mercado livre rende pouco`,
          descricao: r.descricao,
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "tirar_da_ponta":
        lista.push({
          id: `energia-ponta-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "oportunidade",
          titulo: `${c.nome}: consumo alto no horário mais caro`,
          descricao: `${r.resumo}. Temporizadores nas bombas e na filtragem mudam o horário sem reduzir o serviço.`,
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "assinatura_energia":
        lista.push({
          id: `energia-assinatura-${r.ucId}`,
          condominioId: c.id,
          categoria: "energia",
          severidade: "oportunidade",
          titulo: `${c.nome}: desconto com assinatura de energia solar`,
          descricao: "A conta de baixa tensão pode receber créditos de uma usina solar por assinatura, com desconto de 10% a 20% no consumo, sem obra.",
          impactoMensal: r.economiaMensalReais,
          href,
        });
        break;
      case "led_iluminacao":
        if (r.paybackMeses && (r.paybackMeses.min + r.paybackMeses.max) / 2 <= 24) {
          lista.push({
            id: `energia-led-${r.ucId}`,
            condominioId: c.id,
            categoria: "energia",
            severidade: "oportunidade",
            titulo: `${c.nome}: iluminação com LED se paga rápido`,
            descricao: `${r.descricao} Retorno em ${formatarNumero(r.paybackMeses.min)} a ${formatarNumero(r.paybackMeses.max)} meses.`,
            impactoMensal: r.economiaMensalReais,
            href,
          });
        }
        break;
    }
  }

  // Bandeira vermelha no último mês
  const p = a.ultimoPonto;
  if (p && a.bandeiras.temCativo && /vermelha|escassez/.test(p.bandeira) && p.custoBandeira >= 50) {
    lista.push({
      id: `energia-bandeira-${c.id}-${p.competencia}`,
      condominioId: c.id,
      categoria: "energia",
      severidade: "atencao",
      titulo: `${c.nome}: bandeira ${ROTULOS_BANDEIRA[p.bandeira].toLowerCase()} em ${formatarCompetencia(p.competencia)}`,
      descricao: `A bandeira acrescentou ${reais(p.custoBandeira)} à conta do mês. Nos últimos 12 meses, as bandeiras custaram ${reais(a.bandeiras.total)}.`,
      impactoMensal: { min: Math.round(p.custoBandeira), max: Math.round(p.custoBandeira) },
      href,
    });
  }

  // Conta acima do normal (sem anomalia de consumo que já explique)
  const temAnomaliaAtiva = a.episodios.some((e) => e.ativo);
  const semBandeira = (x: { custo: number; custoBandeira: number }) => x.custo - x.custoBandeira;
  const anteriores = p ? a.serie.filter((x) => x.completo && x.competencia < p.competencia && x.competencia >= somarMeses(p.competencia, -12)) : [];
  const variacaoSemBandeira = p && anteriores.length ? semBandeira(p) / media(anteriores.map(semBandeira)) - 1 : 0;
  if (!temAnomaliaAtiva && variacaoSemBandeira > 0.15 && a.kpis.variacaoCusto !== undefined && a.kpis.custo && a.kpis.custoMedio12m) {
    const excesso = a.kpis.custo - a.kpis.custoMedio12m;
    const explicacao =
      a.kpis.variacaoVsBase !== undefined && a.kpis.variacaoVsBase < 0.05
        ? "O consumo por dia está normal: a alta vem de preço (bandeira, reajuste) ou de um ciclo mais longo."
        : "O consumo por dia também subiu.";
    lista.push({
      id: `energia-custo-alto-${c.id}-${a.kpis.competencia}`,
      condominioId: c.id,
      categoria: "energia",
      severidade: "atencao",
      titulo: `${c.nome}: conta de energia ${pct(a.kpis.variacaoCusto)} acima da média`,
      descricao: `${formatarCompetencia(a.kpis.competencia!)} custou ${reais(a.kpis.custo)}, ${reais(excesso)} acima da média de 12 meses. ${explicacao}`,
      impactoMensal: { min: Math.round(excesso), max: Math.round(excesso) },
      href,
    });
  }

  // Mercado livre funcionando (informação positiva)
  for (const u of a.ucs) {
    const ml = u.mercadoLivre;
    if (!ml || ml.meses12m < 3 || ml.economia12m <= 0) continue;
    lista.push({
      id: `energia-livre-ok-${u.uc.id}`,
      condominioId: c.id,
      categoria: "energia",
      severidade: "info",
      titulo: `${c.nome}: mercado livre economizou ${reais(ml.economia12m)} em ${ml.meses12m} meses`,
      descricao: `Comparado com quanto a mesma energia custaria na distribuidora, a conta "${u.uc.apelido}" ficou ${pct(ml.percentual12m)} mais barata.`,
      href,
    });
  }

  // Dados incompletos
  for (const aviso of a.avisos.filter((x) => x.tom === "info" && /incompleto/.test(x.texto))) {
    lista.push({
      id: `energia-incompleto-${c.id}-${aviso.texto.slice(0, 6)}`,
      condominioId: c.id,
      categoria: "energia",
      severidade: "info",
      titulo: `${c.nome}: falta conta de energia`,
      descricao: aviso.texto,
      href,
    });
  }

  return lista;
}

function ordenarInsights(lista: Insight[]) {
  return lista.sort(
    (x, y) =>
      ORDEM_SEVERIDADE[x.severidade] - ORDEM_SEVERIDADE[y.severidade] ||
      (y.impactoMensal?.max ?? 0) - (x.impactoMensal?.max ?? 0),
  );
}

/**
 * A bandeira é a mesma para todo o país: na visão da carteira, os alertas de
 * bandeira de cada condomínio viram UM alerta com o impacto somado.
 */
function agruparBandeiras(lista: Insight[], analises: AnaliseEnergiaCondominio[]): Insight[] {
  const bandeiras = lista.filter((i) => i.id.startsWith("energia-bandeira-"));
  if (bandeiras.length <= 1) return lista;
  const resto = lista.filter((i) => !i.id.startsWith("energia-bandeira-"));
  const ids = new Set(bandeiras.map((i) => i.condominioId));
  const afetadas = analises.filter((a) => ids.has(a.condominio.id) && a.ultimoPonto);
  const total = soma(afetadas.map((a) => a.ultimoPonto!.custoBandeira));
  const maior = [...afetadas].sort((x, y) => y.ultimoPonto!.custoBandeira - x.ultimoPonto!.custoBandeira)[0];
  const p = maior.ultimoPonto!;
  const livres = analises.filter((a) => a.ucs.some((u) => u.uc.ambiente === "livre")).length;
  return [
    ...resto,
    {
      id: `energia-bandeira-carteira-${p.competencia}`,
      categoria: "energia",
      severidade: "atencao",
      titulo: `Bandeira ${ROTULOS_BANDEIRA[p.bandeira].toLowerCase()} em ${formatarCompetencia(p.competencia)}: +${reais(total)} na carteira`,
      descricao: `A bandeira encareceu as contas de ${afetadas.length} condomínios; o maior impacto foi no ${maior.condominio.nome} (${reais(p.custoBandeira)}).${livres ? " Contas no mercado livre não pagam bandeira sobre a energia." : ""}`,
      impactoMensal: { min: Math.round(total), max: Math.round(total) },
      href: "/energia",
    },
  ];
}

/** Insights de energia da carteira (anomalias, demanda ociosa, reativo, bandeira, mercado livre…) */
export function gerarInsightsEnergia(contas: Conta[], condominios: Condominio[]): Insight[] {
  const analises = condominios.map((c) => analisarCondominio(c, contas));
  return ordenarInsights(agruparBandeiras(analises.flatMap(insightsDoCondominio), analises));
}

/** Mesmo que gerarInsightsEnergia, mas reaproveitando análises já calculadas */
export function insightsDasAnalises(analises: AnaliseEnergiaCondominio[]): Insight[] {
  return ordenarInsights(agruparBandeiras(analises.flatMap(insightsDoCondominio), analises));
}
