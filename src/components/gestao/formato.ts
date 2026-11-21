/** Formatadores extras usados só nas telas de gestão (os gerais ficam em lib/formatacao). */

const brlInteiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** R$ 166.315 (sem centavos — para KPIs e totais grandes) */
export const formatarMoedaInteira = (valor: number) => brlInteiro.format(Math.round(valor));

/** 1,4 MB · 820 KB */
export function formatarTamanhoArquivo(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** "21/11/2026 14:32" a partir de um ISO datetime (só no navegador: usa o fuso local) */
export function formatarDataHora(iso: string) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : dataHora.format(data);
}

/** "sábado, 21 de novembro de 2026" (sem fuso: a data é tratada como UTC) */
export function formatarDataPorExtenso(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dataIso.slice(0, 10)}T12:00:00Z`));
}

/** "R$ 6,0 – 9,3 mil" · "R$ 450 – 900" (faixas de impacto em KPIs) */
export function formatarFaixaCompacta(faixa: { min: number; max: number }) {
  if (faixa.max >= 1000) {
    const f = (v: number) => (v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `R$ ${f(faixa.min)} – ${f(faixa.max)} mil`;
  }
  return `R$ ${Math.round(faixa.min).toLocaleString("pt-BR")} – ${Math.round(faixa.max).toLocaleString("pt-BR")}`;
}

/** "R$ 58 mil" · "R$ 1,2 mi" · "R$ 830" */
export function formatarMoedaCurta(valor: number) {
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 10_000) return `${sinal}R$ ${Math.round(abs / 1000).toLocaleString("pt-BR")} mil`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${Math.round(abs).toLocaleString("pt-BR")}`;
}

/** Faixa de impacto: "R$ 1.200 – R$ 1.800" ou "R$ 2.887" quando mín = máx */
export function formatarImpacto(faixa: { min: number; max: number }) {
  const f = (v: number) => brlInteiro.format(Math.round(v));
  return Math.round(faixa.min) === Math.round(faixa.max) ? f(faixa.max) : `${f(faixa.min)} – ${f(faixa.max)}`;
}

/** "novembro de 2026" → "Novembro de 2026" */
export const maiusculaInicial = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
