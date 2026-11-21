/**
 * Análises gerais da carteira (todas as categorias): agregações para as telas
 * de gestão e geração de insights. Funções puras — recebem as contas (demo +
 * enviadas) e devolvem números/insights; nada de Date.now() aqui.
 *
 * DONO: agente "Gestão". Os insights de energia vêm de ./energia
 * (gerarInsightsEnergia) e são combinados em `gerarTodosInsights`.
 */
import { CONDOMINIOS, COMPETENCIA_ATUAL, DATA_REFERENCIA, diferencaEmDias, somarMeses, statusDaConta } from "../dados";
import {
  formatarCompetencia,
  formatarCompetenciaLonga,
  formatarData,
  formatarDataCurta,
  formatarMoeda,
  formatarNumero1,
  formatarPercentual,
  ROTULOS_CATEGORIA,
} from "../formatacao";
import type { Categoria, Competencia, Condominio, Conta, Insight, Severidade } from "../tipos";
import { gerarInsightsEnergia } from "./energia";

/** Inflação de referência para comparar reajustes (% em 12 meses) */
export const IPCA_REFERENCIA = 4.5;

/* ------------------------------------------------------------------ */
/* Grupos de categoria (gráficos)                                      */
/* ------------------------------------------------------------------ */

export interface GrupoCategoria {
  id: string;
  rotulo: string;
  categorias: Categoria[];
  /** Cor fixa do grupo (paleta validada, em ordem). "Outros" usa o cinza de apoio. */
  cor: string;
}

/**
 * Ordem FIXA dos grupos nos gráficos empilhados (de baixo para cima). A cor
 * segue o grupo em todas as telas — nunca a posição no ranking.
 */
export const GRUPOS_CATEGORIA: GrupoCategoria[] = [
  { id: "pessoal", rotulo: "Pessoal", categorias: ["pessoal"], cor: "var(--chart-1)" },
  { id: "manutencao", rotulo: "Manutenção e elevadores", categorias: ["manutencao", "elevadores"], cor: "var(--chart-2)" },
  { id: "agua", rotulo: "Água e gás", categorias: ["agua", "gas"], cor: "var(--chart-3)" },
  { id: "energia", rotulo: "Energia", categorias: ["energia"], cor: "var(--chart-4)" },
  { id: "limpeza", rotulo: "Limpeza e jardinagem", categorias: ["limpeza"], cor: "var(--chart-5)" },
  { id: "seguranca", rotulo: "Segurança", categorias: ["seguranca"], cor: "var(--chart-6)" },
  { id: "outros", rotulo: "Outros", categorias: ["administracao", "seguros", "outros"], cor: "var(--chart-axis)" },
];

export const DESCRICAO_GRUPO_OUTROS = "Administração, seguros e despesas diversas";

export function grupoDaCategoria(categoria: Categoria) {
  return GRUPOS_CATEGORIA.find((g) => g.categorias.includes(categoria)) ?? GRUPOS_CATEGORIA[GRUPOS_CATEGORIA.length - 1];
}

/** Ordem fixa das categorias em listas e filtros */
export const ORDEM_CATEGORIAS: Categoria[] = [
  "energia",
  "agua",
  "gas",
  "pessoal",
  "limpeza",
  "seguranca",
  "manutencao",
  "elevadores",
  "administracao",
  "seguros",
  "outros",
];

/* ------------------------------------------------------------------ */
/* Agregações                                                          */
/* ------------------------------------------------------------------ */

const arred = (v: number) => Math.round(v * 100) / 100;

export function somaValores(contas: Conta[]) {
  return arred(contas.reduce((s, c) => s + c.valor, 0));
}

/**
 * kWh de um conjunto de contas. Ignora as faturas "energia_livre" (mercado
 * livre tem duas contas por mês com o mesmo consumo — somar as duas duplica).
 */
export function consumoKwh(contas: Conta[]) {
  return contas.reduce(
    (s, c) => (c.categoria === "energia" && c.energia && c.energia.tipoFatura !== "energia_livre" ? s + c.energia.consumoKwh : s),
    0,
  );
}

/** Variação percentual (atual vs anterior); undefined se não houver base */
export function variacaoPercentual(atual: number, anterior: number) {
  if (!anterior || !Number.isFinite(anterior)) return undefined;
  return (atual / anterior - 1) * 100;
}

/** Últimas `quantidade` competências terminando em `ate` (ordem crescente) */
export function ultimasCompetencias(quantidade: number, ate: Competencia = COMPETENCIA_ATUAL) {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(ate, i - (quantidade - 1)));
}

export type LinhaMensalPorGrupo = { competencia: Competencia; rotulo: string; total: number } & Record<string, number | string>;

/** Uma linha por competência com o total de cada grupo de categoria */
export function serieMensalPorGrupo(contas: Conta[], competencias: Competencia[]): LinhaMensalPorGrupo[] {
  const linhas = new Map<Competencia, LinhaMensalPorGrupo>();
  for (const c of competencias) {
    const linha: LinhaMensalPorGrupo = { competencia: c, rotulo: formatarCompetencia(c), total: 0 };
    for (const g of GRUPOS_CATEGORIA) linha[g.id] = 0;
    linhas.set(c, linha);
  }
  for (const conta of contas) {
    const linha = linhas.get(conta.competencia);
    if (!linha) continue;
    const g = grupoDaCategoria(conta.categoria);
    linha[g.id] = (linha[g.id] as number) + conta.valor;
    linha.total += conta.valor;
  }
  return [...linhas.values()].map((l) => {
    const r: LinhaMensalPorGrupo = { ...l, total: arred(l.total) };
    for (const g of GRUPOS_CATEGORIA) r[g.id] = arred(l[g.id] as number);
    return r;
  });
}

/** Total mensal de um condomínio nas últimas `meses` competências (meses sem conta = 0) */
export function totalPorCompetenciaDoCondominio(
  contas: Conta[],
  condominioId: string,
  meses = 12,
  ate: Competencia = COMPETENCIA_ATUAL,
) {
  const competencias = ultimasCompetencias(meses, ate);
  const mapa = new Map(competencias.map((c) => [c, 0]));
  for (const c of contas) {
    if (c.condominioId === condominioId && mapa.has(c.competencia)) mapa.set(c.competencia, mapa.get(c.competencia)! + c.valor);
  }
  return competencias.map((competencia) => ({ competencia, valor: arred(mapa.get(competencia)!) }));
}

/** Total por categoria, do maior para o menor, com participação (%) */
export function totaisPorCategoria(contas: Conta[]) {
  const mapa = new Map<Categoria, number>();
  for (const c of contas) mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.valor);
  const total = [...mapa.values()].reduce((a, b) => a + b, 0);
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor: arred(valor), participacao: total ? (valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export interface ResumoCondominio {
  condominio: Condominio;
  competencia: Competencia;
  gastoMes: number;
  gastoMesAnterior: number;
  gastoMesmoMesAnoAnterior: number;
  variacaoMes?: number;
  variacaoAno?: number;
  energiaMes: number;
  energiaMesAnterior: number;
  participacaoEnergia: number;
  /** Gasto do mês por unidade (total de unidades) */
  porUnidadeMes: number;
  /** Média mensal dos últimos 12 meses */
  media12: number;
  porUnidade12: number;
  emAberto: { quantidade: number; valor: number };
  vencidas: { quantidade: number; valor: number };
  vencendo: { quantidade: number; valor: number };
}

export function resumoDoCondominio(
  contas: Conta[],
  condominio: Condominio,
  competencia: Competencia = COMPETENCIA_ATUAL,
  hoje = DATA_REFERENCIA,
): ResumoCondominio {
  const doCondominio = contas.filter((c) => c.condominioId === condominio.id);
  return { condominio, ...resumoDeContas(doCondominio, competencia, hoje, condominio.unidades) };
}

/** Resumo de um conjunto qualquer de contas (um condomínio ou a carteira toda) */
export function resumoDeContas(contas: Conta[], competencia: Competencia = COMPETENCIA_ATUAL, hoje = DATA_REFERENCIA, unidades = 1) {
  const anterior = somarMeses(competencia, -1);
  const anoAnterior = somarMeses(competencia, -12);
  const janela = new Set(ultimasCompetencias(12, competencia));
  let gastoMes = 0;
  let gastoMesAnterior = 0;
  let gastoMesmoMesAnoAnterior = 0;
  let energiaMes = 0;
  let energiaMesAnterior = 0;
  let total12 = 0;
  const emAberto = { quantidade: 0, valor: 0 };
  const vencidas = { quantidade: 0, valor: 0 };
  const vencendo = { quantidade: 0, valor: 0 };

  for (const c of contas) {
    if (c.competencia === competencia) {
      gastoMes += c.valor;
      if (c.categoria === "energia") energiaMes += c.valor;
    } else if (c.competencia === anterior) {
      gastoMesAnterior += c.valor;
      if (c.categoria === "energia") energiaMesAnterior += c.valor;
    } else if (c.competencia === anoAnterior) {
      gastoMesmoMesAnoAnterior += c.valor;
    }
    if (janela.has(c.competencia)) total12 += c.valor;
    const status = statusDaConta(c, hoje);
    if (status !== "paga") {
      emAberto.quantidade++;
      emAberto.valor += c.valor;
    }
    if (status === "vencida") {
      vencidas.quantidade++;
      vencidas.valor += c.valor;
    } else if (status === "vence_em_breve") {
      vencendo.quantidade++;
      vencendo.valor += c.valor;
    }
  }

  const media12 = total12 / 12;
  return {
    competencia,
    gastoMes: arred(gastoMes),
    gastoMesAnterior: arred(gastoMesAnterior),
    gastoMesmoMesAnoAnterior: arred(gastoMesmoMesAnoAnterior),
    variacaoMes: variacaoPercentual(gastoMes, gastoMesAnterior),
    variacaoAno: variacaoPercentual(gastoMes, gastoMesmoMesAnoAnterior),
    energiaMes: arred(energiaMes),
    energiaMesAnterior: arred(energiaMesAnterior),
    participacaoEnergia: gastoMes ? (energiaMes / gastoMes) * 100 : 0,
    porUnidadeMes: gastoMes / unidades,
    media12: arred(media12),
    porUnidade12: media12 / unidades,
    emAberto: { ...emAberto, valor: arred(emAberto.valor) },
    vencidas: { ...vencidas, valor: arred(vencidas.valor) },
    vencendo: { ...vencendo, valor: arred(vencendo.valor) },
  };
}

/** Contas em aberto ordenadas por vencimento (vencidas primeiro) */
export function contasEmAberto(contas: Conta[], hoje = DATA_REFERENCIA) {
  return contas
    .filter((c) => statusDaConta(c, hoje) !== "paga")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor);
}

/* ------------------------------------------------------------------ */
/* Insights — utilidades                                               */
/* ------------------------------------------------------------------ */

export const PESO_SEVERIDADE: Record<Severidade, number> = { critico: 0, atencao: 1, oportunidade: 2, info: 3 };

/** Severidade (crítico → info) e, dentro dela, maior impacto primeiro */
export function ordenarInsights(insights: Insight[]) {
  return [...insights].sort(
    (a, b) =>
      PESO_SEVERIDADE[a.severidade] - PESO_SEVERIDADE[b.severidade] ||
      (b.impactoMensal?.max ?? 0) - (a.impactoMensal?.max ?? 0) ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

/** Soma das faixas de impacto mensal dos insights */
export function economiaPotencial(insights: Insight[]) {
  let min = 0;
  let max = 0;
  let quantidade = 0;
  for (const i of insights) {
    if (!i.impactoMensal) continue;
    min += i.impactoMensal.min;
    max += i.impactoMensal.max;
    quantidade++;
  }
  return { min: Math.round(min), max: Math.round(max), quantidade };
}

export function contarPorSeveridade(insights: Insight[]) {
  const contagem: Record<Severidade, number> = { critico: 0, atencao: 0, oportunidade: 0, info: 0 };
  for (const i of insights) contagem[i.severidade]++;
  return contagem;
}

/** Insights gerais + energia, sem duplicatas, já ordenados */
export function gerarTodosInsights(contas: Conta[], condominios: Condominio[] = CONDOMINIOS) {
  let energia: Insight[] = [];
  try {
    energia = gerarInsightsEnergia(contas, condominios);
  } catch (erro) {
    // A análise de energia é de outro módulo: uma falha lá não derruba o painel.
    console.error("Falha ao gerar insights de energia", erro);
  }
  const vistos = new Set<string>();
  const todos = [...gerarInsightsGerais(contas, condominios), ...energia].filter((i) => {
    if (vistos.has(i.id)) return false;
    vistos.add(i.id);
    return true;
  });
  return ordenarInsights(todos);
}

/* ------------------------------------------------------------------ */
/* Insights gerais                                                     */
/* ------------------------------------------------------------------ */

export function gerarInsightsGerais(
  contas: Conta[],
  condominios: Condominio[] = CONDOMINIOS,
  hoje = DATA_REFERENCIA,
  competenciaAtual: Competencia = COMPETENCIA_ATUAL,
): Insight[] {
  const mapa = new Map(condominios.map((c) => [c.id, c]));
  return [
    ...insightsVencimentos(contas, mapa, hoje),
    ...insightsConsumoMedido(contas, condominios),
    ...insightsReajustes(contas, mapa, competenciaAtual),
    ...insightsCustoPorUnidade(contas, condominios, competenciaAtual),
    ...insightsNegociacaoEmBloco(contas, mapa, competenciaAtual),
    ...insightsSeguros(contas, condominios, hoje),
  ];
}

const pct = (v: number) => formatarPercentual(v, { casas: 0 });
const reais = (v: number) => formatarMoeda(Math.round(v)).replace(",00", "");

const NOME_DA_CONTA: Partial<Record<Categoria, string>> = {
  energia: "Conta de energia",
  agua: "Conta de água",
  gas: "Conta de gás",
  seguros: "Parcela do seguro",
  pessoal: "Pagamento de pessoal",
  outros: "Conta",
};
const nomeDaConta = (c: Categoria) => NOME_DA_CONTA[c] ?? `Conta de ${ROTULOS_CATEGORIA[c].toLowerCase()}`;

/** 1. Contas vencidas (uma por conta) e contas vencendo em 7 dias (agregado) */
function insightsVencimentos(contas: Conta[], condominios: Map<string, Condominio>, hoje: string): Insight[] {
  const insights: Insight[] = [];
  const emAberto = contasEmAberto(contas, hoje);

  for (const c of emAberto.filter((x) => statusDaConta(x, hoje) === "vencida")) {
    const dias = diferencaEmDias(c.vencimento, hoje);
    const corte = c.categoria === "agua" || c.categoria === "energia" || c.categoria === "gas";
    const condominio = condominios.get(c.condominioId);
    insights.push({
      id: `geral-vencida-${c.id}`,
      condominioId: c.condominioId,
      categoria: c.categoria,
      severidade: "critico",
      titulo: `${nomeDaConta(c.categoria)} vencida há ${dias} ${dias === 1 ? "dia" : "dias"}`,
      descricao: `${condominio?.nome ?? "Condomínio"}: ${c.fornecedor}, ${formatarMoeda(c.valor)}, venceu em ${formatarData(
        c.vencimento,
      )} e não consta como paga. Pague o quanto antes para evitar multa e juros${
        corte ? " — e o risco de corte do fornecimento" : ""
      }.`,
      href: `/contas?conta=${encodeURIComponent(c.id)}`,
    });
  }

  const breve = emAberto.filter((x) => statusDaConta(x, hoje) === "vence_em_breve");
  if (breve.length > 0) {
    const total = somaValores(breve);
    const qtdCondominios = new Set(breve.map((c) => c.condominioId)).size;
    const primeira = breve[0];
    insights.push({
      id: "geral-vencendo-7-dias",
      categoria: "geral",
      severidade: "atencao",
      titulo: `${breve.length} ${breve.length === 1 ? "conta vence" : "contas vencem"} nos próximos 7 dias`,
      descricao: `Somam ${formatarMoeda(total)} em ${qtdCondominios} ${
        qtdCondominios === 1 ? "condomínio" : "condomínios"
      }. A próxima é "${primeira.descricao}" (${condominios.get(primeira.condominioId)?.nome ?? ""}), em ${formatarDataCurta(
        primeira.vencimento,
      )}.`,
      href: "/contas?status=vence_em_breve",
    });
  }
  return insights;
}

function diasDoMes(c: Competencia) {
  const [a, m] = c.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** 2. Água e gás acima do normal (m³/dia vs média dos 12 meses anteriores) */
function insightsConsumoMedido(contas: Conta[], condominios: Condominio[]): Insight[] {
  const insights: Insight[] = [];
  for (const condominio of condominios) {
    for (const categoria of ["agua", "gas"] as const) {
      const porCompetencia = new Map<Competencia, { m3: number; dias: number; valor: number }>();
      for (const c of contas) {
        if (c.condominioId !== condominio.id || c.categoria !== categoria) continue;
        const m3 = categoria === "agua" ? c.agua?.consumoM3 : c.gas?.consumoM3;
        if (!m3) continue;
        const dias = categoria === "agua" ? c.agua?.dias || 30 : diasDoMes(c.competencia);
        const atual = porCompetencia.get(c.competencia) ?? { m3: 0, dias: 0, valor: 0 };
        // Mais de uma conta na mesma competência (p.ex. enviada em duplicidade): usa a maior
        if (m3 > atual.m3) porCompetencia.set(c.competencia, { m3, dias, valor: c.valor });
      }
      const competencias = [...porCompetencia.keys()].sort();
      if (competencias.length < 8) continue;

      const ultima = competencias[competencias.length - 1];
      const penultima = somarMeses(ultima, -1);
      const base = competencias.filter((c) => c >= somarMeses(ultima, -13) && c <= somarMeses(ultima, -2));
      if (base.length < 6) continue;

      const m3Dia = (c: Competencia) => {
        const d = porCompetencia.get(c);
        return d ? d.m3 / d.dias : undefined;
      };
      const media = base.reduce((s, c) => s + m3Dia(c)!, 0) / base.length;
      const atual = m3Dia(ultima)!;
      const anterior = m3Dia(penultima);
      const desvio = atual / media - 1;
      if (desvio < 0.2) continue;

      const doisMeses = anterior !== undefined && anterior / media - 1 >= 0.2;
      const dadosUltima = porCompetencia.get(ultima)!;
      const tarifa = dadosUltima.valor / dadosUltima.m3;
      const excedenteMes = (atual - media) * 30 * tarifa;
      const nome = categoria === "agua" ? "Água" : "Gás";
      const dica =
        categoria === "agua"
          ? "Pode ser vazamento: confira caixas d'água, boias, descargas e registros."
          : "Pode ser vazamento ou defeito no medidor: peça uma vistoria da central de gás.";

      insights.push({
        id: `geral-consumo-${categoria}-${condominio.id}`,
        condominioId: condominio.id,
        categoria,
        severidade: desvio >= 0.3 && doisMeses ? "critico" : "atencao",
        titulo: `${nome} ${pct(desvio * 100)} acima do normal${doisMeses ? " há 2 meses" : ""}`,
        descricao: `${condominio.nome}: em ${formatarCompetencia(ultima)} o consumo foi de ${formatarNumero1(
          atual,
        )} m³/dia, contra ${formatarNumero1(media)} m³/dia na média dos 12 meses anteriores. ${dica}`,
        impactoMensal: { min: Math.round(excedenteMes * 0.8), max: Math.round(excedenteMes) },
        href: `/contas?condominio=${condominio.slug}&categoria=${categoria}`,
      });
    }
  }
  return insights;
}

/** Categorias com contratos de valor fixo (onde "aumento" = reajuste) */
const CATEGORIAS_CONTRATUAIS: Categoria[] = ["limpeza", "seguranca", "elevadores", "manutencao", "administracao", "pessoal"];

function mediana(valores: number[]) {
  const o = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
}

/** 3. Contratos com reajuste acima da inflação (mediana de 3 meses vs 1 ano antes) */
function insightsReajustes(contas: Conta[], condominios: Map<string, Condominio>, competenciaAtual: Competencia): Insight[] {
  const series = new Map<string, { conta: Conta; valores: Map<Competencia, number> }>();
  for (const c of contas) {
    if (!CATEGORIAS_CONTRATUAIS.includes(c.categoria)) continue;
    const chave = `${c.condominioId}|${c.fornecedor.trim().toLowerCase()}|${c.descricao.trim().toLowerCase()}`;
    const serie = series.get(chave) ?? { conta: c, valores: new Map() };
    serie.valores.set(c.competencia, (serie.valores.get(c.competencia) ?? 0) + c.valor);
    if (c.competencia > serie.conta.competencia) serie.conta = c;
    series.set(chave, serie);
  }

  const insights: Insight[] = [];
  for (const [chave, { conta, valores }] of series) {
    const ultima = [...valores.keys()].sort().at(-1)!;
    if (ultima < somarMeses(competenciaAtual, -1)) continue; // contrato encerrado
    const recentes = [0, -1, -2].map((d) => valores.get(somarMeses(ultima, d)));
    const anoAntes = [-12, -13, -14].map((d) => valores.get(somarMeses(ultima, d)));
    if ([...recentes, ...anoAntes].some((v) => v === undefined)) continue;
    const atual = mediana(recentes as number[]);
    const anterior = mediana(anoAntes as number[]);
    const aumento = (atual / anterior - 1) * 100;
    if (aumento <= IPCA_REFERENCIA + 3) continue;

    const condominio = condominios.get(conta.condominioId);
    const excesso = atual - anterior * (1 + IPCA_REFERENCIA / 100);
    insights.push({
      id: `geral-reajuste-${chave.replace(/[^a-z0-9|-]+/g, "-")}`,
      condominioId: conta.condominioId,
      categoria: conta.categoria,
      severidade: "atencao",
      titulo: `${ROTULOS_CATEGORIA[conta.categoria]}: reajuste de ${formatarPercentual(aumento)} em 12 meses`,
      descricao: `${conta.fornecedor} passou de ${formatarMoeda(anterior)} para ${formatarMoeda(atual)} por mês no ${
        condominio?.nome ?? "condomínio"
      } — bem acima da inflação do período (~${formatarPercentual(IPCA_REFERENCIA)}). Peça a justificativa e faça uma cotação com outras empresas.`,
      impactoMensal: { min: Math.round(excesso * 0.5), max: Math.round(excesso) },
      href: `/contas?condominio=${condominio?.slug ?? ""}&busca=${encodeURIComponent(conta.fornecedor)}`,
    });
  }
  return insights;
}

/** 4. Custo por unidade acima da média dos pares (horizontal × horizontal, vertical × vertical) */
function insightsCustoPorUnidade(contas: Conta[], condominios: Condominio[], competenciaAtual: Competencia): Insight[] {
  const janela = new Set(ultimasCompetencias(12, competenciaAtual));
  const porCondominio = new Map<string, { total: number; categorias: Map<Categoria, number> }>();
  for (const c of contas) {
    if (!janela.has(c.competencia)) continue;
    const d = porCondominio.get(c.condominioId) ?? { total: 0, categorias: new Map() };
    d.total += c.valor;
    d.categorias.set(c.categoria, (d.categorias.get(c.categoria) ?? 0) + c.valor);
    porCondominio.set(c.condominioId, d);
  }
  const porUnidade = (c: Condominio, categoria?: Categoria) => {
    const d = porCondominio.get(c.id);
    if (!d) return 0;
    const valor = categoria ? (d.categorias.get(categoria) ?? 0) : d.total;
    return valor / 12 / c.unidades;
  };

  const insights: Insight[] = [];
  for (const condominio of condominios) {
    const pares = condominios.filter((c) => c.tipo === condominio.tipo && c.id !== condominio.id && porCondominio.has(c.id));
    if (pares.length === 0 || !porCondominio.has(condominio.id)) continue;
    const proprio = porUnidade(condominio);
    const mediaPares = pares.reduce((s, c) => s + porUnidade(c), 0) / pares.length;
    const diferenca = proprio / mediaPares - 1;
    if (diferenca < 0.06) continue;

    const motivos = ORDEM_CATEGORIAS.map((cat) => ({
      cat,
      dif: porUnidade(condominio, cat) - pares.reduce((s, c) => s + porUnidade(c, cat), 0) / pares.length,
    }))
      .filter((m) => m.dif > 0)
      .sort((a, b) => b.dif - a.dif)
      .slice(0, 2)
      .map((m) => ROTULOS_CATEGORIA[m.cat]);
    const textoPares = condominio.tipo === "vertical" ? "outros prédios" : "outros condomínios de casas";

    insights.push({
      id: `geral-custo-unidade-${condominio.id}`,
      condominioId: condominio.id,
      categoria: "geral",
      severidade: diferenca >= 0.12 ? "atencao" : "info",
      titulo: `Custo por unidade ${pct(diferenca * 100)} acima dos pares`,
      descricao: `${condominio.nome}: ${reais(proprio)} por unidade/mês nos últimos 12 meses, contra ${reais(
        mediaPares,
      )} na média dos ${textoPares} da carteira.${
        motivos.length ? ` A maior diferença está em ${motivos.join(" e ")}.` : ""
      }`,
      href: `/condominios/${condominio.slug}`,
    });
  }
  return insights;
}

const CATEGORIAS_BLOCO: Categoria[] = ["limpeza", "seguranca", "elevadores", "manutencao"];
const SERVICO_DA_CATEGORIA: Partial<Record<Categoria, string>> = {
  limpeza: "limpeza",
  seguranca: "monitoramento e segurança",
  elevadores: "elevadores",
  manutencao: "manutenção",
};

/** 5. Concentração: o mesmo fornecedor em vários condomínios → negociar em bloco */
function insightsNegociacaoEmBloco(contas: Conta[], condominios: Map<string, Condominio>, competenciaAtual: Competencia): Insight[] {
  const meses = new Set(ultimasCompetencias(3, competenciaAtual));
  // só contratos recorrentes: presentes nos 3 últimos meses
  const presenca = new Map<string, Set<Competencia>>();
  for (const c of contas) {
    if (!CATEGORIAS_BLOCO.includes(c.categoria) || !meses.has(c.competencia)) continue;
    const chave = `${c.condominioId}|${c.fornecedor}|${c.descricao}`;
    presenca.set(chave, (presenca.get(chave) ?? new Set()).add(c.competencia));
  }
  const porFornecedor = new Map<string, { condominios: Set<string>; total: number; categoria: Categoria }>();
  for (const c of contas) {
    if (c.competencia !== competenciaAtual || !CATEGORIAS_BLOCO.includes(c.categoria)) continue;
    if ((presenca.get(`${c.condominioId}|${c.fornecedor}|${c.descricao}`)?.size ?? 0) < 3) continue;
    const d = porFornecedor.get(c.fornecedor) ?? { condominios: new Set(), total: 0, categoria: c.categoria };
    d.condominios.add(c.condominioId);
    d.total += c.valor;
    porFornecedor.set(c.fornecedor, d);
  }

  return [...porFornecedor.entries()]
    .filter(([, d]) => d.condominios.size >= 2 && d.total >= 8000)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 2)
    .map(([fornecedor, d]) => {
      const nomes = [...d.condominios].map((id) => condominios.get(id)?.nome ?? id);
      return {
        id: `geral-bloco-${fornecedor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        categoria: d.categoria,
        severidade: "oportunidade" as const,
        titulo: `${d.condominios.size} condomínios com a mesma empresa de ${SERVICO_DA_CATEGORIA[d.categoria]}`,
        descricao: `${fornecedor} recebe ${reais(d.total)} por mês somando ${nomes.join(", ")}. Negociar os contratos em conjunto costuma render de 3% a 6% de desconto.`,
        impactoMensal: { min: Math.round(d.total * 0.03), max: Math.round(d.total * 0.06) },
        href: `/contas?busca=${encodeURIComponent(fornecedor)}&competencia=${competenciaAtual}`,
      };
    });
}

/** 6. Seguro que renova nos próximos 60 dias → hora de cotar */
function insightsSeguros(contas: Conta[], condominios: Condominio[], hoje: string): Insight[] {
  const insights: Insight[] = [];
  for (const condominio of condominios) {
    const seguros = contas.filter((c) => c.condominioId === condominio.id && c.categoria === "seguros");
    const primeiras = seguros.filter((c) => /parcela 1\//i.test(c.descricao)).sort((a, b) => a.competencia.localeCompare(b.competencia));
    const inicio = primeiras.at(-1);
    if (!inicio) continue;
    const renovacao = somarMeses(inicio.competencia, 12);
    const dias = diferencaEmDias(hoje, `${renovacao}-01`);
    if (dias < 0 || dias > 60) continue;
    const premio = somaValores(
      seguros.filter(
        (c) => c.fornecedor === inicio.fornecedor && c.competencia >= inicio.competencia && c.competencia < renovacao,
      ),
    );
    insights.push({
      id: `geral-seguro-renovacao-${condominio.id}`,
      condominioId: condominio.id,
      categoria: "seguros",
      severidade: "oportunidade",
      titulo: `Seguro renova em ${formatarCompetenciaLonga(renovacao).replace(/ de \d{4}$/, "")}: hora de cotar`,
      descricao: `A apólice do ${condominio.nome} (${inicio.fornecedor}, ${reais(premio)} por ano) vence em ${formatarCompetenciaLonga(
        renovacao,
      )}. Cotar com 2 ou 3 seguradoras agora costuma reduzir o prêmio de 5% a 12%.`,
      impactoMensal: { min: Math.round((premio * 0.05) / 12), max: Math.round((premio * 0.12) / 12) },
      href: `/contas?condominio=${condominio.slug}&categoria=seguros`,
    });
  }
  return insights;
}
