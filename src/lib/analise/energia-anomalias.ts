/**
 * Energia — linha de base e anomalias.
 *
 * Regra (explicável sem jargão):
 *  - comparamos sempre kWh POR DIA (ciclos de 28–33 dias não distorcem);
 *  - linha de base = média dos 12 meses anteriores, sem os meses marcados como anomalia;
 *  - ajuste por ocupação: metade do consumo das áreas comuns acompanha o número
 *    de unidades ocupadas (portaria, bombas, ETE…); a outra metade não (postes, piscina);
 *  - ajuste de estação: quando existe o mesmo mês do ano anterior, o "esperado"
 *    é a média entre a linha de base e esse mês (os dois ajustados pela ocupação);
 *  - anomalia = mês acima da faixa normal (esperado ± variação normal, mín. 8%, máx. 20%).
 */
import { somarMeses } from "../dados/referencia";
import type { Competencia } from "../tipos";
import { desvioPadrao, limitar, media, soma } from "./energia-dados";

/** Parcela do consumo das áreas comuns que acompanha a ocupação (premissa) */
export const PARCELA_LIGADA_A_OCUPACAO = 0.5;

/** Fator para levar um valor medido com `ocupacaoReferencia` unidades para `ocupacaoAlvo` unidades */
export function fatorOcupacao(ocupacaoAlvo: number, ocupacaoReferencia: number) {
  if (!(ocupacaoReferencia > 0) || !(ocupacaoAlvo > 0)) return 1;
  return 1 + PARCELA_LIGADA_A_OCUPACAO * (ocupacaoAlvo / ocupacaoReferencia - 1);
}

export interface EntradaAvaliacao {
  competencia: Competencia;
  /** Valor comparado (normalmente kWh/dia) */
  valor: number;
  ocupadas: number;
  dias: number;
}

export type StatusMes = "normal" | "alta" | "queda" | "sem_referencia";

export interface PontoAvaliado extends EntradaAvaliacao {
  esperado: number | null;
  faixaMin: number | null;
  faixaMax: number | null;
  /** (valor ÷ esperado) − 1 */
  desvio: number | null;
  tolerancia: number | null;
  status: StatusMes;
  severidade?: "atencao" | "critico";
  /** O esperado usou o mesmo mês do ano anterior */
  usouAnoAnterior: boolean;
  /** Meses usados como referência */
  referencias: number;
}

const TOLERANCIA_MIN = 0.08;
const TOLERANCIA_MAX = 0.2;
const QUEDA_MIN = 0.15;
const CRITICO_MIN = 0.25;
const REFERENCIAS_MIN = 3;

/**
 * Avalia cada mês contra o seu "esperado". Meses anômalos não entram como
 * referência dos meses seguintes (uma anomalia não vira o novo normal).
 */
export function avaliarSerie(entradas: EntradaAvaliacao[]): PontoAvaliado[] {
  const ordenadas = [...entradas].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const normais = new Map<Competencia, EntradaAvaliacao>();
  const resultado: PontoAvaliado[] = [];

  for (const e of ordenadas) {
    const refs: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const r = normais.get(somarMeses(e.competencia, -i));
      if (r && r.valor > 0) refs.push(r.valor * fatorOcupacao(e.ocupadas, r.ocupadas));
    }
    const base: PontoAvaliado = {
      ...e,
      esperado: null,
      faixaMin: null,
      faixaMax: null,
      desvio: null,
      tolerancia: null,
      status: "sem_referencia",
      usouAnoAnterior: false,
      referencias: refs.length,
    };
    if (refs.length < REFERENCIAS_MIN || !(e.valor > 0)) {
      resultado.push(base);
      if (e.valor > 0) normais.set(e.competencia, e);
      continue;
    }

    const mediaRefs = media(refs);
    const anoAnterior = normais.get(somarMeses(e.competencia, -12));
    const valorAnoAnterior = anoAnterior ? anoAnterior.valor * fatorOcupacao(e.ocupadas, anoAnterior.ocupadas) : null;
    const esperado = valorAnoAnterior !== null ? (mediaRefs + valorAnoAnterior) / 2 : mediaRefs;
    const cv = refs.length >= 4 && mediaRefs > 0 ? desvioPadrao(refs) / mediaRefs : 0.06;
    const tolerancia = limitar(2 * cv, TOLERANCIA_MIN, TOLERANCIA_MAX);
    const desvio = esperado > 0 ? e.valor / esperado - 1 : 0;
    const excessoAbsoluto = e.valor - esperado;

    let status: StatusMes = "normal";
    let severidade: PontoAvaliado["severidade"];
    if (desvio > tolerancia && excessoAbsoluto >= 0.5) {
      status = "alta";
      severidade = desvio > Math.max(2 * tolerancia, CRITICO_MIN) ? "critico" : "atencao";
    } else if (desvio < -Math.max(tolerancia, QUEDA_MIN)) {
      status = "queda";
    }

    resultado.push({
      ...base,
      esperado,
      faixaMin: esperado * (1 - tolerancia),
      faixaMax: esperado * (1 + tolerancia),
      desvio,
      tolerancia,
      status,
      severidade,
      usouAnoAnterior: valorAnoAnterior !== null,
    });
    if (status === "normal") normais.set(e.competencia, e);
  }
  return resultado;
}

/* ------------------------------------------------------------------ */
/* Episódios (meses seguidos acima do normal)                          */
/* ------------------------------------------------------------------ */

export interface EpisodioAnomalia {
  ucId?: string;
  inicio: Competencia;
  fim: Competencia;
  meses: Competencia[];
  desvioMedio: number;
  desvioMaximo: number;
  /** kWh/dia acima do esperado (média do episódio) */
  excessoKwhDiaMedio: number;
  /** kWh/dia acima do esperado nos últimos meses do episódio (até 3) */
  excessoKwhDiaRecente: number;
  excessoKwhTotal: number;
  /** R$ do excesso (kWh a mais × R$/kWh variável da UC) */
  custoExcesso: number;
  /** O episódio inclui o último mês avaliado */
  ativo: boolean;
  severidade: "atencao" | "critico";
}

export function detectarEpisodios(
  avaliacao: PontoAvaliado[],
  reaisPorKwh: number,
  ultimaCompetencia: Competencia | undefined,
  ucId?: string,
): EpisodioAnomalia[] {
  const episodios: EpisodioAnomalia[] = [];
  let atual: PontoAvaliado[] = [];

  const fechar = () => {
    if (!atual.length) return;
    const excessos = atual.map((p) => p.valor - (p.esperado ?? p.valor));
    const excessoKwhTotal = soma(atual.map((p, i) => excessos[i] * p.dias));
    const fim = atual[atual.length - 1].competencia;
    episodios.push({
      ucId,
      inicio: atual[0].competencia,
      fim,
      meses: atual.map((p) => p.competencia),
      desvioMedio: media(atual.map((p) => p.desvio ?? 0)),
      desvioMaximo: Math.max(...atual.map((p) => p.desvio ?? 0)),
      excessoKwhDiaMedio: media(excessos),
      excessoKwhDiaRecente: media(excessos.slice(-3)),
      excessoKwhTotal,
      custoExcesso: excessoKwhTotal * reaisPorKwh,
      ativo: fim === ultimaCompetencia,
      severidade: atual.some((p) => p.severidade === "critico") ? "critico" : "atencao",
    });
    atual = [];
  };

  for (const p of avaliacao) {
    if (p.status === "alta") {
      const anterior = atual[atual.length - 1];
      if (anterior && somarMeses(anterior.competencia, 1) !== p.competencia) fechar();
      atual.push(p);
    } else {
      fechar();
    }
  }
  fechar();
  return episodios;
}

/* ------------------------------------------------------------------ */
/* Linha de base                                                       */
/* ------------------------------------------------------------------ */

export interface LinhaDeBase {
  /** Média do valor (kWh/dia, R$…) nos meses usados */
  valor: number;
  meses: Competencia[];
  inicio: Competencia;
  fim: Competencia;
  /** Menos de 12 meses disponíveis */
  parcial: boolean;
  excluidosPorAnomalia: Competencia[];
  ocupacaoMedia: number;
  /** Variação normal (desvio padrão ÷ média) */
  variacaoNormal: number;
}

export interface EntradaLinhaDeBase {
  competencia: Competencia;
  valor: number;
  ocupadas: number;
  anomalo?: boolean;
}

/** Média dos `quantidade` meses anteriores a `antesDe`, sem meses anômalos */
export function calcularLinhaDeBase(
  entradas: EntradaLinhaDeBase[],
  antesDe: Competencia,
  quantidade = 12,
): LinhaDeBase | null {
  const inicioJanela = somarMeses(antesDe, -quantidade);
  const janela = entradas.filter((e) => e.competencia >= inicioJanela && e.competencia < antesDe && e.valor > 0);
  const usados = janela.filter((e) => !e.anomalo);
  if (!usados.length) return null;
  const valores = usados.map((e) => e.valor);
  const valor = media(valores);
  const ordenados = [...usados].sort((a, b) => a.competencia.localeCompare(b.competencia));
  return {
    valor,
    meses: ordenados.map((e) => e.competencia),
    inicio: ordenados[0].competencia,
    fim: ordenados[ordenados.length - 1].competencia,
    parcial: janela.length < quantidade,
    excluidosPorAnomalia: janela.filter((e) => e.anomalo).map((e) => e.competencia),
    ocupacaoMedia: media(usados.map((e) => e.ocupadas)),
    variacaoNormal: valor > 0 ? desvioPadrao(valores) / valor : 0,
  };
}

/** Linha de base levada para a ocupação de um mês */
export function linhaDeBaseAjustada(base: LinhaDeBase, ocupadas: number) {
  return base.valor * fatorOcupacao(ocupadas, base.ocupacaoMedia);
}
