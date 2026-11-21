/**
 * Perfis de consumo por UC — a "física" do gerador.
 *
 * A demonstração (src/lib/dados/seed-energia.ts) e a página do gerador usam
 * os MESMOS perfis e a mesma semente: gerar a competência 2026-11 da UC
 * "uc-rp-bt" com a semente padrão reproduz exatamente a conta da demo, e
 * gerar 2026-12 continua a série (leituras do medidor encadeadas).
 *
 * As "histórias" da demo (anomalias que as análises devem detectar) estão
 * aqui como `eventos` e documentadas no topo do seed.
 */
import type { Competencia, UnidadeConsumidora } from "../tipos";
import type { UcAvulsa } from "./tipos";

export interface EventoConsumo {
  de: Competencia;
  /** Inclusive. Ausente = continua indefinidamente */
  ate?: Competencia;
  /** Multiplica o consumo (kWh/dia) */
  fatorConsumo?: number;
  /** Substitui o fator de potência médio no período */
  fatorPotencia?: number;
  /** Multiplica a fração de consumo na ponta */
  fatorPonta?: number;
  motivo: string;
}

export interface PerfilConsumo {
  /** kWh/dia na ocupação inicial da demo, sem sazonalidade */
  kwhDiaBase: number;
  /** Amplitude da sazonalidade (0,06 = ±6%) */
  amplitudeSazonal: number;
  /** Dia do ano de maior consumo (15 = meados de janeiro; 172 = fim de junho) */
  diaPicoSazonal: number;
  /** Desvio padrão relativo do ruído mensal */
  ruido: number;
  /** Quanto o consumo acompanha a ocupação (1 = proporcional; 0 = não muda) */
  elasticidadeOcupacao: number;
  /** A4: fração do consumo no horário de ponta */
  fracaoPonta?: number;
  /** A4: fator de carga = kWh ÷ (demanda máxima × horas do ciclo) */
  fatorCarga?: number;
  /** A4: demanda na ponta ÷ demanda máxima */
  razaoDemandaPonta?: number;
  fatorPotencia: number;
  /** Constante de multiplicação do medidor (kWh por unidade do registrador) */
  constanteMedidor: number;
  /** Dia típico da leitura no mês da competência (2–9) */
  diaLeitura: number;
  /** Dia de vencimento escolhido (fatura da distribuidora) */
  diaVencimento: number;
  /** Mercado livre: dia de vencimento da fatura da comercializadora */
  diaVencimentoComercializadora?: number;
  /** Contribuição de iluminação pública (R$, índice tarifário 1,000) */
  iluminacaoPublica: number;
  /** Probabilidade mensal de aparecer o item ICMS-CDE */
  chanceCde: number;
  /** Probabilidade mensal de crédito de compensação DIC */
  chanceDic: number;
  /** Mercado livre: faixa do ajuste "Dif. Desc. Ft.Alter." (fração do uso do sistema) */
  descontoFonteIncentivada?: [number, number];
  eventos?: EventoConsumo[];
}

/** Perfis calibrados da carteira de demonstração */
export const PERFIS_DEMO: Record<string, PerfilConsumo> = {
  // Reserva das Palmeiras — MT, A4 verde LIVRE, 150 kW contratados (superdimensionado:
  // a demanda medida fica em ~60–95 kW). Bombas do poço e a ETE rodam na ponta.
  "uc-rp-mt": {
    kwhDiaBase: 526,
    amplitudeSazonal: 0.06,
    diaPicoSazonal: 15,
    ruido: 0.025,
    elasticidadeOcupacao: 0.4,
    fracaoPonta: 0.14,
    fatorCarga: 0.31,
    razaoDemandaPonta: 0.74,
    fatorPotencia: 0.955,
    constanteMedidor: 8,
    diaLeitura: 3,
    diaVencimento: 22,
    diaVencimentoComercializadora: 18,
    iluminacaoPublica: 312.4,
    chanceCde: 0.25,
    chanceDic: 0.08,
    descontoFonteIncentivada: [0.02, 0.045],
  },
  // Reserva das Palmeiras — BT, B3. Iluminação viária: consumo quase constante,
  // um pouco maior no inverno (noites mais longas).
  "uc-rp-bt": {
    kwhDiaBase: 236,
    amplitudeSazonal: 0.025,
    diaPicoSazonal: 172,
    ruido: 0.018,
    elasticidadeOcupacao: 0.12,
    fatorPotencia: 0.93,
    constanteMedidor: 1,
    diaLeitura: 4,
    diaVencimento: 20,
    iluminacaoPublica: 288.72,
    chanceCde: 0.2,
    chanceDic: 0.14,
    eventos: [
      {
        de: "2026-09",
        ate: "2026-09",
        fatorConsumo: 1.135,
        motivo: "Fotocélulas da iluminação viária com defeito: postes acesos durante o dia",
      },
      {
        de: "2026-10",
        fatorConsumo: 1.165,
        motivo: "Fotocélulas da iluminação viária com defeito: postes acesos durante o dia",
      },
    ],
  },
  // Mirante do Capibaribe — MT, A4 verde CATIVO, 90 kW. Banco de capacitores com
  // defeito → fator de potência baixo e reativo excedente em vários meses.
  "uc-mc-mt": {
    kwhDiaBase: 690,
    amplitudeSazonal: 0.07,
    diaPicoSazonal: 15,
    ruido: 0.025,
    elasticidadeOcupacao: 0.3,
    fracaoPonta: 0.085,
    fatorCarga: 0.4,
    razaoDemandaPonta: 0.86,
    fatorPotencia: 0.95,
    constanteMedidor: 4,
    diaLeitura: 6,
    diaVencimento: 25,
    iluminacaoPublica: 245.18,
    chanceCde: 0.25,
    chanceDic: 0.1,
    eventos: [
      { de: "2025-10", ate: "2026-01", fatorPotencia: 0.875, motivo: "Banco de capacitores com estágio queimado" },
      { de: "2026-04", ate: "2026-05", fatorPotencia: 0.89, motivo: "Banco de capacitores desligado após manutenção" },
      { de: "2026-07", fatorPotencia: 0.86, motivo: "Banco de capacitores fora de operação" },
    ],
  },
  "uc-jbv-bt": {
    kwhDiaBase: 305,
    amplitudeSazonal: 0.06,
    diaPicoSazonal: 15,
    ruido: 0.025,
    elasticidadeOcupacao: 0.3,
    fatorPotencia: 0.94,
    constanteMedidor: 1,
    diaLeitura: 5,
    diaVencimento: 28,
    iluminacaoPublica: 198.6,
    chanceCde: 0.2,
    chanceDic: 0.1,
  },
  // Villa Aldeia — consumo acompanha a ocupação (41 → 45 casas).
  "uc-va-bt": {
    kwhDiaBase: 97,
    amplitudeSazonal: 0.05,
    diaPicoSazonal: 15,
    ruido: 0.022,
    elasticidadeOcupacao: 1,
    fatorPotencia: 0.93,
    constanteMedidor: 1,
    diaLeitura: 7,
    diaVencimento: 19,
    iluminacaoPublica: 96.35,
    chanceCde: 0.15,
    chanceDic: 0.1,
  },
  // Atlântico Sul — vencimento cedo (dia 16): a conta de nov/2026 está vencida na demo.
  "uc-as-bt": {
    kwhDiaBase: 172,
    amplitudeSazonal: 0.05,
    diaPicoSazonal: 15,
    ruido: 0.025,
    elasticidadeOcupacao: 0.2,
    fatorPotencia: 0.92,
    constanteMedidor: 1,
    diaLeitura: 3,
    diaVencimento: 16,
    iluminacaoPublica: 142.9,
    chanceCde: 0.2,
    chanceDic: 0.1,
  },
};

/** Perfil genérico para UCs sem calibração (novas UCs da carteira ou UC avulsa) */
export function perfilGenerico(
  uc: Pick<UnidadeConsumidora, "subgrupo" | "ambiente" | "demandaContratadaKw">,
  consumoMedioKwh?: number,
): PerfilConsumo {
  const a4 = uc.subgrupo === "A4";
  const consumo = consumoMedioKwh && consumoMedioKwh > 0 ? consumoMedioKwh : a4 ? 15_000 : 6_000;
  return {
    kwhDiaBase: consumo / 30.4,
    amplitudeSazonal: 0.05,
    diaPicoSazonal: 15,
    ruido: 0.025,
    elasticidadeOcupacao: 0,
    fracaoPonta: a4 ? 0.1 : undefined,
    fatorCarga: a4 ? 0.36 : undefined,
    razaoDemandaPonta: a4 ? 0.8 : undefined,
    fatorPotencia: 0.94,
    constanteMedidor: a4 ? 8 : 1,
    diaLeitura: 5,
    diaVencimento: 21,
    diaVencimentoComercializadora: uc.ambiente === "livre" ? 18 : undefined,
    iluminacaoPublica: a4 ? 260 : 150,
    chanceCde: 0.2,
    chanceDic: 0.1,
    descontoFonteIncentivada: uc.ambiente === "livre" ? [0.02, 0.04] : undefined,
  };
}

export function perfilDaUcAvulsa(uc: UcAvulsa): PerfilConsumo {
  return perfilGenerico(
    { subgrupo: uc.subgrupo, ambiente: uc.ambiente, demandaContratadaKw: uc.demandaContratadaKw },
    uc.consumoMedioKwh,
  );
}

export function eventosAtivos(perfil: PerfilConsumo, c: Competencia) {
  return (perfil.eventos ?? []).filter((e) => c >= e.de && (!e.ate || c <= e.ate));
}
