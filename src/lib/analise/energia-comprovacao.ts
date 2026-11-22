/**
 * Energia — comprovação antes/depois.
 *
 * Mesmo método para qualquer ação:
 *  1. escolhe a métrica certa para a ação (kWh/dia, kWh/dia na ponta, R$ de
 *     demanda, R$ de reativo ou R$/kWh sem bandeira);
 *  2. linha de base = média dos 12 meses ANTES da ação (sem meses de anomalia);
 *  3. para métricas de consumo, o esperado de cada mês é ajustado pela ocupação
 *     e pela estação (mesmo mês do ano anterior, quando existe);
 *  4. economia = esperado − real; só é "confirmada" quando passa da variação
 *     normal por pelo menos 2 meses.
 * Sem data de implementação, simula o efeito com a economia estimada.
 */
import { unidadesOcupadas } from "../dados/condominios";
import { somarMeses } from "../dados/referencia";
import { formatarCompetencia, formatarCompetenciaLonga, formatarMoeda, formatarNumero1, formatarPercentual } from "../formatacao";
import type { Competencia } from "../tipos";
import { avaliarSerie, calcularLinhaDeBase, fatorOcupacao, PARCELA_LIGADA_A_OCUPACAO, type LinhaDeBase } from "./energia-anomalias";
import type { BaseAnalise } from "./energia-base";
import { media, type Faixa, type PontoSerie } from "./energia-dados";
import type { MetricaComprovacao, RecomendacaoEnergia } from "./energia-recomendacoes";

export interface DefinicaoMetrica {
  rotulo: string;
  unidade: string;
  /** Casas decimais na exibição */
  casas: number;
  /** Ajusta por ocupação e estação (métricas de consumo) */
  ajusta: boolean;
  moeda: boolean;
}

export const METRICAS: Record<MetricaComprovacao, DefinicaoMetrica> = {
  kwh_dia: { rotulo: "Consumo por dia", unidade: "kWh/dia", casas: 1, ajusta: true, moeda: false },
  kwh_ponta_dia: { rotulo: "Consumo por dia no horário de ponta", unidade: "kWh/dia", casas: 1, ajusta: true, moeda: false },
  custo_demanda: { rotulo: "Valor pago de demanda", unidade: "R$/mês", casas: 0, ajusta: false, moeda: true },
  custo_reativo: { rotulo: "Valor pago de reativo excedente", unidade: "R$/mês", casas: 0, ajusta: false, moeda: true },
  reais_por_kwh: { rotulo: "Preço médio do kWh (sem bandeira)", unidade: "R$/kWh", casas: 2, ajusta: false, moeda: true },
};

export function formatarValorMetrica(metrica: MetricaComprovacao, v: number) {
  const d = METRICAS[metrica];
  if (metrica === "reais_por_kwh") return `${formatarMoeda(v)}/kWh`;
  if (d.moeda) return formatarMoeda(Math.round(v)).replace(",00", "");
  return `${formatarNumero1(v)} ${d.unidade}`;
}

function valorDaMetrica(metrica: MetricaComprovacao, p: PontoSerie): number | undefined {
  switch (metrica) {
    case "kwh_dia":
      return p.kwh > 0 ? p.kwhDia : undefined;
    case "kwh_ponta_dia":
      return p.pontaKwhDia;
    case "custo_demanda":
      return p.completo ? p.custoDemanda : undefined;
    case "custo_reativo":
      return p.completo ? p.custoReativo : undefined;
    case "reais_por_kwh":
      return p.completo && p.kwh > 0 ? p.reaisPorKwhSemBandeira : undefined;
  }
}

export interface PontoComprovacao {
  competencia: Competencia;
  fase: "base" | "antes" | "transicao" | "depois" | "projecao";
  real?: number;
  esperado?: number;
  comAcaoMin?: number;
  comAcaoMax?: number;
}

export interface MesDepois {
  competencia: Competencia;
  real: number;
  esperado: number;
  economia: number;
  economiaPercentual: number;
  economiaReais: number;
}

export type Veredito = "confirmada" | "parcial" | "nao_observada" | "inconclusiva" | "aguardando";

export interface ResultadoComprovacao {
  metrica: MetricaComprovacao;
  definicao: DefinicaoMetrica;
  modo: "simulacao" | "medicao";
  mesImplementacao?: Competencia;
  ucApelido?: string;
  /** Regra de comparação, por extenso */
  regra: string[];
  linhaDeBase: LinhaDeBase | null;
  pontos: PontoComprovacao[];
  mesesDepois: MesDepois[];
  medicao: {
    economiaMedia: number;
    economiaPercentual: number;
    economiaReaisMes: number;
    economiaReaisTotal: number;
    veredito: Veredito;
    texto: string;
  } | null;
  simulacao: {
    inicio: Competencia;
    esperadoMedio: number;
    comAcao: Faixa;
    reducaoPercentual: Faixa;
    economiaReais: Faixa;
    texto: string;
  } | null;
  avisos: string[];
  /** Meses que podem ser escolhidos como "mês de implementação" */
  mesesDisponiveis: Competencia[];
}

const pct = (v: number, casas = 1) => formatarPercentual(v * 100, { casas });

function regraDaMetrica(metrica: MetricaComprovacao, variacaoNormal: number): string[] {
  const d = METRICAS[metrica];
  const passos: string[] = [];
  if (metrica === "kwh_dia" || metrica === "kwh_ponta_dia") {
    passos.push(
      `Medimos o consumo em kWh por dia${metrica === "kwh_ponta_dia" ? ", só do horário de ponta" : ""}: cada conta tem de 28 a 33 dias, e dividir pelos dias deixa os meses comparáveis.`,
      "Linha de base: a média dos 12 meses antes da ação, sem os meses marcados como anomalia.",
      `Ajuste por ocupação: consideramos que ${pct(PARCELA_LIGADA_A_OCUPACAO, 0)} do consumo das áreas comuns acompanha o número de unidades ocupadas (bombas de água, esgoto); o resto não muda (postes, piscina, portaria). Se a ocupação sobe 10%, o esperado sobe ${pct(PARCELA_LIGADA_A_OCUPACAO * 0.1, 0)}.`,
      "Ajuste de estação: quando existe o mesmo mês do ano anterior, o esperado é a média entre a linha de base e esse mês (os dois corrigidos pela ocupação).",
    );
  } else {
    passos.push(
      `Medimos ${d.rotulo.toLowerCase()} (${d.unidade}) em cada conta completa.`,
      `Linha de base: a média dos 12 meses antes da ação.${metrica === "reais_por_kwh" ? " A bandeira tarifária é retirada da conta, para um mês de bandeira vermelha não parecer aumento de preço." : ""}`,
      "Aqui não há ajuste por ocupação nem por estação: o valor não depende de quanto se consome.",
    );
  }
  passos.push(
    "O mês em que a ação foi feita fica de fora (é um mês parcial).",
    `Economia = esperado − real. Só chamamos de "confirmada" quando ela passa da variação normal (±${pct(Math.max(variacaoNormal, 0.03))}) por pelo menos 2 meses seguidos.`,
  );
  return passos;
}

/**
 * Comprova (ou simula) o efeito de uma recomendação.
 * `mesImplementacao` = null → simulação (ação ainda não implementada).
 */
export function comprovarAcao(
  base: BaseAnalise,
  rec: RecomendacaoEnergia,
  mesImplementacao: Competencia | null,
): ResultadoComprovacao {
  const metrica = rec.metrica;
  const definicao = METRICAS[metrica];
  const analiseUc = rec.ucId ? base.ucs.find((u) => u.uc.id === rec.ucId) : undefined;
  const serie = analiseUc?.serie ?? base.serie;
  const avisos: string[] = [];

  const pontosSerie = serie
    .map((p) => ({ p, valor: valorDaMetrica(metrica, p) }))
    .filter((x): x is { p: PontoSerie; valor: number } => x.valor !== undefined);
  const mapa = new Map(pontosSerie.map((x) => [x.p.competencia, x]));

  // Meses anômalos (só para métricas de consumo) ficam fora da linha de base
  const anomalos = new Set<Competencia>();
  if (definicao.ajusta) {
    for (const a of avaliarSerie(pontosSerie.map((x) => ({ competencia: x.p.competencia, valor: x.valor, ocupadas: x.p.ocupadas, dias: x.p.dias })))) {
      if (a.status === "alta" || a.status === "queda") anomalos.add(a.competencia);
    }
  }
  const entradas = pontosSerie.map((x) => ({
    competencia: x.p.competencia,
    valor: x.valor,
    ocupadas: x.p.ocupadas,
    anomalo: anomalos.has(x.p.competencia),
  }));

  const ultimo = pontosSerie[pontosSerie.length - 1]?.p.competencia;
  const primeiro = pontosSerie[0]?.p.competencia;
  const mesesDisponiveis = pontosSerie.map((x) => x.p.competencia).filter((c) => primeiro && c >= somarMeses(primeiro, 3));

  const esperadoPara = (competencia: Competencia, linha: LinhaDeBase) => {
    if (!definicao.ajusta) return linha.valor;
    const ocupadas = mapa.get(competencia)?.p.ocupadas ?? unidadesOcupadas(base.condominio, competencia);
    const a = linha.valor * fatorOcupacao(ocupadas, linha.ocupacaoMedia);
    const anterior = somarMeses(competencia, -12);
    const ref = linha.meses.includes(anterior) ? mapa.get(anterior) : undefined;
    if (!ref) return a;
    const b = ref.valor * fatorOcupacao(ocupadas, ref.p.ocupadas);
    return (a + b) / 2;
  };

  const reaisPorUnidade = (competencia: Competencia, economia: number) => {
    const x = mapa.get(competencia);
    if (!x) return 0;
    const t = analiseUc?.tarifas;
    switch (metrica) {
      case "kwh_dia":
        return economia * x.p.dias * (t?.reaisPorKwhVariavel ?? x.p.reaisPorKwh);
      case "kwh_ponta_dia":
        return economia * x.p.dias * Math.max(0, (t?.ponta ?? 0) - (t?.foraPonta ?? 0));
      case "custo_demanda":
      case "custo_reativo":
        return economia;
      case "reais_por_kwh":
        return economia * x.p.kwh;
    }
  };

  const vazio: ResultadoComprovacao = {
    metrica,
    definicao,
    modo: mesImplementacao ? "medicao" : "simulacao",
    mesImplementacao: mesImplementacao ?? undefined,
    ucApelido: analiseUc?.uc.apelido,
    regra: regraDaMetrica(metrica, 0),
    linhaDeBase: null,
    pontos: [],
    mesesDepois: [],
    medicao: null,
    simulacao: null,
    avisos,
    mesesDisponiveis,
  };
  if (!ultimo) {
    avisos.push("Ainda não há contas com os dados necessários para esta comparação.");
    return vazio;
  }

  /* ----------------------------- simulação ----------------------------- */
  if (!mesImplementacao) {
    const inicio = somarMeses(ultimo, 1);
    const linha = calcularLinhaDeBase(entradas, inicio);
    if (!linha) {
      avisos.push("Não há meses suficientes para montar a linha de base.");
      return vazio;
    }
    if (linha.parcial) avisos.push(`Linha de base parcial: só ${linha.meses.length} meses disponíveis (o ideal são 12).`);
    if (linha.excluidosPorAnomalia.length)
      avisos.push(`Meses fora da linha de base por anomalia: ${linha.excluidosPorAnomalia.map(formatarCompetencia).join(", ")}.`);

    // Anomalia em curso: se nada for feito, o excesso continua
    let excessoAtual = 0;
    if (definicao.ajusta) {
      const recentes = pontosSerie.slice(-3).filter((x) => anomalos.has(x.p.competencia));
      const ultimoAnomalo = anomalos.has(ultimo);
      if (ultimoAnomalo && recentes.length) {
        excessoAtual = media(recentes.map((x) => x.valor - esperadoPara(x.p.competencia, linha)));
        if (excessoAtual > 0)
          avisos.push(
            `O consumo está acima do normal nos últimos meses: a projeção "sem a ação" mantém esse excesso (${formatarValorMetrica(metrica, excessoAtual)}).`,
          );
        else excessoAtual = 0;
      }
    }

    const pontos: PontoComprovacao[] = [];
    for (const x of pontosSerie.filter((x) => x.p.competencia >= somarMeses(inicio, -12))) {
      pontos.push({ competencia: x.p.competencia, fase: linha.meses.includes(x.p.competencia) ? "base" : "antes", real: x.valor });
    }
    const projecao: number[] = [];
    for (let i = 0; i < 6; i++) {
      const c = somarMeses(inicio, i);
      const esperado = esperadoPara(c, linha) + excessoAtual;
      projecao.push(esperado);
      pontos.push({
        competencia: c,
        fase: "projecao",
        esperado,
        comAcaoMin: Math.max(0, esperado - rec.efeitoNaMetrica.max),
        comAcaoMax: Math.max(0, esperado - rec.efeitoNaMetrica.min),
      });
    }
    // liga a linha do esperado ao último mês real
    const ultimoPonto = pontos.find((p) => p.competencia === ultimo);
    if (ultimoPonto) {
      ultimoPonto.esperado = ultimoPonto.real;
      ultimoPonto.comAcaoMin = ultimoPonto.real;
      ultimoPonto.comAcaoMax = ultimoPonto.real;
    }
    const esperadoMedio = media(projecao);
    const comAcao = {
      min: Math.max(0, esperadoMedio - rec.efeitoNaMetrica.max),
      max: Math.max(0, esperadoMedio - rec.efeitoNaMetrica.min),
    };
    const reducaoPercentual = {
      min: esperadoMedio > 0 ? rec.efeitoNaMetrica.min / esperadoMedio : 0,
      max: esperadoMedio > 0 ? rec.efeitoNaMetrica.max / esperadoMedio : 0,
    };
    const fmt = (v: number) => formatarValorMetrica(metrica, v);
    return {
      ...vazio,
      modo: "simulacao",
      regra: regraDaMetrica(metrica, linha.variacaoNormal),
      linhaDeBase: linha,
      pontos,
      simulacao: {
        inicio,
        esperadoMedio,
        comAcao,
        reducaoPercentual,
        economiaReais: rec.economiaMensalReais,
        texto: `Se a ação começar em ${formatarCompetenciaLonga(inicio)}, o esperado é que o indicador "${definicao.rotulo.toLowerCase()}" saia de cerca de ${fmt(esperadoMedio)} para ${fmt(comAcao.min)} a ${fmt(comAcao.max)} (−${pct(reducaoPercentual.min)} a −${pct(reducaoPercentual.max)}). Para comprovar, volte aqui depois de 2 contas e informe o mês em que a ação foi feita.`,
      },
    };
  }

  /* ------------------------------ medição ------------------------------ */
  const linha = calcularLinhaDeBase(entradas, mesImplementacao);
  if (!linha) {
    avisos.push("Não há meses antes desta data para montar a linha de base. Escolha um mês mais recente.");
    return vazio;
  }
  if (linha.parcial) avisos.push(`Linha de base parcial: só ${linha.meses.length} meses antes da ação (o ideal são 12).`);
  if (linha.excluidosPorAnomalia.length)
    avisos.push(`Meses fora da linha de base por anomalia: ${linha.excluidosPorAnomalia.map(formatarCompetencia).join(", ")}.`);

  const pontos: PontoComprovacao[] = [];
  const mesesDepois: MesDepois[] = [];
  for (const x of pontosSerie) {
    const c = x.p.competencia;
    if (c < somarMeses(mesImplementacao, -12)) continue;
    if (c < mesImplementacao) {
      pontos.push({ competencia: c, fase: linha.meses.includes(c) ? "base" : "antes", real: x.valor });
    } else if (c === mesImplementacao) {
      pontos.push({ competencia: c, fase: "transicao", real: x.valor, esperado: esperadoPara(c, linha) });
    } else {
      const esperado = esperadoPara(c, linha);
      const economia = esperado - x.valor;
      pontos.push({
        competencia: c,
        fase: "depois",
        real: x.valor,
        esperado,
        comAcaoMin: Math.max(0, esperado - rec.efeitoNaMetrica.max),
        comAcaoMax: Math.max(0, esperado - rec.efeitoNaMetrica.min),
      });
      mesesDepois.push({
        competencia: c,
        real: x.valor,
        esperado,
        economia,
        economiaPercentual: esperado > 0 ? economia / esperado : 0,
        economiaReais: reaisPorUnidade(c, economia),
      });
    }
  }

  const n = mesesDepois.length;
  const economiaMedia = n ? media(mesesDepois.map((m) => m.economia)) : 0;
  const esperadoMedio = n ? media(mesesDepois.map((m) => m.esperado)) : 0;
  const economiaPercentual = esperadoMedio > 0 ? economiaMedia / esperadoMedio : 0;
  const economiaReaisMes = n ? media(mesesDepois.map((m) => m.economiaReais)) : 0;
  const economiaReaisTotal = mesesDepois.reduce((s, m) => s + m.economiaReais, 0);
  const limite = Math.max(linha.variacaoNormal, 0.03);
  const ultimosDois = mesesDepois.slice(-2);
  const doisAcima = ultimosDois.length === 2 && ultimosDois.every((m) => m.economiaPercentual > limite);

  let veredito: Veredito;
  let texto: string;
  const fmt = (v: number) => formatarValorMetrica(metrica, v);
  if (n === 0) {
    veredito = "aguardando";
    texto = `Ainda não há contas depois de ${formatarCompetencia(mesImplementacao)}. Assim que a próxima conta chegar, a comparação aparece aqui.`;
  } else if (n < 2) {
    veredito = "inconclusiva";
    texto =
      economiaMedia > 0
        ? `Só 1 mês depois da ação: economia de ${fmt(economiaMedia)} (${pct(economiaPercentual)}). É cedo para concluir — espere mais uma conta.`
        : `Só 1 mês depois da ação, e o indicador ainda não caiu (${pct(Math.abs(economiaPercentual))} acima do esperado). É cedo para concluir — espere mais uma conta.`;
  } else if (economiaPercentual > limite && doisAcima && economiaMedia >= rec.efeitoNaMetrica.min * 0.5) {
    veredito = "confirmada";
    texto = `Economia confirmada: em ${n} meses, o indicador ficou em média ${fmt(economiaMedia)} abaixo do esperado (${pct(economiaPercentual)}), acima da variação normal de ±${pct(limite)}. Isso equivale a ${formatarMoeda(Math.round(economiaReaisMes)).replace(",00", "")} por mês.`;
  } else if (economiaPercentual > 0) {
    veredito = "parcial";
    texto = `Há sinal de economia (${pct(economiaPercentual)} em ${n} meses), mas ainda dentro da variação normal (±${pct(limite)}) ou abaixo do estimado. Acompanhe mais alguns meses.`;
  } else {
    veredito = "nao_observada";
    texto = `Nos ${n} meses depois de ${formatarCompetencia(mesImplementacao)} o indicador não caiu: ficou ${pct(Math.abs(economiaPercentual))} ${economiaPercentual < 0 ? "acima" : "igual ao"} do esperado. Verifique se a ação foi mesmo feita nessa data ou se algo novo passou a consumir.`;
  }

  return {
    ...vazio,
    modo: "medicao",
    regra: regraDaMetrica(metrica, linha.variacaoNormal),
    linhaDeBase: linha,
    pontos,
    mesesDepois,
    medicao: { economiaMedia, economiaPercentual, economiaReaisMes, economiaReaisTotal, veredito, texto },
  };
}
