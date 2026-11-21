/**
 * Série mensal de uma UC: datas de leitura encadeadas, registradores
 * acumulados do medidor, consumo (ponta/fora ponta), demanda e reativo.
 *
 * A série parte de uma competência-âncora fixa e é calculada mês a mês, com
 * um PRNG por (UC, competência). Assim qualquer competência sai sempre igual,
 * a "leitura anterior" de um mês é a "leitura atual" do mês anterior e o
 * histórico de 13 meses da fatura é a própria série.
 *
 * Consumo = (leitura atual − leitura anterior) × constante do medidor (exato).
 */
import { criarPrng, hashString } from "../prng";
import type { Competencia, Condominio, DataISO, UnidadeConsumidora } from "../tipos";
import { CONDOMINIOS, UNIDADES_CONSUMIDORAS, unidadesOcupadas } from "../dados/condominios";
import { COMPETENCIAS_DEMO, diferencaEmDias, somarDias, somarMeses } from "../dados/referencia";
import { eventosAtivos, perfilDaUcAvulsa, perfilGenerico, PERFIS_DEMO, type PerfilConsumo } from "./perfis";
import { FATOR_POTENCIA_REFERENCIA } from "./tarifas";
import type { UcAvulsa } from "./tipos";

/** A série começa aqui (a âncora só define a primeira leitura) */
export const COMPETENCIA_ANCORA: Competencia = "2021-12";
/** Faixa de competências que o gerador aceita */
export const COMPETENCIA_MINIMA: Competencia = "2023-01";
export const COMPETENCIA_MAXIMA: Competencia = "2030-12";
/** Semente da série da demonstração */
export const SEMENTE_PADRAO = "demo";

export interface ContextoUc {
  /** Chave estável da série (cache + PRNG) */
  chave: string;
  uc: UnidadeConsumidora;
  condominio?: Condominio;
  perfil: PerfilConsumo;
  avulsa: boolean;
  nomeCliente: string;
  /** Índice estável para documentos fictícios */
  indice: number;
}

export interface Registradores {
  ativaPonta: number;
  ativaForaPonta: number;
  reativaPonta: number;
  reativaForaPonta: number;
}

export interface MesSerie {
  competencia: Competencia;
  leituraAnterior: DataISO;
  leituraAtual: DataISO;
  dias: number;
  registrosAnteriores: Registradores;
  registrosAtuais: Registradores;
  consumoKwh: number;
  consumoPontaKwh: number;
  consumoForaPontaKwh: number;
  reativoPontaKvarh: number;
  reativoForaPontaKvarh: number;
  fatorPotencia: number;
  excedentePontaKvarh: number;
  excedenteForaPontaKvarh: number;
  /** A4: demanda máxima medida no ciclo e na ponta */
  demandaKw?: number;
  demandaPontaKw?: number;
  /** A4: registradores de demanda (unidades do medidor) */
  leituraDemanda?: number;
  leituraDemandaPonta?: number;
  demandaReativaExcedenteKvar?: number;
  /** Itens eventuais */
  cde?: number;
  dic?: { valor: number; referencia: Competencia };
  /** Mercado livre: fração do ajuste de desconto (0 = sem ajuste no mês) */
  descontoFonte?: number;
  motivos: string[];
}

export interface EntradaMes {
  consumoKwh?: number;
  dias?: number;
  demandaMedidaKw?: number;
  semente?: string;
}

/* ------------------------------ contexto ------------------------------ */

const ehAvulsa = (uc: string | UcAvulsa): uc is UcAvulsa => typeof uc !== "string";

export function contextoDaUc(uc: string | UcAvulsa): ContextoUc {
  if (!ehAvulsa(uc)) {
    const daCarteira = UNIDADES_CONSUMIDORAS.find((u) => u.id === uc);
    if (!daCarteira) throw new Error(`UC "${uc}" não existe na carteira de demonstração`);
    const condominio = CONDOMINIOS.find((c) => c.id === daCarteira.condominioId);
    return {
      chave: daCarteira.id,
      uc: daCarteira,
      condominio,
      perfil: PERFIS_DEMO[daCarteira.id] ?? perfilGenerico(daCarteira),
      avulsa: false,
      nomeCliente: `Condomínio ${condominio?.nome.replace(/^(Condomínio|Edifício|Residencial)\s+/i, "") ?? daCarteira.apelido}`,
      indice: UNIDADES_CONSUMIDORAS.indexOf(daCarteira),
    };
  }
  const numeroUc = uc.numeroUc.trim() || "0.000.000.000-0";
  const demanda = uc.subgrupo === "A4" ? Math.max(30, Math.round(uc.demandaContratadaKw ?? 100)) : undefined;
  const consumo = uc.consumoMedioKwh && uc.consumoMedioKwh > 0 ? Math.round(uc.consumoMedioKwh) : undefined;
  const chave = `avulsa:${numeroUc}:${uc.subgrupo}:${uc.ambiente}:${demanda ?? 0}:${consumo ?? 0}`;
  const h = hashString(numeroUc);
  const a4 = uc.subgrupo === "A4";
  return {
    chave,
    uc: {
      id: "",
      condominioId: "",
      apelido: `UC avulsa nº ${numeroUc}`,
      numeroUc,
      numeroMedidor: String(a4 ? 90_000_000 + (h % 99_999) : 41_000_000 + (h % 999_999)),
      distribuidora: "",
      subgrupo: uc.subgrupo,
      modalidade: a4 ? "verde" : "convencional",
      ambiente: a4 ? uc.ambiente : "cativo",
      demandaContratadaKw: demanda,
      cargas: [],
    },
    perfil: perfilDaUcAvulsa({ ...uc, demandaContratadaKw: demanda, consumoMedioKwh: consumo }),
    avulsa: true,
    nomeCliente: uc.nomeCliente?.trim() || "Cliente avulso (fictício)",
    indice: h % 97,
  };
}

/* ------------------------------ datas ------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Dia do ano (1–366) de uma data ISO */
function diaDoAno(d: DataISO) {
  return diferencaEmDias(`${d.slice(0, 4)}-01-01`, d) + 1;
}

/** Escolhe a leitura do mês (dia 2–9) mantendo o ciclo entre 28 e 33 dias */
function escolherLeitura(anterior: DataISO, competencia: Competencia, diaPreferido: number, desvio: number): DataISO {
  const alvo = diaPreferido + desvio;
  let melhor: { data: DataISO; distancia: number } | null = null;
  for (let dia = 2; dia <= 9; dia++) {
    const data = `${competencia}-${pad2(dia)}`;
    const dias = diferencaEmDias(anterior, data);
    if (dias < 28 || dias > 33) continue;
    const distancia = Math.abs(dia - alvo);
    if (!melhor || distancia < melhor.distancia) melhor = { data, distancia };
  }
  return melhor?.data ?? somarDias(anterior, 30);
}

/* ------------------------------ cálculo do mês ------------------------------ */

const TAN_REFERENCIA = Math.tan(Math.acos(FATOR_POTENCIA_REFERENCIA));
const arred2 = (v: number) => Math.round(v * 100) / 100;
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function fatorOcupacao(ctx: ContextoUc, c: Competencia) {
  if (!ctx.condominio || ctx.perfil.elasticidadeOcupacao === 0) return 1;
  const inicial = unidadesOcupadas(ctx.condominio, COMPETENCIAS_DEMO[0]);
  const atual = unidadesOcupadas(ctx.condominio, c);
  return 1 + ctx.perfil.elasticidadeOcupacao * (atual / inicial - 1);
}

function calcularMes(
  ctx: ContextoUc,
  competencia: Competencia,
  anterior: { leitura: DataISO; registros: Registradores },
  entrada: EntradaMes,
): MesSerie {
  const semente = entrada.semente ?? SEMENTE_PADRAO;
  const p = ctx.perfil;
  const a4 = ctx.uc.subgrupo === "A4";
  const k = p.constanteMedidor;

  // Sorteios SEMPRE na mesma ordem (determinismo independe dos campos manuais)
  const r = criarPrng(`${semente}:mes:${ctx.chave}:${competencia}`);
  const zConsumo = r.normal();
  const zPonta = r.normal();
  const zFp = r.normal();
  const zCarga = r.normal();
  const zDemPonta = r.normal();
  const desvioLeitura = r.inteiro(-2, 2);
  const uCde = r.proximo();
  const vCde = r.proximo();
  const uDic = r.proximo();
  const vDic = r.proximo();
  const refDic = r.inteiro(1, 3);
  const uDesc = r.proximo();
  const vDesc = r.proximo();

  const leituraAnterior = anterior.leitura;
  const leituraAtual =
    entrada.dias !== undefined
      ? somarDias(leituraAnterior, limitar(Math.round(entrada.dias), 1, 62))
      : escolherLeitura(leituraAnterior, competencia, p.diaLeitura, desvioLeitura);
  const dias = diferencaEmDias(leituraAnterior, leituraAtual);

  const eventos = eventosAtivos(p, competencia);
  const fatorEventos = eventos.reduce((f, e) => f * (e.fatorConsumo ?? 1), 1);
  const fatorPontaEventos = eventos.reduce((f, e) => f * (e.fatorPonta ?? 1), 1);
  const fpEvento = eventos.find((e) => e.fatorPotencia !== undefined)?.fatorPotencia;

  const meio = somarDias(leituraAnterior, Math.round(dias / 2));
  const sazonal = 1 + p.amplitudeSazonal * Math.cos((2 * Math.PI * (diaDoAno(meio) - p.diaPicoSazonal)) / 365.25);
  const kwhDia = p.kwhDiaBase * sazonal * fatorOcupacao(ctx, competencia) * fatorEventos * (1 + p.ruido * zConsumo);
  const alvo = Math.max(0, entrada.consumoKwh ?? kwhDia * dias);

  const fracaoPonta = a4 ? limitar((p.fracaoPonta ?? 0.1) * fatorPontaEventos * (1 + 0.07 * zPonta), 0.01, 0.6) : 0;
  const pulsosPonta = a4 ? Math.round((alvo * fracaoPonta) / k) : 0;
  const pulsosForaPonta = Math.round((alvo * (1 - fracaoPonta)) / k);
  const consumoPontaKwh = arred2(pulsosPonta * k);
  const consumoForaPontaKwh = arred2(pulsosForaPonta * k);
  const consumoKwh = arred2(consumoPontaKwh + consumoForaPontaKwh);

  const fatorPotencia = limitar((fpEvento ?? p.fatorPotencia) + 0.006 * zFp, 0.7, 0.995);
  const tanFi = Math.tan(Math.acos(fatorPotencia));
  const pulsosReatPonta = Math.round((consumoPontaKwh * tanFi) / k);
  const pulsosReatForaPonta = Math.round((consumoForaPontaKwh * tanFi) / k);
  const reativoPontaKvarh = arred2(pulsosReatPonta * k);
  const reativoForaPontaKvarh = arred2(pulsosReatForaPonta * k);
  const excedente = (reativo: number, ativo: number) =>
    a4 ? Math.max(0, Math.round(reativo - ativo * TAN_REFERENCIA)) : 0;

  const registrosAtuais: Registradores = {
    ativaPonta: anterior.registros.ativaPonta + pulsosPonta,
    ativaForaPonta: anterior.registros.ativaForaPonta + pulsosForaPonta,
    reativaPonta: anterior.registros.reativaPonta + pulsosReatPonta,
    reativaForaPonta: anterior.registros.reativaForaPonta + pulsosReatForaPonta,
  };

  const mes: MesSerie = {
    competencia,
    leituraAnterior,
    leituraAtual,
    dias,
    registrosAnteriores: anterior.registros,
    registrosAtuais,
    consumoKwh,
    consumoPontaKwh,
    consumoForaPontaKwh,
    reativoPontaKvarh,
    reativoForaPontaKvarh,
    fatorPotencia: Math.round(fatorPotencia * 1000) / 1000,
    excedentePontaKvarh: excedente(reativoPontaKvarh, consumoPontaKwh),
    excedenteForaPontaKvarh: excedente(reativoForaPontaKvarh, consumoForaPontaKwh),
    cde: uCde < p.chanceCde ? arred2(140 + 50 * vCde) : undefined,
    dic: uDic < p.chanceDic ? { valor: -arred2(18 + 122 * vDic), referencia: somarMeses(competencia, -refDic) } : undefined,
    descontoFonte: p.descontoFonteIncentivada
      ? uDesc < 0.75
        ? p.descontoFonteIncentivada[0] + (p.descontoFonteIncentivada[1] - p.descontoFonteIncentivada[0]) * vDesc
        : 0
      : undefined,
    motivos: eventos.map((e) => e.motivo),
  };

  if (a4) {
    const horas = Math.max(1, dias) * 24;
    const bruta =
      entrada.demandaMedidaKw !== undefined
        ? Math.max(0, entrada.demandaMedidaKw)
        : consumoKwh / (horas * (p.fatorCarga ?? 0.35) * (1 + 0.06 * zCarga));
    const leituraDemanda = arred2(bruta / k);
    const demandaKw = arred2(leituraDemanda * k);
    const leituraDemandaPonta = arred2(
      Math.min(demandaKw, demandaKw * (p.razaoDemandaPonta ?? 0.8) * (1 + 0.05 * zDemPonta)) / k,
    );
    const contratada = ctx.uc.demandaContratadaKw ?? 0;
    const reativaNecessaria = (demandaKw * FATOR_POTENCIA_REFERENCIA) / fatorPotencia;
    mes.demandaKw = demandaKw;
    mes.leituraDemanda = leituraDemanda;
    mes.leituraDemandaPonta = leituraDemandaPonta;
    mes.demandaPontaKw = arred2(leituraDemandaPonta * k);
    mes.demandaReativaExcedenteKvar = Math.max(0, arred2(reativaNecessaria - Math.max(demandaKw, contratada)));
  }
  return mes;
}

/* ------------------------------ série com cache ------------------------------ */

const CACHE = new Map<string, MesSerie[]>();
const LIMITE_CACHE = 60;

function registrosIniciais(ctx: ContextoUc): Registradores {
  const h = hashString(`registros:${ctx.chave}`);
  return {
    ativaPonta: ctx.uc.subgrupo === "A4" ? 1_000 + (h % 9_000) : 0,
    ativaForaPonta: 10_000 + (h % 90_000),
    reativaPonta: ctx.uc.subgrupo === "A4" ? 500 + ((h >>> 3) % 4_000) : 0,
    reativaForaPonta: 3_000 + ((h >>> 5) % 30_000),
  };
}

export function indiceNaSerie(c: Competencia) {
  const [a0, m0] = COMPETENCIA_ANCORA.split("-").map(Number);
  const [a, m] = c.split("-").map(Number);
  return a * 12 + m - (a0 * 12 + m0) - 1;
}

/** Série padrão (semente da demo, sem campos manuais) da âncora+1 até `ate` */
export function serieBase(ctx: ContextoUc, ate: Competencia): MesSerie[] {
  let serie = CACHE.get(ctx.chave);
  if (!serie) {
    if (CACHE.size >= LIMITE_CACHE) {
      const primeira = CACHE.keys().next().value;
      if (primeira !== undefined) CACHE.delete(primeira);
    }
    serie = [];
    CACHE.set(ctx.chave, serie);
  }
  const alvo = indiceNaSerie(ate);
  while (serie.length <= alvo) {
    const competencia = somarMeses(COMPETENCIA_ANCORA, serie.length + 1);
    const anterior =
      serie.length === 0
        ? { leitura: `${COMPETENCIA_ANCORA}-${pad2(ctx.perfil.diaLeitura)}`, registros: registrosIniciais(ctx) }
        : { leitura: serie[serie.length - 1].leituraAtual, registros: serie[serie.length - 1].registrosAtuais };
    serie.push(calcularMes(ctx, competencia, anterior, {}));
  }
  return serie;
}

export function competenciaValida(c: Competencia) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(c) && c >= COMPETENCIA_MINIMA && c <= COMPETENCIA_MAXIMA;
}

/**
 * Mês da série com os campos manuais/variação aplicados + os 12 meses
 * anteriores (padrão) para o histórico.
 */
export function mesDaSerie(ctx: ContextoUc, competencia: Competencia, entrada: EntradaMes = {}) {
  if (!competenciaValida(competencia)) {
    throw new Error(`Competência ${competencia} fora da faixa ${COMPETENCIA_MINIMA} a ${COMPETENCIA_MAXIMA}`);
  }
  const serie = serieBase(ctx, competencia);
  const i = indiceNaSerie(competencia);
  const padrao =
    entrada.consumoKwh === undefined &&
    entrada.dias === undefined &&
    entrada.demandaMedidaKw === undefined &&
    (entrada.semente ?? SEMENTE_PADRAO) === SEMENTE_PADRAO;
  const mes = padrao
    ? serie[i]
    : calcularMes(
        ctx,
        competencia,
        { leitura: serie[i - 1].leituraAtual, registros: serie[i - 1].registrosAtuais },
        entrada,
      );
  return { mes, anteriores: serie.slice(Math.max(0, i - 12), i) };
}

/** Meses padrão da série (sem variação) — usado no histórico comparativo */
export function mesesPadrao(ctx: ContextoUc, de: Competencia, ate: Competencia) {
  const serie = serieBase(ctx, ate);
  return serie.slice(Math.max(0, indiceNaSerie(de)), indiceNaSerie(ate) + 1);
}
