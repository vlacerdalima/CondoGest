import type { Competencia, DataISO } from "../tipos";

/**
 * "Hoje" da demonstração. Fixo de propósito: deixa os dados determinísticos
 * (servidor = navegador, prerender estável) e os status de vencimento coerentes.
 * Para "avançar o tempo" da demo, mude esta data e a última competência.
 */
export const DATA_REFERENCIA: DataISO = "2026-11-21";

/** Última competência com contas emitidas na demonstração */
export const COMPETENCIA_ATUAL: Competencia = "2026-11";

/** Quantos meses de histórico a demonstração tem (inclui a competência atual) */
export const MESES_DE_HISTORICO = 24;

/** Soma meses a uma competência: ("2026-11", -1) → "2026-10" */
export function somarMeses(c: Competencia, meses: number): Competencia {
  const [ano, mes] = c.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

/** Lista de competências em ordem crescente, terminando em `ate` */
export function listarCompetencias(ate: Competencia = COMPETENCIA_ATUAL, quantidade = MESES_DE_HISTORICO) {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(ate, i - (quantidade - 1)));
}

/** Competências da demonstração: dez/2024 … nov/2026 */
export const COMPETENCIAS_DEMO: Competencia[] = listarCompetencias();

/** Soma dias a uma data ISO (sem fuso — usa UTC) */
export function somarDias(d: DataISO, dias: number): DataISO {
  const data = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Diferença em dias (b − a) */
export function diferencaEmDias(a: DataISO, b: DataISO) {
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}
