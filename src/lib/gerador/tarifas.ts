/**
 * Tarifas, tributos e bandeiras FICTÍCIOS (mas com ordem de grandeza
 * plausível para uma distribuidora do Nordeste em 2026).
 *
 * Tributos "por dentro" (como nas faturas reais):
 *   preço com tributos = tarifa ÷ [(1 − PIS − COFINS) × (1 − ICMS)]
 *   ICMS = valor × 20,5% (a base do ICMS é o próprio valor com tributos)
 *   PIS/COFINS = (valor − ICMS) × alíquota
 */
import type { Bandeira, Competencia } from "../tipos";

export const ALIQUOTA_PIS = 0.0117;
export const ALIQUOTA_COFINS = 0.0539;
export const ALIQUOTA_ICMS = 0.205;
/** ≈ 0,7428 */
export const FATOR_TRIBUTOS = (1 - ALIQUOTA_PIS - ALIQUOTA_COFINS) * (1 - ALIQUOTA_ICMS);

export const comTributos = (tarifaSemTributos: number) => tarifaSemTributos / FATOR_TRIBUTOS;

/** Limite do fator de potência (abaixo disso há cobrança de reativo excedente) */
export const FATOR_POTENCIA_REFERENCIA = 0.92;

/**
 * Tarifas SEM tributos na vigência 2026-05 em diante (índice 1,000).
 * Com tributos ficam ≈: B3 TUSD 0,720 · TE 0,355 | A4 verde cativo: demanda
 * 13,14/kW · ponta 2,30/kWh · fora ponta 0,53/kWh | A4 livre: fio 13,14/kW ·
 * encargo ponta 0,843/kWh · fora ponta 0,166/kWh.
 */
export const TARIFAS = {
  b3: { tusd: 0.535, te: 0.264 },
  a4VerdeCativo: {
    demanda: 9.7604,
    tusdPonta: 1.20338,
    tePonta: 0.50506,
    tusdForaPonta: 0.12331,
    teForaPonta: 0.27037,
    reativo: 0.23963,
  },
  a4VerdeLivre: {
    fio: 9.7604,
    encargoPonta: 0.62619,
    encargoForaPonta: 0.12331,
    reativo: 0.23963,
  },
} as const;

/** Reajuste tarifário anual (fictício) em 29/04 — aplicado por competência a partir de maio */
export const DATA_REAJUSTE_TARIFARIO = "29/04";

export function indiceTarifario(c: Competencia): number {
  if (c >= "2028-05") return 1.098;
  if (c >= "2027-05") return 1.049;
  if (c >= "2026-05") return 1;
  if (c >= "2025-05") return 0.951;
  if (c >= "2024-05") return 0.912;
  if (c >= "2023-05") return 0.884;
  return 0.851;
}

/** Preço do contrato de energia no mercado livre (R$/MWh, sem ICMS), reajustado todo janeiro */
export function precoContratoLivreMwh(c: Competencia): number {
  const ano = Number(c.slice(0, 4));
  const tabela: Record<number, number> = { 2022: 196.3, 2023: 204.9, 2024: 214.8, 2025: 222.6, 2026: 232.4, 2027: 242.9 };
  if (tabela[ano]) return tabela[ano];
  return ano < 2022 ? 196.3 : Math.round(242.9 * Math.pow(1.045, ano - 2027) * 10) / 10;
}

/** Perdas na rede básica e PROINFA aplicados à energia do mercado livre */
export const PERDAS_LIVRE = 0.03;
export const PROINFA_LIVRE = 0.02;

/* ------------------------------ bandeiras ------------------------------ */

/** Adicional das bandeiras (R$/kWh, sem tributos) */
export const ADICIONAL_BANDEIRA: Record<Bandeira, number> = {
  verde: 0,
  amarela: 0.01885,
  vermelha_1: 0.04463,
  vermelha_2: 0.07877,
  escassez_hidrica: 0.142,
};

export const ROTULO_BANDEIRA: Record<Bandeira, string> = {
  verde: "Verde",
  amarela: "Amarela",
  vermelha_1: "Vermelha patamar 1",
  vermelha_2: "Vermelha patamar 2",
  escassez_hidrica: "Escassez hídrica",
};

export const ITEM_BANDEIRA: Record<Bandeira, string> = {
  verde: "Band. VERDE",
  amarela: "Acrés. Band. AMARELA",
  vermelha_1: "Acrés. Band. VERMELHA P1",
  vermelha_2: "Acrés. Band. VERMELHA P2",
  escassez_hidrica: "Acrés. Band. ESC. HÍDRICA",
};

export const BANDEIRAS: Bandeira[] = ["verde", "amarela", "vermelha_1", "vermelha_2", "escassez_hidrica"];

/**
 * Calendário FICTÍCIO de bandeiras por mês civil. A fatura aplica cada bandeira
 * proporcionalmente aos dias do ciclo de leitura que caem em cada mês.
 * 2º semestre de 2026 com amarela/vermelha (história da demonstração).
 */
const CALENDARIO_BANDEIRAS: Record<Competencia, Bandeira> = {
  "2024-08": "amarela",
  "2024-09": "vermelha_2",
  "2024-10": "vermelha_1",
  "2024-11": "amarela",
  "2025-05": "amarela",
  "2025-06": "vermelha_1",
  "2025-07": "amarela",
  "2025-08": "vermelha_1",
  "2025-09": "amarela",
  "2025-10": "amarela",
  "2026-07": "amarela",
  "2026-08": "vermelha_1",
  "2026-09": "vermelha_2",
  "2026-10": "vermelha_1",
  "2026-11": "amarela",
};

/** Bandeira de um mês civil ("AAAA-MM"). Depois de 2026 segue um padrão sazonal típico. */
export function bandeiraDoMesCivil(mes: Competencia): Bandeira {
  if (mes <= "2026-12") return CALENDARIO_BANDEIRAS[mes] ?? "verde";
  const m = Number(mes.slice(5, 7));
  if (m >= 7 && m <= 10) return m === 9 ? "vermelha_1" : "amarela";
  if (m === 6 || m === 11) return "amarela";
  return "verde";
}
