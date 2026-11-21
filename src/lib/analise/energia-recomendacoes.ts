/**
 * Energia — recomendações com número.
 *
 * Cada candidata só entra quando os DADOS mostram que ela se aplica. A economia
 * vem sempre em faixa (mín–máx), com as premissas escritas por extenso, e é
 * calculada com as tarifas efetivas da própria conta (R$/kW, R$/kWh na ponta e
 * fora dela…). Nada aqui depende do nome do condomínio.
 */
import { somarMeses } from "../dados/referencia";
import { formatarCompetencia, formatarMoeda, formatarNumero, formatarPercentual, formatarTarifa } from "../formatacao";
import type { Condominio, Conta, Recomendacao } from "../tipos";
import { montarBaseAnalise, type AnaliseUc, type BaseAnalise } from "./energia-base";
import {
  arredondarFaixa,
  DIAS_MES_PADRAO,
  media,
  soma,
  TARIFAS_PADRAO,
  type Faixa,
} from "./energia-dados";

export type TipoRecomendacao =
  | "corrigir_anomalia"
  | "checagem_mensal"
  | "ajustar_demanda"
  | "aumentar_demanda"
  | "tirar_da_ponta"
  | "led_iluminacao"
  | "migrar_mercado_livre"
  | "revisar_contrato_livre"
  | "assinatura_energia"
  | "fator_potencia";

/** Como medir o efeito da ação no antes/depois */
export type MetricaComprovacao = "kwh_dia" | "kwh_ponta_dia" | "custo_demanda" | "custo_reativo" | "reais_por_kwh";

export interface RecomendacaoEnergia extends Recomendacao {
  tipo: TipoRecomendacao;
  ucApelido?: string;
  /** "Explicação em 1 minuto" — linguagem de síndico */
  explicacao: string;
  /** A conta da economia em uma linha ("55 kW × R$ 12,87…") */
  calculo: string;
  /** A decisão concreta que se pede (assembleia/conselho) */
  decisao: string;
  /** Quanto tempo até a economia aparecer na conta */
  prazo: string;
  /** Ações de horário: kWh/mês que MUDAM de horário (não é redução de consumo) */
  kwhDeslocadosMes?: Faixa;
  /** Métrica usada na comprovação antes/depois */
  metrica: MetricaComprovacao;
  /** Efeito esperado na métrica (kWh/dia, R$/mês ou R$/kWh), em faixa */
  efeitoNaMetrica: Faixa;
  /** Frase curta para o slide */
  resumo: string;
  /** Usado para ordenar (maior = mais prioritária) */
  pontuacao: number;
}

/* ------------------------------------------------------------------ */
/* Helpers de texto                                                    */
/* ------------------------------------------------------------------ */

const reais = (v: number) => formatarMoeda(Math.round(v)).replace(",00", "");
const faixaReais = (f: Faixa) => (f.min === f.max ? reais(f.min) : `${reais(f.min)} a ${reais(f.max)}`);
const tarifa = (v: number) => formatarTarifa(v);
const faixaKwhTexto = (f: Faixa) => (f.min === f.max ? `${formatarNumero(f.min)} kWh` : `${formatarNumero(f.min)} a ${formatarNumero(f.max)} kWh`);
/** 4,4× */
const vezes = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")}×`;
const pct = (v: number, casas = 0) => formatarPercentual(v * 100, { casas });

function contem(lista: string[], re: RegExp) {
  return lista.filter((t) => re.test(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
}

function payback(investimento: Faixa | undefined, economia: Faixa): Faixa | undefined {
  if (!investimento || investimento.max <= 0 || economia.max <= 0) return undefined;
  const minEconomia = economia.min > 0 ? economia.min : economia.max / 2;
  const arred = (v: number) => Math.round(v * 10) / 10;
  return { min: arred(investimento.min / economia.max), max: arred(investimento.max / minEconomia) };
}

const FATOR_ESFORCO = { baixo: 1, medio: 0.8, alto: 0.6 } as const;

function fatorPayback(p: Faixa | undefined) {
  if (!p) return 1;
  const meio = (p.min + p.max) / 2;
  if (meio <= 6) return 0.95;
  if (meio <= 12) return 0.85;
  if (meio <= 24) return 0.7;
  if (meio <= 48) return 0.5;
  return 0.35;
}

type Rascunho = Omit<RecomendacaoEnergia, "prioridade" | "pontuacao" | "paybackMeses" | "condominioId"> & {
  urgencia?: number;
};

/* ------------------------------------------------------------------ */
/* Contexto por UC                                                     */
/* ------------------------------------------------------------------ */

interface ContextoUc {
  a: AnaliseUc;
  kwhMes: number;
  custoMes: number;
  cargas: string[];
}

function contextoUc(a: AnaliseUc, condominio: Condominio): ContextoUc | null {
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);
  if (!janela.length) return null;
  const kwhMes = media(janela.map((m) => m.kwhDia)) * DIAS_MES_PADRAO;
  const custoMes = media(janela.map((m) => m.custo));
  const cargas = a.uc.cargas.length ? a.uc.cargas : condominio.areasComuns;
  return { a, kwhMes, custoMes, cargas };
}

/* ------------------------------------------------------------------ */
/* Candidatas                                                          */
/* ------------------------------------------------------------------ */

const CAUSAS: [RegExp, string][] = [
  [/ilumina|poste|refletor/, "postes ou refletores acesos de dia (fotocélula ou temporizador com defeito)"],
  [/bomba|recalque|poco|pressuriz/, "bomba ligando sem parar (boia, pressostato ou vazamento na rede de água)"],
  [/piscina|filtr/, "filtragem da piscina sem temporizador"],
  [/ete|esgoto/, "equipamento da estação de esgoto travado em funcionamento contínuo"],
  [/elevador/, "elevador ou motor com defeito"],
];

function causasProvaveis(cargas: string[]) {
  const causas = CAUSAS.filter(([re]) => contem(cargas, re).length).map(([, texto]) => texto);
  causas.push("algum equipamento novo ou esquecido ligado");
  return causas.slice(0, 3);
}

function anomalias(ctx: ContextoUc, base: BaseAnalise): Rascunho[] {
  const { a, cargas } = ctx;
  const lista: Rascunho[] = [];
  const ultimo = base.ultimoMesCompleto ?? a.ultimoMes?.competencia;
  const r = a.tarifas.reaisPorKwhVariavel;

  for (const ep of a.episodios) {
    const periodo =
      ep.inicio === ep.fim
        ? formatarCompetencia(ep.inicio)
        : `${formatarCompetencia(ep.inicio)} a ${formatarCompetencia(ep.fim)}`;
    const causas = causasProvaveis(cargas);

    if (ep.ativo) {
      const kwhMes = ep.excessoKwhDiaRecente * DIAS_MES_PADRAO;
      const kwh = arredondarFaixa({ min: kwhMes * 0.6, max: kwhMes });
      const economia = arredondarFaixa({ min: kwh.min * r, max: kwh.max * r });
      lista.push({
        id: `corrigir_anomalia-${a.uc.id}`,
        tipo: "corrigir_anomalia",
        ucId: a.uc.id,
        ucApelido: a.uc.apelido,
        titulo: "Achar e corrigir o consumo fora do normal",
        descricao: `Desde ${formatarCompetencia(ep.inicio)} a conta "${a.uc.apelido}" está ${pct(ep.desvioMedio)} acima do esperado para a época e a ocupação — cerca de ${formatarNumero(ep.excessoKwhDiaRecente)} kWh a mais por dia.`,
        economiaMensalReais: economia,
        economiaMensalKwh: kwh,
        investimentoReais: { min: 300, max: 1_500 },
        premissas: [
          `Consumo esperado calculado pela linha de base (média dos 12 meses anteriores, corrigida pela ocupação e pela estação); em ${periodo} o consumo ficou ${pct(ep.desvioMedio)} acima dele.`,
          `Excesso recente: ${formatarNumero(ep.excessoKwhDiaRecente)} kWh/dia × ${formatarNumero(DIAS_MES_PADRAO)} dias = ${formatarNumero(kwhMes)} kWh/mês.`,
          `Valor do kWh desta conta: ${tarifa(r)} (só a parte que muda com o consumo).`,
          "Faixa mínima supõe que a vistoria resolve 60% do excesso; a máxima, 100%.",
          `Causas mais comuns para as cargas desta conta: ${causas.join("; ")}.`,
          "Investimento: visita de eletricista e pequenos reparos (R$ 300 a R$ 1.500).",
        ],
        esforco: "baixo",
        calculo: `${formatarNumero(ep.excessoKwhDiaRecente)} kWh a mais por dia × ${formatarNumero(DIAS_MES_PADRAO)} dias × ${tarifa(r)}; contamos com resolver de 60% a 100% do excesso`,
        explicacao: `A conta "${a.uc.apelido}" está gastando cerca de ${formatarNumero(ep.excessoKwhDiaRecente)} kWh a mais por dia do que o normal para esta época — mesmo levando em conta as casas novas. Isso custa de ${faixaReais(economia)} por mês. Normalmente é algo simples: ${causas[0]}. Uma vistoria de eletricista acha a causa; o custo é pequeno e o retorno vem já na próxima conta.`,
        decisao: "Autorizar uma vistoria elétrica nas áreas comuns para achar e corrigir o consumo fora do normal.",
        prazo: "Na próxima conta",
        metrica: "kwh_dia",
        efeitoNaMetrica: { min: kwh.min / DIAS_MES_PADRAO, max: kwh.max / DIAS_MES_PADRAO },
        resumo: `Consumo ${pct(ep.desvioMedio)} acima do normal desde ${formatarCompetencia(ep.inicio)}`,
        urgencia: 1.6,
      });
    } else if (ultimo && ep.fim >= somarMeses(ultimo, -6)) {
      // Episódio já encerrado: a perda foi real; a checagem mensal evita repetir
      const kwhAno = ep.excessoKwhTotal;
      const kwh = arredondarFaixa({ min: (kwhAno / 12) * 0.5, max: kwhAno / 12 });
      const economia = arredondarFaixa({ min: kwh.min * r, max: kwh.max * r });
      if (economia.max < 50) continue;
      lista.push({
        id: `checagem_mensal-${a.uc.id}-${ep.inicio}`,
        tipo: "checagem_mensal",
        ucId: a.uc.id,
        ucApelido: a.uc.apelido,
        titulo: "Conferir o consumo todo mês para pegar desperdício cedo",
        descricao: `Em ${periodo} a conta "${a.uc.apelido}" veio ${pct(ep.desvioMedio)} acima do normal: foram ${reais(ep.custoExcesso)} a mais, sem ninguém perceber na hora.`,
        economiaMensalReais: economia,
        economiaMensalKwh: kwh,
        premissas: [
          `Excesso medido em ${periodo}: ${formatarNumero(ep.excessoKwhTotal)} kWh acima do esperado (linha de base corrigida pela ocupação e pela estação) = ${reais(ep.custoExcesso)}.`,
          "Supõe que um episódio assim acontece uma vez por ano; dividido por 12 dá a perda média por mês.",
          "Faixa mínima: a checagem mensal evita metade da perda (o problema é achado depois de 1 conta, não de vários meses); máxima: evita toda.",
          "Sem investimento: o CondoGest já compara cada conta com a linha de base e avisa quando passa da faixa normal.",
          `Vale entender a causa do episódio de ${periodo} — por exemplo: ${causasProvaveis(cargas)[0]}.`,
        ],
        esforco: "baixo",
        calculo: `${reais(ep.custoExcesso)} perdidos em ${periodo} ÷ 12 meses (supondo um episódio por ano); a checagem evita de metade a toda essa perda`,
        explicacao: `Em ${periodo}, a conta "${a.uc.apelido}" subiu ${pct(ep.desvioMedio)} e voltou ao normal depois — foram ${reais(ep.custoExcesso)} jogados fora sem ninguém perceber. Conferindo o consumo por dia a cada conta, um problema assim aparece no primeiro mês. Em média, isso evita de ${faixaReais(economia)} por mês, sem custo.`,
        decisao: "Adotar a conferência mensal do consumo por dia, com aviso automático quando a conta sair da faixa normal.",
        prazo: "Imediato",
        metrica: "kwh_dia",
        efeitoNaMetrica: { min: kwh.min / DIAS_MES_PADRAO, max: kwh.max / DIAS_MES_PADRAO },
        resumo: `Desperdício de ${reais(ep.custoExcesso)} em ${periodo} passou despercebido`,
        urgencia: 1.1,
      });
    }
  }
  return lista;
}

function demanda(ctx: ContextoUc, condominio: Condominio): Rascunho[] {
  const { a } = ctx;
  if (a.uc.subgrupo !== "A4") return [];
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);
  const medidas = janela.filter((m) => m.demandaMedidaKw !== undefined && m.demandaMedidaKw > 0);
  const contratada = [...janela].reverse().find((m) => m.demandaContratadaKw)?.demandaContratadaKw ?? a.uc.demandaContratadaKw;
  if (!contratada || medidas.length < 3) return [];
  const tarifaKw = a.tarifas.demanda ?? TARIFAS_PADRAO.demandaKw;
  const fonte = a.tarifas.fonteDemanda === "conta" ? "média das contas" : "valor típico — a conta não detalha a demanda";
  const maior = medidas.reduce((m, x) => (x.demandaMedidaKw! > m.demandaMedidaKw! ? x : m));
  const maxKw = maior.demandaMedidaKw!;
  const mediaKw = media(medidas.map((m) => m.demandaMedidaKw!));
  const arred5 = (v: number) => Math.max(30, Math.ceil(v / 5) * 5);
  const meses = medidas.length;

  // Demanda acima da contratada: multa de ultrapassagem
  if (maxKw > contratada * 1.05) {
    const custoUltrapassagem = media(janela.map((m) => m.componentes.ultrapassagem));
    const nova = arred5(maxKw * 1.05);
    const custoExtra = (nova - contratada) * tarifaKw;
    const ganho = custoUltrapassagem - custoExtra;
    if (custoUltrapassagem <= 0 || ganho <= 30) return [];
    const economia = arredondarFaixa({ min: ganho * 0.6, max: ganho });
    return [
      {
        id: `aumentar_demanda-${a.uc.id}`,
        tipo: "aumentar_demanda",
        ucId: a.uc.id,
        ucApelido: a.uc.apelido,
        titulo: "Ajustar a demanda contratada para parar de pagar multa",
        descricao: `A demanda medida chegou a ${formatarNumero(maxKw)} kW, acima dos ${formatarNumero(contratada)} kW contratados: a distribuidora cobra multa de ultrapassagem.`,
        economiaMensalReais: economia,
        premissas: [
          `Maior demanda medida em ${meses} meses: ${formatarNumero(maxKw)} kW (${formatarCompetencia(maior.competencia)}).`,
          `Multa de ultrapassagem média: ${reais(custoUltrapassagem)}/mês.`,
          `Nova demanda sugerida: ${formatarNumero(nova)} kW; custo extra de ${reais(custoExtra)}/mês a ${formatarMoeda(tarifaKw)}/kW (${fonte}).`,
        ],
        esforco: "baixo",
        calculo: `multa média de ${reais(custoUltrapassagem)}/mês − ${reais(custoExtra)}/mês dos kW a mais contratados`,
        explicacao: `O condomínio usa mais potência do que contratou e paga multa por isso. Contratar ${formatarNumero(nova)} kW sai mais barato que a multa: economia de ${faixaReais(economia)} por mês.`,
        decisao: `Autorizar o pedido à distribuidora para ajustar a demanda contratada para ${formatarNumero(nova)} kW.`,
        prazo: "1 a 3 ciclos após o pedido",
        metrica: "custo_demanda",
        efeitoNaMetrica: economia,
        resumo: `Multa de ultrapassagem de ${reais(custoUltrapassagem)}/mês`,
      },
    ];
  }

  const sugerida = arred5(maxKw * 1.1);
  const conservadora = arred5(maxKw * 1.2);
  if (sugerida >= contratada * 0.95) return [];
  const economiaMax = (contratada - sugerida) * tarifaKw;
  const economiaMin = Math.max((contratada - Math.min(conservadora, contratada)) * tarifaKw, economiaMax * 0.5);
  const economia = arredondarFaixa({ min: economiaMin, max: economiaMax });
  if (economia.max < 50) return [];
  const ociosa = contratada - mediaKw;
  const ocupadasHoje = condominio.ocupacao.length ? condominio.ocupacao[condominio.ocupacao.length - 1].unidadesOcupadas : 0;
  const crescimento =
    condominio.tipo === "horizontal" && ocupadasHoje > 0 && ocupadasHoje < condominio.unidades
      ? ` A ocupação ainda deve crescer (hoje ${formatarNumero(ocupadasHoje)} de ${formatarNumero(condominio.unidades)} unidades): por isso a faixa mínima usa 20% de folga.`
      : "";

  return [
    {
      id: `ajustar_demanda-${a.uc.id}`,
      tipo: "ajustar_demanda",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: `Reduzir a demanda contratada de ${formatarNumero(contratada)} kW para ${formatarNumero(sugerida)} kW`,
      descricao: `O condomínio paga todo mês por ${formatarNumero(contratada)} kW, mas a maior demanda medida em ${meses} meses foi ${formatarNumero(maxKw)} kW. Em média, ${formatarNumero(ociosa)} kW ficam pagos e sem uso.`,
      economiaMensalReais: economia,
      premissas: [
        `Maior demanda medida nos últimos ${meses} meses: ${formatarNumero(maxKw)} kW (${formatarCompetencia(maior.competencia)}); média: ${formatarNumero(mediaKw)} kW.`,
        `Nova demanda sugerida: ${formatarNumero(sugerida)} kW (maior medida + 10% de folga, arredondada). Faixa mínima com 20% de folga: ${formatarNumero(Math.min(conservadora, contratada))} kW.${crescimento}`,
        `Valor da demanda: ${formatarMoeda(tarifaKw)} por kW ao mês (${fonte}).`,
        `Economia = kW reduzidos × valor do kW: ${formatarNumero(contratada - sugerida)} kW × ${formatarMoeda(tarifaKw)} = ${reais(economiaMax)}/mês (máximo).`,
        "Se a demanda medida passar mais de 5% da contratada, a parte que passar é cobrada como multa (ultrapassagem) — a folga protege contra isso.",
        "O pedido é feito à distribuidora; a nova demanda costuma valer em 1 a 3 ciclos e há prazo mínimo para uma nova redução (confira o contrato).",
        "Não muda nada no funcionamento do condomínio e não reduz kWh: reduz o valor fixo pago pela potência reservada.",
      ],
      esforco: "baixo",
      calculo: `${formatarNumero(contratada - sugerida)} kW a menos × ${formatarMoeda(tarifaKw)} por kW (máximo); com folga de 20%, ${formatarNumero(contratada - Math.min(conservadora, contratada))} kW a menos (mínimo)`,
      explicacao: `Todo mês o condomínio paga por ${formatarNumero(contratada)} kW de potência reservada na rede, usando ou não — é como pagar um plano de internet bem maior do que o usado. Em ${meses} meses, o pico nunca passou de ${formatarNumero(maxKw)} kW. Pedindo à distribuidora para baixar para ${formatarNumero(sugerida)} kW (ainda com folga), a conta cai de ${faixaReais(economia)} por mês, sem obra e sem mudar nada no dia a dia.`,
      decisao: `Autorizar a administradora a pedir à distribuidora a redução da demanda contratada de ${formatarNumero(contratada)} kW para ${formatarNumero(sugerida)} kW.`,
      prazo: "1 a 3 ciclos após o pedido",
      metrica: "custo_demanda",
      efeitoNaMetrica: economia,
      resumo: `Paga ${formatarNumero(contratada)} kW, usa no máximo ${formatarNumero(maxKw)} kW`,
    },
  ];
}

const DESLOCAVEIS = /bomba|recalque|poco|piscina|filtr|\bete\b|esgoto|irriga|aquecedor|pressuriz/;

function ponta(ctx: ContextoUc): Rascunho[] {
  const { a, kwhMes, cargas } = ctx;
  const { ponta: tPonta, foraPonta: tFora } = a.tarifas;
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);
  const comPonta = janela.filter((m) => m.pontaKwh !== undefined);
  if (comPonta.length < 3 || tPonta === undefined || tFora === undefined) return [];
  const pontaMes = media(comPonta.map((m) => m.pontaKwh! / m.dias)) * DIAS_MES_PADRAO;
  const parcela = kwhMes > 0 ? pontaMes / kwhMes : 0;
  const diferenca = tPonta - tFora;
  if (parcela < 0.04 || diferenca <= 0.05) return [];

  const deslocaveis = contem(cargas, DESLOCAVEIS);
  const fracao = deslocaveis.length ? { min: 0.3, max: 0.6 } : { min: 0.15, max: 0.3 };
  const kwhDeslocados = arredondarFaixa({ min: pontaMes * fracao.min, max: pontaMes * fracao.max });
  const economia = arredondarFaixa({ min: kwhDeslocados.min * diferenca, max: kwhDeslocados.max * diferenca });
  if (economia.max < 50) return [];
  const equipamentos = Math.max(1, deslocaveis.length);
  const investimento = { min: 600 * equipamentos, max: 1_500 * equipamentos };
  const razao = tPonta / tFora;
  const livre = a.uc.ambiente === "livre";
  const listaCargas = deslocaveis.length ? deslocaveis.join(", ").toLowerCase() : "bombas e outros motores";

  return [
    {
      id: `tirar_da_ponta-${a.uc.id}`,
      tipo: "tirar_da_ponta",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: "Programar bombas e filtragem para fora do horário de ponta",
      descricao: `${pct(parcela)} do consumo cai no horário de ponta, quando cada kWh custa ${vezes(razao)} mais. Temporizadores tiram parte disso desse horário.`,
      economiaMensalReais: economia,
      kwhDeslocadosMes: kwhDeslocados,
      investimentoReais: investimento,
      premissas: [
        `Consumo na ponta: ${formatarNumero(pontaMes)} kWh/mês em média (${pct(parcela)} do total).`,
        `kWh na ponta: ${tarifa(tPonta)}; fora da ponta: ${tarifa(tFora)} — diferença de ${tarifa(diferenca)}${livre ? " (no mercado livre a diferença está na parte da distribuidora, a TUSD)" : ""}${a.tarifas.fontePonta === "estimada" ? "; valores estimados, a conta não separa ponta e fora ponta" : ""}.`,
        `Supõe que ${pct(fracao.min)} a ${pct(fracao.max)} do consumo da ponta pode mudar de horário (${listaCargas}).`,
        "Economia = kWh que mudam de horário × diferença de preço. O consumo total não cai: só fica mais barato.",
        `Investimento: temporizador digital + contator instalados, R$ 600 a R$ 1.500 por equipamento (${equipamentos}).`,
        "Horário de ponta: 3 horas seguidas no fim da tarde/noite, em dias úteis (o horário exato está na conta da distribuidora).",
      ],
      esforco: "baixo",
      calculo: `${faixaKwhTexto(kwhDeslocados)} por mês mudam de horário × ${tarifa(diferenca)} de diferença entre ponta e fora da ponta`,
      explicacao: `Em 3 horas do fim da tarde nos dias úteis — o "horário de ponta" — cada kWh custa cerca de ${vezes(razao).replace("×", "")} vezes mais: ${tarifa(tPonta)} contra ${tarifa(tFora)}. Hoje ${pct(parcela)} do consumo cai nesse horário, boa parte de equipamentos que podem funcionar em outra hora (${listaCargas}). Com temporizadores, eles param nessas 3 horas e compensam depois. O condomínio gasta a mesma energia, mas paga de ${faixaReais(economia)} a menos por mês.`,
      decisao: `Autorizar a instalação de temporizadores para desligar ${listaCargas} no horário de ponta.`,
      prazo: "2 a 4 semanas",
      metrica: "kwh_ponta_dia",
      efeitoNaMetrica: { min: kwhDeslocados.min / DIAS_MES_PADRAO, max: kwhDeslocados.max / DIAS_MES_PADRAO },
      resumo: `${pct(parcela)} do consumo no horário mais caro`,
    },
  ];
}

function iluminacao(ctx: ContextoUc, condominio: Condominio): Rascunho[] {
  const { a, kwhMes, cargas } = ctx;
  const viaria = contem(cargas, /viaria|poste|\bruas?\b/).length > 0;
  const garagem = !viaria && contem(cargas, /garag/).length > 0;
  if (!viaria && !garagem) return [];

  const parcela = viaria ? { min: 0.35, max: 0.55 } : { min: 0.12, max: 0.22 };
  const reducao = viaria ? { min: 0.35, max: 0.6 } : { min: 0.45, max: 0.7 };
  const kwh = arredondarFaixa({ min: kwhMes * parcela.min * reducao.min, max: kwhMes * parcela.max * reducao.max });
  const r = a.tarifas.reaisPorKwhVariavel;
  const economia = arredondarFaixa({ min: kwh.min * r, max: kwh.max * r });
  if (economia.max < 150) return [];

  // Quantidade de pontos: do cadastro (ex.: "≈ 320 postes") ou estimada pela energia
  const reQtd = /(\d[\d.]*)\s*(postes|luminarias|pontos|lampadas)/;
  const textoQtd = condominio.areasComuns
    .map((t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())
    .find((t) => reQtd.test(t) && (viaria ? /viaria|poste/.test(t) : /garag/.test(t)));
  const qtdCadastro = textoQtd ? Number(reQtd.exec(textoQtd)![1].replace(/\./g, "")) : undefined;
  const horas = viaria ? 12 : 24;
  const kwPorPonto = viaria ? 0.1 : 0.04;
  const kwhLuz = kwhMes * ((parcela.min + parcela.max) / 2);
  const qtd = qtdCadastro ?? Math.max(10, Math.round(kwhLuz / (DIAS_MES_PADRAO * horas * kwPorPonto)));
  const custoPonto = viaria ? { min: 250, max: 450 } : { min: 60, max: 150 };
  const investimento = arredondarFaixa({ min: qtd * custoPonto.min, max: qtd * custoPonto.max });
  const onde = viaria ? "iluminação das ruas" : "iluminação da garagem";
  const controle = viaria ? "fotocélula ou temporizador" : "sensor de presença";

  return [
    {
      id: `led_iluminacao-${a.uc.id}`,
      tipo: "led_iluminacao",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: `Trocar a ${onde} por LED com ${controle}`,
      descricao: `A ${onde} fica acesa ${horas} horas por dia e deve ser ${pct(parcela.min)} a ${pct(parcela.max)} desta conta. LED com ${controle} corta boa parte desse consumo.`,
      economiaMensalReais: economia,
      economiaMensalKwh: kwh,
      investimentoReais: investimento,
      premissas: [
        `Consumo desta conta: ${formatarNumero(kwhMes)} kWh/mês em média.`,
        `A ${onde} representa ${pct(parcela.min)} a ${pct(parcela.max)} desse consumo (estimativa típica — a conta não separa por equipamento).`,
        `LED + ${controle} reduz ${pct(reducao.min)} a ${pct(reducao.max)} do consumo da iluminação; se parte já for LED, a economia fica perto do mínimo.`,
        `Valor do kWh desta conta: ${tarifa(r)}.`,
        `${formatarNumero(qtd)} pontos de luz (${qtdCadastro ? "cadastro do condomínio" : "estimado pelo consumo"}) × ${reais(custoPonto.min)} a ${reais(custoPonto.max)} por ponto, com instalação.`,
        "Pode ser feito em etapas, começando pelos pontos que ficam mais tempo acesos.",
      ],
      esforco: "medio",
      calculo: `${formatarNumero(kwhMes)} kWh/mês × ${pct(parcela.min)}–${pct(parcela.max)} de iluminação × ${pct(reducao.min)}–${pct(reducao.max)} de redução × ${tarifa(r)}`,
      explicacao: `A ${onde} fica acesa ${horas} horas por dia, todos os dias, e é uma parte grande da conta "${a.uc.apelido}". Lâmpadas de LED gastam bem menos para iluminar o mesmo, e ${controle === "sensor de presença" ? "o sensor apaga quando não tem ninguém" : "a fotocélula garante que nada fica aceso de dia"}. A economia estimada é de ${faixaReais(economia)} por mês; o investimento se paga com a própria economia.`,
      decisao: `Aprovar orçamento para trocar a ${onde} por LED com ${controle} (pode ser em etapas).`,
      prazo: "1 a 3 meses",
      metrica: "kwh_dia",
      efeitoNaMetrica: { min: kwh.min / DIAS_MES_PADRAO, max: kwh.max / DIAS_MES_PADRAO },
      resumo: `${onde[0].toUpperCase()}${onde.slice(1)}: ${pct(parcela.min)}–${pct(parcela.max)} da conta`,
    },
  ];
}

function mercadoLivre(ctx: ContextoUc): Rascunho[] {
  const { a, kwhMes } = ctx;
  if (a.uc.subgrupo !== "A4") return [];
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);

  if (a.uc.ambiente === "livre") {
    const ml = a.mercadoLivre;
    if (!ml || ml.meses12m < 3 || ml.percentual12m >= 0.1) return [];
    const custoCativoMes = ml.custoCativo12m / ml.meses12m;
    const alvo = { min: 0.15, max: 0.2 };
    const economia = arredondarFaixa({
      min: Math.max(0, (alvo.min - ml.percentual12m) * custoCativoMes),
      max: Math.max(0, (alvo.max - ml.percentual12m) * custoCativoMes),
    });
    if (economia.max < 100) return [];
    return [
      {
        id: `revisar_contrato_livre-${a.uc.id}`,
        tipo: "revisar_contrato_livre",
        ucId: a.uc.id,
        ucApelido: a.uc.apelido,
        titulo: "Renegociar o contrato do mercado livre",
        descricao: `Nos últimos ${ml.meses12m} meses o mercado livre economizou só ${pct(ml.percentual12m, 1)} em relação ao cativo — abaixo do que costuma valer a pena.`,
        economiaMensalReais: economia,
        investimentoReais: { min: 0, max: 5_000 },
        premissas: [
          `Economia atual: ${pct(ml.percentual12m, 1)} (${reais(ml.economia12m)} em ${ml.meses12m} meses).`,
          "Contratos bem negociados costumam economizar 15% a 20% em relação ao cativo.",
          "Investimento: assessoria independente para comparar propostas (opcional).",
          "Verifique multa de rescisão e prazo do contrato atual antes de negociar.",
        ],
        esforco: "medio",
        calculo: `(${pct(alvo.min)} a ${pct(alvo.max)} − ${pct(ml.percentual12m, 1)} de hoje) × ${reais(custoCativoMes)}/mês que a energia custaria no cativo`,
        explicacao: `O condomínio já está no mercado livre, mas a economia está pequena: ${pct(ml.percentual12m, 1)}. Com propostas de outras comercializadoras, dá para buscar 15% a 20% — mais ${faixaReais(economia)} por mês.`,
        decisao: "Autorizar a administradora a buscar propostas e renegociar o contrato de energia no mercado livre.",
        prazo: "3 a 6 meses",
        metrica: "reais_por_kwh",
        efeitoNaMetrica: kwhMes > 0 ? { min: economia.min / kwhMes, max: economia.max / kwhMes } : { min: 0, max: 0 },
        resumo: `Mercado livre economiza só ${pct(ml.percentual12m, 1)}`,
      },
    ];
  }

  // Cativo A4 → mercado livre
  const consumoRs = soma(janela.map((m) => m.componentes.consumo + m.componentes.consumoPonta + m.componentes.consumoForaPonta)) / Math.max(1, janela.length);
  const bandeiraMes = soma(janela.map((m) => m.custoBandeira)) / Math.max(1, janela.length);
  const parcelaEnergiaBase = consumoRs > 0 ? consumoRs : ctx.custoMes * 0.6;
  const parcelaEnergia = parcelaEnergiaBase * 0.45;
  const economia = arredondarFaixa({ min: parcelaEnergia * 0.15, max: parcelaEnergia * 0.25 + bandeiraMes });
  if (economia.max < 300 || kwhMes < 5_000) return [];
  const investimento = { min: 0, max: 20_000 };

  return [
    {
      id: `migrar_mercado_livre-${a.uc.id}`,
      tipo: "migrar_mercado_livre",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: "Comprar a energia no mercado livre",
      descricao: `A conta de média tensão ainda compra energia da distribuidora a preço tabelado. No mercado livre, a mesma energia costuma sair 15% a 25% mais barata.`,
      economiaMensalReais: economia,
      investimentoReais: investimento,
      premissas: [
        `Gasto médio com consumo (sem demanda e iluminação pública): ${reais(parcelaEnergiaBase)}/mês.`,
        "Parte da energia (TE) estimada em 45% desse valor — o resto é o uso da rede (TUSD), que continua sendo pago à distribuidora.",
        "Desconto típico do mercado livre: 15% a 25% sobre a parte da energia.",
        `No mercado livre não há bandeira tarifária: nos últimos 12 meses ela custou ${reais(bandeiraMes)}/mês em média (somada só na faixa máxima, porque o preço do contrato já embute esse risco).`,
        "Desde 2024 toda conta de média tensão pode migrar, por meio de uma comercializadora varejista.",
        "Contratos costumam durar de 2 a 5 anos com preço fixo: compare pelo menos 3 propostas e evite prazo longo sem assessoria.",
        "Aviso de saída à distribuidora com cerca de 6 meses de antecedência. Investimento: adequação da medição, quando exigida (muitas comercializadoras absorvem).",
      ],
      esforco: "medio",
      calculo: `15% a 25% × ${reais(parcelaEnergia)}/mês da parte de energia (45% do consumo), mais até ${reais(bandeiraMes)}/mês de bandeira que deixa de existir`,
      explicacao: `Hoje o condomínio compra a energia da distribuidora pelo preço da tabela. No mercado livre, a energia vem pelos mesmos fios, mas é comprada de uma comercializadora, com desconto — normalmente 15% a 25% na parte de energia da conta — e sem bandeira tarifária. Para esta conta, isso dá de ${faixaReais(economia)} por mês. O cuidado é o contrato: comparar propostas e não fechar por muitos anos sem assessoria.`,
      decisao: "Autorizar a administradora a pedir propostas de comercializadoras e apresentar a melhor na próxima reunião.",
      prazo: "Cerca de 6 meses",
      metrica: "reais_por_kwh",
      efeitoNaMetrica: kwhMes > 0 ? { min: economia.min / kwhMes, max: economia.max / kwhMes } : { min: 0, max: 0 },
      resumo: "Energia de média tensão ainda no mercado cativo",
    },
  ];
}

function assinatura(ctx: ContextoUc): Rascunho[] {
  const { a, kwhMes } = ctx;
  if (a.uc.subgrupo !== "B3" || a.uc.ambiente !== "cativo") return [];
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);
  const consumoRs =
    soma(janela.map((m) => m.componentes.consumo + m.componentes.consumoPonta + m.componentes.consumoForaPonta + m.componentes.bandeira)) /
    Math.max(1, janela.length);
  const baseRs = consumoRs > 0 ? consumoRs : ctx.custoMes * TARIFAS_PADRAO.parcelaVariavel;
  const disponibilidade = 100 * a.tarifas.reaisPorKwhVariavel; // taxa mínima (trifásico)
  const compensavel = Math.max(0, baseRs - disponibilidade);
  const economia = arredondarFaixa({ min: compensavel * 0.1, max: compensavel * 0.2 });
  if (economia.max < 100) return [];

  return [
    {
      id: `assinatura_energia-${a.uc.id}`,
      tipo: "assinatura_energia",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: "Aderir a uma assinatura de energia solar (geração compartilhada)",
      descricao: `A conta de baixa tensão pode receber créditos de uma usina solar por assinatura, com desconto sobre a energia — sem obra e sem investimento.`,
      economiaMensalReais: economia,
      premissas: [
        `Gasto médio com consumo desta conta: ${reais(baseRs)}/mês (sem iluminação pública).`,
        `O desconto vale sobre a energia compensada: descontamos a taxa mínima (100 kWh ≈ ${reais(disponibilidade)}) e a iluminação pública, que continuam sendo pagas.`,
        "Partimos dos ~20% de desconto citados pelo síndico, mas usamos a faixa de 10% a 20%: o desconto real é aplicado só sobre parte da conta e as regras da Lei 14.300 reduzem o benefício aos poucos.",
        "Sem investimento. Contratos costumam ter fidelidade de 12 a 24 meses — confira a multa de saída e se o desconto é fixo.",
        "Não reduz o consumo (kWh): reduz o valor pago por kWh.",
      ],
      esforco: "baixo",
      calculo: `10% a 20% de desconto × ${reais(compensavel)}/mês de consumo compensável (sem taxa mínima e iluminação pública)`,
      explicacao: `Empresas com usinas solares "alugam" a energia que produzem: ela vira crédito na conta do condomínio, com desconto. O síndico ouviu falar em 20%; na prática, como o desconto não vale sobre a taxa mínima e a iluminação pública, contamos com 10% a 20% da parte de consumo — de ${faixaReais(economia)} por mês. Não tem obra nem investimento; o ponto de atenção é a fidelidade do contrato.`,
      decisao: "Autorizar a administradora a cotar assinaturas de energia solar e contratar a de melhor desconto, sem multa de saída alta.",
      prazo: "1 a 3 meses",
      metrica: "reais_por_kwh",
      efeitoNaMetrica: kwhMes > 0 ? { min: economia.min / kwhMes, max: economia.max / kwhMes } : { min: 0, max: 0 },
      resumo: "Desconto de 10–20% na energia da baixa tensão, sem obra",
    },
  ];
}

function fatorPotencia(ctx: ContextoUc): Rascunho[] {
  const { a, cargas } = ctx;
  const janela = a.janela.length ? a.janela : a.meses.slice(-12);
  const comReativo = janela.filter((m) => (m.reativoKvarh ?? 0) > 0 || m.componentes.reativo > 0);
  if (comReativo.length < 3) return [];
  const temItem = janela.some((m) => m.componentes.reativo > 0);
  const custoMes = temItem
    ? media(janela.map((m) => m.componentes.reativo))
    : media(janela.map((m) => (m.reativoKvarh ?? 0) * (a.tarifas.reativo ?? TARIFAS_PADRAO.reativoKvarh)));
  if (custoMes < 30) return [];
  const economia = arredondarFaixa({ min: custoMes * 0.8, max: custoMes });
  const kvarhMes = media(janela.map((m) => m.reativoKvarh ?? 0));
  const novo = a.uc.subgrupo === "A4" ? { min: 6_000, max: 18_000 } : { min: 2_500, max: 8_000 };
  // A cobrança aparece e some: sinal típico de banco de capacitores que já existe e falha
  const intermitente = comReativo.length < janela.length && janela.length >= 6;
  const investimento = intermitente ? { min: 1_500, max: novo.max } : novo;
  const motores = contem(cargas, /elevador|bomba|motor|recalque/);
  const mesesComReativo = comReativo.map((m) => formatarCompetencia(m.competencia));

  return [
    {
      id: `fator_potencia-${a.uc.id}`,
      tipo: "fator_potencia",
      ucId: a.uc.id,
      ucApelido: a.uc.apelido,
      titulo: intermitente
        ? "Consertar ou instalar banco de capacitores (multa de reativo)"
        : "Instalar banco de capacitores para acabar com a multa de reativo",
      descricao: `Em ${comReativo.length} dos últimos ${janela.length} meses a conta cobrou energia reativa excedente — em média ${reais(custoMes)} por mês.`,
      economiaMensalReais: economia,
      investimentoReais: investimento,
      premissas: [
        `Reativo excedente cobrado em ${comReativo.length} de ${janela.length} meses; média de ${formatarNumero(kvarhMes)} kvarh/mês e ${reais(custoMes)}/mês${temItem ? "" : " (valor estimado — a conta não detalha o item)"}.`,
        "A cobrança acontece quando o fator de potência fica abaixo de 0,92.",
        "Um banco de capacitores automático, bem dimensionado, elimina 80% a 100% dessa cobrança.",
        intermitente
          ? `A cobrança aparece e some (${mesesComReativo.join(", ")}): sinal típico de um banco de capacitores que já existe e está falhando. Consertar custa a partir de ${reais(investimento.min)}; um banco novo, até ${reais(novo.max)}.`
          : `Investimento típico de um banco novo, com instalação: ${faixaReais(novo)} (depende do tamanho; peça laudo de um eletricista).`,
        motores.length ? `Cargas com motor nesta conta: ${motores.join(", ").toLowerCase()}.` : "Motores (bombas, elevadores) são a causa mais comum.",
      ],
      esforco: "medio",
      calculo: `80% a 100% da multa média de ${reais(custoMes)}/mês`,
      explicacao: `Motores de bombas e elevadores puxam da rede uma energia "de sobra" (reativa) que não vira trabalho. Quando ela passa do limite, a distribuidora cobra uma multa — aqui, ${reais(custoMes)} por mês em média. ${intermitente ? "Como a multa aparece em alguns meses e some em outros, é provável que o banco de capacitores do prédio esteja com defeito — consertar costuma resolver." : "Um banco de capacitores corrige isso na origem."} O investimento se paga com a própria multa que deixa de ser cobrada.`,
      decisao: intermitente
        ? "Aprovar a vistoria e o conserto do banco de capacitores (ou a troca, se o laudo indicar)."
        : "Aprovar laudo e orçamento para instalação de banco de capacitores automático.",
      prazo: "1 a 2 meses",
      metrica: "custo_reativo",
      efeitoNaMetrica: economia,
      resumo: `Multa de reativo de ${reais(custoMes)}/mês`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/** Recomendações a partir de uma base já montada (evita recalcular) */
export function recomendacoesDaBase(base: BaseAnalise): RecomendacaoEnergia[] {
  const rascunhos: Rascunho[] = [];
  for (const a of base.ucs) {
    const ctx = contextoUc(a, base.condominio);
    if (!ctx) continue;
    rascunhos.push(
      ...anomalias(ctx, base),
      ...demanda(ctx, base.condominio),
      ...ponta(ctx),
      ...iluminacao(ctx, base.condominio),
      ...mercadoLivre(ctx),
      ...assinatura(ctx),
      ...fatorPotencia(ctx),
    );
  }

  const comNota = rascunhos.map(({ urgencia, ...r }) => {
    const paybackMeses = payback(r.investimentoReais, r.economiaMensalReais);
    const meio = (r.economiaMensalReais.min + r.economiaMensalReais.max) / 2;
    const pontuacao = meio * FATOR_ESFORCO[r.esforco] * fatorPayback(paybackMeses) * (urgencia ?? 1);
    return { ...r, condominioId: base.condominio.id, paybackMeses, pontuacao, prioridade: 0 } satisfies RecomendacaoEnergia;
  });

  return comNota
    .sort((x, y) => y.pontuacao - x.pontuacao)
    .map((r, i) => ({ ...r, prioridade: i + 1 }));
}

/** Recomendações de energia aplicáveis ao condomínio, ordenadas por prioridade (1 = primeira) */
export function gerarRecomendacoes(condominio: Condominio, contas: Conta[]): RecomendacaoEnergia[] {
  return recomendacoesDaBase(montarBaseAnalise(condominio, contas));
}

/** Soma simples das faixas (atenção: ações sobre a mesma conta podem se sobrepor) */
export function somarEconomias(recs: Pick<Recomendacao, "economiaMensalReais">[]) {
  return {
    min: soma(recs.map((r) => r.economiaMensalReais.min)),
    max: soma(recs.map((r) => r.economiaMensalReais.max)),
  };
}
