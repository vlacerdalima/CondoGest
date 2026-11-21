/**
 * Formatação para o PDF. As fontes padrão do PDF (Helvetica) só têm os
 * caracteres do WinAnsi: nada de espaço fino/rígido do Intl, "−" ou "≈".
 */
import type { Competencia, DataISO } from "../../tipos";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const cacheFormatos = new Map<number, Intl.NumberFormat>();
function formato(casas: number) {
  let f = cacheFormatos.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    cacheFormatos.set(casas, f);
  }
  return f;
}

const limpar = (s: string) => s.replace(/[  ]/g, " ").replace(/−/g, "-");

/** 1.234,56 (casas fixas) */
export const num = (v: number, casas = 0) => limpar(formato(casas).format(v));
/** R$ 1.234,56 / -R$ 12,30 */
export const moeda = (v: number) => (v < 0 ? `-R$ ${num(-v, 2)}` : `R$ ${num(v, 2)}`);
/** 20,50 */
export const pct = (v: number, casas = 2) => num(v, casas);
/** 21/11/2026 */
export const data = (d: DataISO) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
/** 07/2026 */
export const refMesAno = (c: Competencia) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
/** JUL/26 */
export const mesAnoCurto = (c: Competencia) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
/** julho de 2026 */
export const mesAnoLongo = (c: Competencia) => `${MESES_LONGOS[Number(c.slice(5, 7)) - 1]} de ${c.slice(0, 4)}`;
