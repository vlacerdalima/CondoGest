import type { Faixa } from "@/lib/analise/energia";
import { formatarMoeda, formatarNumero, formatarPercentual } from "@/lib/formatacao";

/** R$ 1.234 (sem centavos) */
export const reais = (v: number) => formatarMoeda(Math.round(v)).replace(",00", "");

/** R$ 650 – R$ 1.050 */
export function faixaReais(f: Faixa) {
  return f.min === f.max ? reais(f.min) : `${reais(f.min)} – ${reais(f.max)}`;
}

/** R$ 20,5 mil (eixos e textos curtos) */
export function reaisCompacto(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: a >= 10_000 ? 0 : 1 })} mil`;
  return reais(v);
}

/** 590 – 980 kWh */
export function faixaKwh(f: Faixa) {
  return f.min === f.max ? `${formatarNumero(f.min)} kWh` : `${formatarNumero(f.min)} – ${formatarNumero(f.max)} kWh`;
}

/** 2 – 10 meses / menos de 1 mês */
export function faixaMeses(f: Faixa) {
  if (f.max < 1) return "menos de 1 mês";
  const min = Math.max(1, Math.floor(f.min));
  const max = Math.max(min, Math.ceil(f.max));
  if (min === max) return `${min} ${min === 1 ? "mês" : "meses"}`;
  if (max > 36) return `${formatarNumero(min)} – ${formatarNumero(max)} meses (${(min / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} a ${(max / 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} anos)`;
  return `${min} – ${max} meses`;
}

/** +12% / −4% a partir de uma fração */
export const pct = (v: number, casas = 0, sinal = false) => formatarPercentual(v * 100, { casas, sinal });

/** Cor de série por posição fixa (1..7) */
export const corSerie = (indice: number) => `var(--chart-${((indice - 1) % 7) + 1})`;

/** Cor do "consumo total" do condomínio na tela do condomínio */
export const COR_TOTAL = "var(--energy)";
