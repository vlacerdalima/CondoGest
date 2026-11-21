import type { Categoria, Competencia, DataISO } from "./tipos";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const numero1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numero2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** R$ 6.422,84 */
export const formatarMoeda = (valor: number) => brl.format(valor);
/** R$ 20,5 mil */
export const formatarMoedaCompacta = (valor: number) => brlCompacto.format(valor);
/** 7.806 */
export const formatarNumero = (valor: number) => numero.format(valor);
/** 7.806,0 */
export const formatarNumero1 = (valor: number) => numero1.format(valor);
/** 0,72 */
export const formatarNumero2 = (valor: number) => numero2.format(valor);
/** 7.806 kWh */
export const formatarKwh = (valor: number) => `${numero.format(valor)} kWh`;
/** 251,8 kWh/dia */
export const formatarKwhDia = (valor: number) => `${numero1.format(valor)} kWh/dia`;
/** 150 kW */
export const formatarKw = (valor: number) => `${numero.format(valor)} kW`;
/** R$ 0,82/kWh */
export const formatarTarifa = (valor: number) => `${brl.format(valor)}/kWh`;
/** +12,3% / −4,0% (sinal tipográfico) */
export function formatarPercentual(valor: number, opcoes: { sinal?: boolean; casas?: number } = {}) {
  const { sinal = false, casas = 1 } = opcoes;
  const fmt = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  const texto = `${fmt.format(Math.abs(valor))}%`;
  if (!sinal) return valor < 0 ? `−${texto}` : texto;
  if (valor > 0) return `+${texto}`;
  if (valor < 0) return `−${texto}`;
  return texto;
}
/** R$ 1.200 – R$ 1.800 */
export const formatarFaixaMoeda = (faixa: { min: number; max: number }) =>
  `${formatarMoeda(faixa.min).replace(",00", "")} – ${formatarMoeda(faixa.max).replace(",00", "")}`;

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
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

/** "2026-11" → "nov/26" */
export function formatarCompetencia(c: Competencia) {
  const [ano, mes] = c.split("-").map(Number);
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}
/** "2026-11" → "novembro de 2026" */
export function formatarCompetenciaLonga(c: Competencia) {
  const [ano, mes] = c.split("-").map(Number);
  return `${MESES_LONGOS[mes - 1]} de ${ano}`;
}
/** "2026-11-21" → "21/11/2026" */
export function formatarData(d: DataISO) {
  const [ano, mes, dia] = d.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
/** "2026-11-21" → "21 nov" */
export function formatarDataCurta(d: DataISO) {
  const [, mes, dia] = d.slice(0, 10).split("-").map(Number);
  return `${dia} ${MESES_CURTOS[mes - 1]}`;
}

export const ROTULOS_CATEGORIA: Record<Categoria, string> = {
  energia: "Energia",
  agua: "Água",
  gas: "Gás",
  manutencao: "Manutenção",
  limpeza: "Limpeza",
  seguranca: "Segurança",
  elevadores: "Elevadores",
  pessoal: "Pessoal",
  administracao: "Administração",
  seguros: "Seguros",
  outros: "Outros",
};
