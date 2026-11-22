/**
 * Energia — fala de assembleia (roteiro de 3 minutos + 1 slide).
 *
 * Gerado a partir dos dados do condomínio e da recomendação escolhida
 * (padrão: a prioritária). Linguagem de síndico, sem jargão; 3 blocos:
 * O problema · O número · A decisão que pedimos.
 */
import { formatarCompetencia, formatarCompetenciaLonga, formatarMoeda, formatarNumero, formatarPercentual } from "../formatacao";
import type { Competencia, Conta } from "../tipos";
import type { AnaliseEnergiaCondominio } from "./energia";
import { METRICAS } from "./energia-comprovacao";
import { soma, type Faixa } from "./energia-dados";
import type { RecomendacaoEnergia } from "./energia-recomendacoes";

export interface BlocoFala {
  titulo: "O problema" | "O número" | "A decisão que pedimos";
  /** Tempo sugerido (segundos) */
  segundos: number;
  paragrafos: string[];
}

export interface BarraSlide {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}

export interface GraficoSlide {
  titulo: string;
  unidade: "kW" | "kWh/dia" | "R$" | "R$/kWh";
  barras: BarraSlide[];
  referencias: { valor: number; rotulo: string }[];
  /** Legenda curta do que está destacado */
  legendaDestaque?: string;
}

export interface SlideAssembleia {
  titulo: string;
  numero: string;
  legendaNumero: string;
  bullets: string[];
  grafico: GraficoSlide | null;
}

export interface FalaAssembleia {
  recomendacao: RecomendacaoEnergia | null;
  blocos: BlocoFala[];
  slide: SlideAssembleia;
  palavras: number;
  /** Duração estimada lendo em ritmo calmo (~140 palavras/min) */
  segundosEstimados: number;
}

const reais = (v: number) => formatarMoeda(Math.round(v)).replace(",00", "");
const pct = (v: number, casas = 0) => formatarPercentual(v * 100, { casas });

/** "R$ 240 mil" / "R$ 7.800" — números falados (arredondados) */
function reaisFalado(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(Math.round(v / 100_000) / 10).toString().replace(".", ",")} milhão${v >= 2_000_000 ? "ões" : ""}`;
  if (Math.abs(v) >= 10_000) return `R$ ${formatarNumero(Math.round(v / 1_000))} mil`;
  if (Math.abs(v) >= 1_000) return reais(Math.round(v / 50) * 50);
  return reais(v);
}

function faixaFalada(f: Faixa) {
  return f.min === f.max ? reaisFalado(f.min) : `${reaisFalado(f.min)} a ${reaisFalado(f.max)}`;
}

function minusculaInicial(t: string) {
  return t ? t[0].toLowerCase() + t.slice(1) : t;
}

function listarComE(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function descreverContas(a: AnaliseEnergiaCondominio) {
  const ucs = a.ucs.filter((u) => u.meses.length);
  const nome = (u: (typeof ucs)[number]) =>
    `${u.uc.subgrupo === "A4" ? "média tensão" : "baixa tensão"}${u.uc.ambiente === "livre" ? " (no mercado livre)" : ""}`;
  if (ucs.length === 1) return `uma conta de ${nome(ucs[0])}`;
  if (ucs.length === 2) return `duas contas: uma de ${nome(ucs[0])} e outra de ${nome(ucs[1])}`;
  return `${ucs.length} contas: ${listarComE(ucs.map(nome))}`;
}

/** Parcela da energia em tudo o que o condomínio pagou na mesma janela (se houver outras contas) */
function parcelaDaEnergia(a: AnaliseEnergiaCondominio, contas: Conta[]) {
  const janela = new Set<Competencia>(a.competenciasJanela);
  const doCondominio = contas.filter((c) => c.condominioId === a.condominio.id && janela.has(c.competencia));
  const outras = soma(doCondominio.filter((c) => c.categoria !== "energia").map((c) => c.valor));
  const energia = soma(doCondominio.filter((c) => c.categoria === "energia").map((c) => c.valor));
  if (outras <= 0 || energia <= 0) return undefined;
  return energia / (energia + outras);
}

function graficoDoSlide(a: AnaliseEnergiaCondominio, rec: RecomendacaoEnergia | null): GraficoSlide | null {
  const uc = rec?.ucId ? a.ucs.find((u) => u.uc.id === rec.ucId) : undefined;
  const janela = new Set(a.competenciasJanela);
  const serie = (uc?.serie ?? a.serie).filter((p) => janela.has(p.competencia));
  if (!serie.length) return null;

  if (rec && (rec.tipo === "ajustar_demanda" || rec.tipo === "aumentar_demanda")) {
    const meses = serie.filter((p) => p.demandaMedidaKw !== undefined);
    const contratada = meses[meses.length - 1]?.demandaContratadaKw;
    const sugerida = Number(/para (\d+)/.exec(rec.titulo)?.[1] ?? NaN);
    return {
      titulo: "Demanda medida por mês × demanda paga",
      unidade: "kW",
      barras: meses.map((p) => ({ rotulo: formatarCompetencia(p.competencia), valor: p.demandaMedidaKw! })),
      referencias: [
        ...(contratada ? [{ valor: contratada, rotulo: `Paga hoje: ${formatarNumero(contratada)} kW` }] : []),
        ...(Number.isFinite(sugerida) ? [{ valor: sugerida, rotulo: `Proposta: ${formatarNumero(sugerida)} kW` }] : []),
      ],
    };
  }
  if (rec && (rec.tipo === "corrigir_anomalia" || rec.tipo === "checagem_mensal") && uc) {
    const anomalos = new Set(uc.avaliacao.filter((p) => p.status === "alta").map((p) => p.competencia));
    const normais = uc.avaliacao.filter((p) => janela.has(p.competencia) && p.status === "normal" && p.esperado);
    const referencia = normais.length ? soma(normais.map((p) => p.valor)) / normais.length : undefined;
    return {
      titulo: `Consumo por dia — ${uc.uc.apelido}`,
      unidade: "kWh/dia",
      barras: serie.map((p) => ({ rotulo: formatarCompetencia(p.competencia), valor: p.kwhDia, destaque: anomalos.has(p.competencia) })),
      referencias: referencia ? [{ valor: referencia, rotulo: "Normal" }] : [],
      legendaDestaque: "Acima do normal",
    };
  }
  if (rec?.tipo === "tirar_da_ponta" && uc?.tarifas.ponta && uc.tarifas.foraPonta) {
    return {
      titulo: "Quanto custa cada kWh",
      unidade: "R$/kWh",
      barras: [
        { rotulo: "Fora da ponta", valor: uc.tarifas.foraPonta },
        { rotulo: "Na ponta (3h/dia)", valor: uc.tarifas.ponta, destaque: true },
      ],
      referencias: [],
      legendaDestaque: "Horário de ponta",
    };
  }
  if (rec?.tipo === "fator_potencia") {
    return {
      titulo: "Multa de reativo por mês",
      unidade: "R$",
      barras: serie.map((p) => ({ rotulo: formatarCompetencia(p.competencia), valor: p.custoReativo, destaque: p.custoReativo > 0 })),
      referencias: [],
      legendaDestaque: "Mês com multa",
    };
  }
  const mediaCusto = soma(serie.map((p) => p.custo)) / serie.length;
  return {
    titulo: uc ? `Custo mensal — ${uc.uc.apelido}` : "Custo mensal de energia",
    unidade: "R$",
    barras: serie.map((p) => ({ rotulo: formatarCompetencia(p.competencia), valor: p.custo })),
    referencias: [{ valor: mediaCusto, rotulo: `Média: ${reaisFalado(mediaCusto)}` }],
  };
}

function fraseDoAchado(a: AnaliseEnergiaCondominio, rec: RecomendacaoEnergia): string {
  const uc = rec.ucId ? a.ucs.find((u) => u.uc.id === rec.ucId) : undefined;
  switch (rec.tipo) {
    case "corrigir_anomalia": {
      const ep = uc?.episodios.find((e) => e.ativo);
      if (ep)
        return `E encontramos um problema: desde ${formatarCompetenciaLonga(ep.inicio).replace(/ de \d{4}$/, "")}, a conta de ${uc!.descricao.toLowerCase().split(" · ")[0]} está ${pct(ep.desvioMedio)} acima do normal para a época — mesmo considerando as unidades novas. São cerca de ${formatarNumero(ep.excessoKwhDiaRecente)} kWh a mais por dia, e ninguém tinha percebido.`;
      break;
    }
    case "checagem_mensal":
      return `E encontramos um desperdício que passou despercebido: ${minusculaInicial(rec.descricao)}`;
    case "ajustar_demanda":
      return `E encontramos um desperdício: ${minusculaInicial(rec.descricao)} É dinheiro pago todo mês por uma folga que não usamos.`;
    case "tirar_da_ponta":
      return `E encontramos um ponto de atenção: ${minusculaInicial(rec.descricao)}`;
    case "fator_potencia":
      return `E encontramos uma multa que se repete: ${minusculaInicial(rec.descricao)}`;
    default:
      return `E encontramos uma oportunidade: ${minusculaInicial(rec.descricao)}`;
  }
  return `E encontramos uma oportunidade: ${minusculaInicial(rec.descricao)}`;
}

function fraseInvestimento(rec: RecomendacaoEnergia) {
  const inv = rec.investimentoReais;
  if (!inv || inv.max <= 0) return `Não precisa de investimento, e o efeito aparece em: ${minusculaInicial(rec.prazo)}.`;
  const pb = rec.paybackMeses;
  const retorno = pb
    ? pb.max < 1
      ? "e se paga em menos de um mês"
      : `e se paga em ${formatarNumero(Math.max(1, Math.floor(pb.min)))} a ${formatarNumero(Math.ceil(pb.max))} meses`
    : "";
  return `O investimento é de ${inv.min > 0 ? faixaFalada(inv) : `até ${reaisFalado(inv.max)}`} ${retorno}. Prazo: ${minusculaInicial(rec.prazo)}.`;
}

function fraseComprovacao(rec: RecomendacaoEnergia) {
  const m = METRICAS[rec.metrica];
  if (m.ajusta)
    return `Como vamos prestar contas: vamos comparar o consumo por dia dos meses seguintes com a média dos 12 meses anteriores, já corrigida pelo número de unidades ocupadas e pela época do ano. Assim ninguém confunde economia com mês mais curto ou mais frio.`;
  return `Como vamos prestar contas: vamos comparar ${minusculaInicial(m.rotulo)} das próximas contas com a média dos 12 meses anteriores. O número volta para esta assembleia.`;
}

export function gerarFalaAssembleia(
  a: AnaliseEnergiaCondominio,
  contas: Conta[],
  recomendacaoId?: string,
): FalaAssembleia {
  const rec = a.recomendacoes.find((r) => r.id === recomendacaoId) ?? a.recomendacoes[0] ?? null;
  const janela = a.serie.filter((p) => p.completo && a.competenciasJanela.includes(p.competencia));
  const gastoAno = soma(janela.map((p) => p.custo));
  const gastoMes = janela.length ? gastoAno / janela.length : 0;
  const contasTexto = descreverContas(a);
  const parcela = parcelaDaEnergia(a, contas);
  const outras = rec ? a.recomendacoes.filter((r) => r.id !== rec.id) : [];
  const potencialOutras = { min: soma(outras.map((r) => r.economiaMensalReais.min)), max: soma(outras.map((r) => r.economiaMensalReais.max)) };

  /* ---------------- bloco 1: o problema ---------------- */
  const problema: string[] = [];
  problema.push(
    `Hoje o condomínio gasta, em média, ${reaisFalado(gastoMes)} por mês com a energia das áreas comuns — ${reaisFalado(gastoAno)} em ${janela.length === 12 ? "um ano" : `${janela.length} meses`}${parcela && parcela >= 0.1 ? `, o equivalente a ${pct(parcela)} de tudo o que o condomínio paga` : ""}. ${a.ucs.filter((u) => u.meses.length).length === 1 ? "É" : "São"} ${contasTexto}.`,
  );
  problema.push(
    `Nós organizamos ${a.mesesDeHistorico >= 12 ? `os últimos ${a.mesesDeHistorico} meses` : `os ${a.mesesDeHistorico} meses disponíveis`} dessas contas num só lugar e passamos a olhar o consumo por dia, porque cada conta vem com um número diferente de dias. Assim dá para comparar um mês com o outro de forma justa.`,
  );
  if (rec) problema.push(fraseDoAchado(a, rec));
  if (a.bandeiras.temCativo && a.bandeiras.total > 0 && a.bandeiras.percentualDoGasto >= 0.03)
    problema.push(`Só as bandeiras amarela e vermelha custaram ${reaisFalado(a.bandeiras.total)} nos últimos 12 meses.`);

  /* ---------------- bloco 2: o número ---------------- */
  const numero: string[] = [];
  if (rec) {
    const anual = { min: rec.economiaMensalReais.min * 12, max: rec.economiaMensalReais.max * 12 };
    numero.push(
      `A primeira ação que recomendamos é ${minusculaInicial(rec.titulo)}. A economia estimada é de ${faixaFalada(rec.economiaMensalReais)} por mês — ${faixaFalada(anual)} por ano.`,
    );
    numero.push(`A conta é simples: ${rec.calculo}.`);
    numero.push(fraseInvestimento(rec));
    if (outras.length)
      numero.push(
        `E há mais ${outras.length === 1 ? "uma ação" : `${outras.length} ações`} na fila, que juntas podem somar ${faixaFalada(potencialOutras)} por mês. Damos o número em faixa de propósito: preferimos prometer o mínimo e comprovar com as próximas contas.`,
      );
    else numero.push("Damos o número em faixa de propósito: preferimos prometer o mínimo e comprovar com as próximas contas.");
  } else {
    numero.push("Com os dados de hoje não encontramos uma ação com economia relevante. A proposta é continuar acompanhando o consumo por dia, mês a mês.");
  }

  /* ---------------- bloco 3: a decisão ---------------- */
  const decisao: string[] = [];
  if (rec) {
    decisao.push(`Pedimos que a assembleia aprove: ${minusculaInicial(rec.decisao)}`);
    decisao.push(fraseComprovacao(rec));
    const proximas = outras.slice(0, 2).map((r) => minusculaInicial(r.titulo));
    decisao.push(
      `Se a economia não aparecer em até 3 contas, revemos a ação.${proximas.length ? ` Também pedimos autorização para trazer, na próxima reunião, orçamento das próximas ações: ${listarComE(proximas)}.` : ""}`,
    );
  } else {
    decisao.push("Pedimos autorização para manter o acompanhamento mensal das contas de energia e trazer o resultado na próxima assembleia.");
  }

  const blocos: BlocoFala[] = [
    { titulo: "O problema", segundos: 60, paragrafos: problema },
    { titulo: "O número", segundos: 70, paragrafos: numero },
    { titulo: "A decisão que pedimos", segundos: 50, paragrafos: decisao },
  ];
  const palavras = blocos.flatMap((b) => b.paragrafos).join(" ").split(/\s+/).filter(Boolean).length;

  /* ---------------- slide ---------------- */
  const economia = rec?.economiaMensalReais;
  const bullets: string[] = [];
  if (rec) {
    bullets.push(`Proposta: ${minusculaInicial(rec.titulo)}`);
    const inv = rec.investimentoReais;
    bullets.push(
      !inv || inv.max <= 0
        ? `Sem investimento · efeito: ${minusculaInicial(rec.prazo)}`
        : `Investimento ${inv.min > 0 ? faixaFalada(inv) : `até ${reaisFalado(inv.max)}`}${rec.paybackMeses ? ` · se paga em ${rec.paybackMeses.max < 1 ? "menos de 1 mês" : `${formatarNumero(Math.max(1, Math.floor(rec.paybackMeses.min)))}–${formatarNumero(Math.ceil(rec.paybackMeses.max))} meses`}` : ""}`,
    );
    bullets.push(
      METRICAS[rec.metrica].ajusta
        ? "Comprovação: consumo por dia × média de 12 meses, corrigida pela ocupação"
        : `Comprovação: ${minusculaInicial(METRICAS[rec.metrica].rotulo)} × média de 12 meses`,
    );
  }

  const slide: SlideAssembleia = {
    titulo: rec ? rec.resumo : "Energia das áreas comuns sob acompanhamento",
    numero: economia ? (economia.min === economia.max ? reais(economia.min) : `${reais(economia.min)} – ${reais(economia.max)}`) : reaisFalado(gastoMes),
    legendaNumero: economia
      ? `de economia por mês · ${faixaFalada({ min: economia.min * 12, max: economia.max * 12 })} por ano`
      : "gasto médio por mês com energia",
    bullets,
    grafico: graficoDoSlide(a, rec),
  };

  return { recomendacao: rec, blocos, slide, palavras, segundosEstimados: Math.round((palavras / 140) * 60) };
}
