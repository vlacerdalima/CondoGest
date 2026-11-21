/**
 * Montagem das faturas fictícias (B3 cativo, A4 verde cativo, A4 verde livre
 * — distribuição — e fatura da comercializadora).
 *
 * Uso:
 *   const { principal, comercializadora } = gerarFaturas({ uc: "uc-rp-mt", competencia: "2026-12" });
 *   const conta = faturaParaConta(principal);
 */
import { centavos, criarPrng, hashString } from "../prng";
import type { Bandeira, Competencia, DataISO } from "../tipos";
import { diferencaEmDias, somarDias, somarMeses } from "../dados/referencia";
import { COMERCIALIZADORA, DISTRIBUIDORA, documentoFicticioCliente } from "./emissores";
import {
  contextoDaUc,
  mesDaSerie,
  mesesPadrao,
  SEMENTE_PADRAO,
  type ContextoUc,
  type MesSerie,
} from "./serie";
import {
  ADICIONAL_BANDEIRA,
  ALIQUOTA_COFINS,
  ALIQUOTA_ICMS,
  ALIQUOTA_PIS,
  bandeiraDoMesCivil,
  comTributos,
  DATA_REAJUSTE_TARIFARIO,
  FATOR_POTENCIA_REFERENCIA,
  indiceTarifario,
  ITEM_BANDEIRA,
  PERDAS_LIVRE,
  precoContratoLivreMwh,
  PROINFA_LIVRE,
  ROTULO_BANDEIRA,
  TARIFAS,
} from "./tarifas";
import type {
  ComparativoLivreCativo,
  FaturaComercializadora,
  FaturaDistribuidora,
  FaturasGeradas,
  ItemDetalhado,
  LinhaMedidor,
  LinhaTributo,
  MesHistorico,
  ParametrosFatura,
  TipoFaturaFicticia,
} from "./tipos";

const arred2 = (v: number) => Math.round(v * 100) / 100;
const arred3 = (v: number) => Math.round(v * 1000) / 1000;
const arred6 = (v: number) => Math.round(v * 1e6) / 1e6;
const pad2 = (n: number) => String(n).padStart(2, "0");
/** "2026-09" → "09/26" */
const mesAnoCurto = (c: Competencia) => `${c.slice(5, 7)}/${c.slice(2, 4)}`;

/* ------------------------------ itens ------------------------------ */

/** Item com tributos por dentro: valor, PIS/COFINS, base e valor do ICMS */
function itemTributado(
  descricao: string,
  unidade: ItemDetalhado["unidade"],
  quantidade: number,
  tarifaSemTributos: number,
): ItemDetalhado {
  const preco = comTributos(tarifaSemTributos);
  const valor = centavos(quantidade * preco);
  const icms = centavos(valor * ALIQUOTA_ICMS);
  return {
    descricao,
    unidade,
    quantidade,
    precoUnitario: arred6(preco),
    valor,
    pisCofins: centavos((valor - icms) * (ALIQUOTA_PIS + ALIQUOTA_COFINS)),
    baseIcms: valor,
    aliquotaIcms: ALIQUOTA_ICMS * 100,
    icms,
    tarifaSemTributos: arred6(tarifaSemTributos),
  };
}

/** Item sem incidência de tributos na fatura (iluminação pública, créditos, ajustes) */
const itemSimples = (descricao: string, valor: number): ItemDetalhado => ({ descricao, valor: centavos(valor) });

function itensEventuais(mes: MesSerie, indice: number): ItemDetalhado[] {
  const itens: ItemDetalhado[] = [];
  if (mes.cde) itens.push(itemSimples("ICMS-CDE", mes.cde * indice));
  if (mes.dic) itens.push(itemSimples(`Comp. DIC Mês ${mesAnoCurto(mes.dic.referencia)}`, mes.dic.valor));
  return itens;
}

function totalizar(itens: ItemDetalhado[]) {
  const total = centavos(itens.reduce((s, i) => s + i.valor, 0));
  const baseIcms = centavos(itens.reduce((s, i) => s + (i.baseIcms ?? 0), 0));
  const icms = centavos(itens.reduce((s, i) => s + (i.icms ?? 0), 0));
  const pisCofins = centavos(itens.reduce((s, i) => s + (i.pisCofins ?? 0), 0));
  const pis = centavos((pisCofins * ALIQUOTA_PIS) / (ALIQUOTA_PIS + ALIQUOTA_COFINS));
  const cofins = centavos(pisCofins - pis);
  const basePisCofins = centavos(baseIcms - icms);
  const tributos: LinhaTributo[] = [
    { tributo: "PIS", base: basePisCofins, aliquota: ALIQUOTA_PIS * 100, valor: pis },
    { tributo: "COFINS", base: basePisCofins, aliquota: ALIQUOTA_COFINS * 100, valor: cofins },
    { tributo: "ICMS", base: baseIcms, aliquota: ALIQUOTA_ICMS * 100, valor: icms },
  ];
  return { total, tributos };
}

/* ------------------------------ bandeiras ------------------------------ */

/** Dias do ciclo em cada bandeira (calendário por mês civil, ou bandeira única escolhida) */
export function bandeirasDoCiclo(
  leituraAnterior: DataISO,
  leituraAtual: DataISO,
  escolhida?: Bandeira,
): { bandeira: Bandeira; dias: number }[] {
  const total = diferencaEmDias(leituraAnterior, leituraAtual);
  if (escolhida) return [{ bandeira: escolhida, dias: total }];
  const lista: { bandeira: Bandeira; dias: number }[] = [];
  let inicio = leituraAnterior;
  while (inicio < leituraAtual) {
    const mesCivil = inicio.slice(0, 7);
    const primeiroDoProximo = `${somarMeses(mesCivil, 1)}-01`;
    const limite = primeiroDoProximo < leituraAtual ? primeiroDoProximo : leituraAtual;
    const dias = diferencaEmDias(inicio, limite);
    const bandeira = bandeiraDoMesCivil(mesCivil);
    const existente = lista.find((b) => b.bandeira === bandeira);
    if (existente) existente.dias += dias;
    else lista.push({ bandeira, dias });
    inicio = limite;
  }
  return lista;
}

function bandeiraPredominante(ciclo: { bandeira: Bandeira; dias: number }[]): Bandeira {
  return ciclo.reduce((melhor, b) => (b.dias >= melhor.dias ? b : melhor), ciclo[0]).bandeira;
}

function itensBandeira(consumoKwh: number, dias: number, ciclo: { bandeira: Bandeira; dias: number }[], indice: number) {
  return ciclo
    .filter((b) => ADICIONAL_BANDEIRA[b.bandeira] > 0 && b.dias > 0)
    .map((b) =>
      itemTributado(
        ITEM_BANDEIRA[b.bandeira],
        "kWh",
        Math.round((consumoKwh * b.dias) / Math.max(1, dias)),
        ADICIONAL_BANDEIRA[b.bandeira] * indice,
      ),
    );
}

/* ------------------------------ itens por tipo ------------------------------ */

function itensB3(ctx: ContextoUc, mes: MesSerie, ciclo: { bandeira: Bandeira; dias: number }[]) {
  const idx = indiceTarifario(mes.competencia);
  return [
    itemTributado("Consumo-TUSD", "kWh", mes.consumoKwh, TARIFAS.b3.tusd * idx),
    itemTributado("Consumo-TE", "kWh", mes.consumoKwh, TARIFAS.b3.te * idx),
    ...itensBandeira(mes.consumoKwh, mes.dias, ciclo, idx),
    itemSimples("Ilum. Púb. Municipal", ctx.perfil.iluminacaoPublica * idx),
    ...itensEventuais(mes, idx),
  ];
}

function demandaFaturada(ctx: ContextoUc, mes: MesSerie) {
  const contratada = ctx.uc.demandaContratadaKw ?? 0;
  const medida = mes.demandaKw ?? 0;
  return {
    contratada,
    faturada: Math.max(contratada, medida),
    ultrapassagem: medida > contratada * 1.05 ? arred2(medida - contratada) : 0,
  };
}

function itensA4Cativo(
  ctx: ContextoUc,
  mes: MesSerie,
  ciclo: { bandeira: Bandeira; dias: number }[],
  eventuais: boolean,
) {
  const idx = indiceTarifario(mes.competencia);
  const t = TARIFAS.a4VerdeCativo;
  const demanda = demandaFaturada(ctx, mes);
  const itens: ItemDetalhado[] = [
    itemTributado("Demanda", "kW", demanda.faturada, t.demanda * idx),
  ];
  if (demanda.ultrapassagem > 0) {
    itens.push(itemTributado("Demanda Ultrapassagem", "kW", demanda.ultrapassagem, 2 * t.demanda * idx));
  }
  itens.push(
    itemTributado("Demanda Reativa Exc.", "kVAr", mes.demandaReativaExcedenteKvar ?? 0, t.demanda * idx),
    itemTributado("Consumo Ponta TUSD", "kWh", mes.consumoPontaKwh, t.tusdPonta * idx),
    itemTributado("Consumo Ponta TE", "kWh", mes.consumoPontaKwh, t.tePonta * idx),
    itemTributado("Consumo F.Ponta TUSD", "kWh", mes.consumoForaPontaKwh, t.tusdForaPonta * idx),
    itemTributado("Consumo F.Ponta TE", "kWh", mes.consumoForaPontaKwh, t.teForaPonta * idx),
    ...itensBandeira(mes.consumoKwh, mes.dias, ciclo, idx),
    itemTributado("Cons.Reat.Exc.Ponta", "kVArh", mes.excedentePontaKvarh, t.reativo * idx),
    itemTributado("Cons.Reat.Exc.F.Ponta", "kVArh", mes.excedenteForaPontaKvarh, t.reativo * idx),
    itemSimples("Ilum. Púb. Municipal", ctx.perfil.iluminacaoPublica * idx),
  );
  if (eventuais) itens.push(...itensEventuais(mes, idx));
  return itens;
}

function itensA4LivreDistribuicao(ctx: ContextoUc, mes: MesSerie) {
  const idx = indiceTarifario(mes.competencia);
  const t = TARIFAS.a4VerdeLivre;
  const demanda = demandaFaturada(ctx, mes);
  const fio = itemTributado("Uso Sistema Fio", "kW", demanda.faturada, t.fio * idx);
  const encargoPonta = itemTributado("Uso Sistema Encar.NP", "kWh", mes.consumoPontaKwh, t.encargoPonta * idx);
  const encargoForaPonta = itemTributado("Uso Sistema Encar.FP", "kWh", mes.consumoForaPontaKwh, t.encargoForaPonta * idx);
  const itens: ItemDetalhado[] = [
    itemTributado("Demanda Reativa Exc.", "kVAr", mes.demandaReativaExcedenteKvar ?? 0, t.fio * idx),
    fio,
  ];
  if (demanda.ultrapassagem > 0) {
    itens.push(itemTributado("Uso Sist. Fio Ultrap.", "kW", demanda.ultrapassagem, 2 * t.fio * idx));
  }
  itens.push(
    encargoPonta,
    encargoForaPonta,
    itemTributado("Cons.Reat.Exc.NPonta", "kVArh", mes.excedentePontaKvarh, t.reativo * idx),
    itemTributado("Cons.Reat.Exc.FPonta", "kVArh", mes.excedenteForaPontaKvarh, t.reativo * idx),
    itemSimples("Ilum. Púb. Municipal", ctx.perfil.iluminacaoPublica * idx),
  );
  if (mes.cde) itens.push(itemSimples("ICMS-CDE", mes.cde * idx));
  if (mes.descontoFonte && mes.descontoFonte > 0) {
    const usoSistema = fio.valor + encargoPonta.valor + encargoForaPonta.valor;
    itens.push(itemSimples("Dif. Desc. Ft.Alter.", -usoSistema * mes.descontoFonte));
  }
  if (mes.dic) itens.push(itemSimples(`Comp. DIC Mês ${mesAnoCurto(mes.dic.referencia)}`, mes.dic.valor));
  return itens;
}

/** Fatura da comercializadora: energia medida + perdas − PROINFA, preço do contrato, ICMS por dentro */
function energiaLivre(mes: MesSerie) {
  const medidoMwh = arred3(mes.consumoKwh / 1000);
  const perdasMwh = arred3(medidoMwh * PERDAS_LIVRE);
  const proinfaMwh = arred3(medidoMwh * PROINFA_LIVRE);
  const faturadoMwh = arred3(medidoMwh + perdasMwh - proinfaMwh);
  const precoMwhSemIcms = precoContratoLivreMwh(mes.competencia);
  const valorSemIcms = centavos(faturadoMwh * precoMwhSemIcms);
  const valor = centavos(valorSemIcms / (1 - ALIQUOTA_ICMS));
  return {
    medidoMwh,
    perdasPercentual: PERDAS_LIVRE * 100,
    perdasMwh,
    proinfaPercentual: PROINFA_LIVRE * 100,
    proinfaMwh,
    faturadoMwh,
    precoMwhSemIcms,
    precoMwhComIcms: arred6(precoMwhSemIcms / (1 - ALIQUOTA_ICMS)),
    valorSemIcms,
    icms: centavos(valor - valorSemIcms),
    aliquotaIcms: ALIQUOTA_ICMS * 100,
    valor,
  };
}

/** Custo da mesma medição no mercado cativo (A4 verde), com bandeiras do calendário */
function custoCativoEquivalente(ctx: ContextoUc, mes: MesSerie) {
  const ciclo = bandeirasDoCiclo(mes.leituraAnterior, mes.leituraAtual);
  return totalizar(itensA4Cativo(ctx, mes, ciclo, false)).total;
}

function comparativoDoMes(competencia: Competencia, distribuicao: number, energia: number, cativo: number): ComparativoLivreCativo {
  const totalLivre = centavos(distribuicao + energia);
  const economia = centavos(cativo - totalLivre);
  return {
    competencia,
    distribuicao,
    energia,
    totalLivre,
    cativoEquivalente: cativo,
    economia,
    economiaPercentual: cativo > 0 ? Math.round((economia / cativo) * 1000) / 10 : 0,
  };
}

/* ------------------------------ datas da fatura ------------------------------ */

/** 0 = segunda … 5 = sábado, 6 = domingo (2024-01-01 foi segunda) */
const diaDaSemana = (d: DataISO) => (((diferencaEmDias("2024-01-01", d) % 7) + 7) % 7);

function proximoDiaUtil(d: DataISO) {
  const dia = diaDaSemana(d);
  return dia === 5 ? somarDias(d, 2) : dia === 6 ? somarDias(d, 1) : d;
}

function vencimentoNoDia(competencia: Competencia, dia: number, emissao: DataISO) {
  const ultimoDia = diferencaEmDias(`${competencia}-01`, `${somarMeses(competencia, 1)}-01`);
  let data = `${competencia}-${pad2(Math.min(dia, ultimoDia))}`;
  if (diferencaEmDias(emissao, data) < 7) data = somarDias(emissao, 10);
  return proximoDiaUtil(data);
}

/* ------------------------------ cabeçalho ------------------------------ */

function clienteDaFatura(ctx: ContextoUc) {
  const local = ctx.condominio
    ? `${ctx.condominio.bairro} · ${ctx.condominio.cidade}/${ctx.condominio.uf} · CEP 00000-000`
    : "Recife/PE · CEP 00000-000";
  return {
    nome: ctx.nomeCliente.toLocaleUpperCase("pt-BR"),
    documento: documentoFicticioCliente(ctx.indice),
    endereco: [`Endereço fictício · ${ctx.avulsa ? "unidade avulsa" : ctx.uc.apelido.toLowerCase()}`, local],
  };
}

function ucDaFatura(ctx: ContextoUc) {
  const { uc } = ctx;
  return {
    id: uc.id,
    condominioId: uc.condominioId,
    numeroUc: uc.numeroUc,
    numeroMedidor: uc.numeroMedidor,
    apelido: uc.apelido,
    subgrupo: uc.subgrupo,
    modalidade: uc.modalidade,
    ambiente: uc.ambiente,
    demandaContratadaKw: uc.demandaContratadaKw,
    avulsa: ctx.avulsa,
  };
}

function numeroFatura(prefixo: string, ctx: ContextoUc, c: Competencia, semente: string) {
  const h = hashString(`${prefixo}:${ctx.chave}:${c}:${semente}`);
  return `SIM-${prefixo}-${c.replace("-", "")}-${String(h % 1_000_000).padStart(6, "0")}`;
}

function medidorDaFatura(ctx: ContextoUc, mes: MesSerie): LinhaMedidor[] {
  const k = ctx.perfil.constanteMedidor;
  const ant = mes.registrosAnteriores;
  const atu = mes.registrosAtuais;
  if (ctx.uc.subgrupo === "B3") {
    return [
      { grandeza: "Energia Ativa", posto: "Único", unidade: "kWh", leituraAnterior: ant.ativaForaPonta, leituraAtual: atu.ativaForaPonta, constante: k, medido: mes.consumoKwh },
      { grandeza: "Energia Reativa", posto: "Único", unidade: "kVArh", leituraAnterior: ant.reativaForaPonta, leituraAtual: atu.reativaForaPonta, constante: k, medido: mes.reativoForaPontaKvarh },
    ];
  }
  return [
    { grandeza: "Energia Ativa", posto: "Ponta", unidade: "kWh", leituraAnterior: ant.ativaPonta, leituraAtual: atu.ativaPonta, constante: k, medido: mes.consumoPontaKwh },
    { grandeza: "Energia Ativa", posto: "Fora Ponta", unidade: "kWh", leituraAnterior: ant.ativaForaPonta, leituraAtual: atu.ativaForaPonta, constante: k, medido: mes.consumoForaPontaKwh },
    { grandeza: "Energia Reativa", posto: "Ponta", unidade: "kVArh", leituraAnterior: ant.reativaPonta, leituraAtual: atu.reativaPonta, constante: k, medido: mes.reativoPontaKvarh },
    { grandeza: "Energia Reativa", posto: "Fora Ponta", unidade: "kVArh", leituraAnterior: ant.reativaForaPonta, leituraAtual: atu.reativaForaPonta, constante: k, medido: mes.reativoForaPontaKvarh },
    { grandeza: "Demanda Ativa", posto: "Ponta", unidade: "kW", leituraAtual: mes.leituraDemandaPonta ?? 0, constante: k, medido: mes.demandaPontaKw ?? 0 },
    { grandeza: "Demanda Ativa", posto: "Fora Ponta", unidade: "kW", leituraAtual: mes.leituraDemanda ?? 0, constante: k, medido: mes.demandaKw ?? 0 },
  ];
}

const historicoDoMes = (m: MesSerie, a4: boolean): MesHistorico => ({
  competencia: m.competencia,
  dias: m.dias,
  consumoKwh: m.consumoKwh,
  ...(a4 ? { consumoPontaKwh: m.consumoPontaKwh, consumoForaPontaKwh: m.consumoForaPontaKwh, demandaMedidaKw: m.demandaKw } : {}),
});

function textoBandeiras(ciclo: { bandeira: Bandeira; dias: number }[]) {
  return ciclo
    .map((b) => `${ROTULO_BANDEIRA[b.bandeira].toUpperCase()} (${b.dias} ${b.dias === 1 ? "dia" : "dias"})`)
    .join(" e ");
}

function mensagensDistribuidora(
  tipo: TipoFaturaFicticia,
  ctx: ContextoUc,
  mes: MesSerie,
  ciclo: { bandeira: Bandeira; dias: number }[],
  itens: ItemDetalhado[],
) {
  const msgs = [
    "Até a emissão desta fatura você não possui débitos vencidos com a distribuidora (informação fictícia).",
  ];
  if (tipo === "a4_verde_livre_distribuicao") {
    msgs.push(
      "Consumidor do mercado livre: esta fatura cobra apenas o uso do sistema de distribuição (TUSD). A energia é faturada pela comercializadora. Bandeiras tarifárias não se aplicam.",
    );
  } else {
    const adicionais = ciclo
      .filter((b) => ADICIONAL_BANDEIRA[b.bandeira] > 0)
      .map((b) => `${ROTULO_BANDEIRA[b.bandeira].toLowerCase()}: R$ ${(ADICIONAL_BANDEIRA[b.bandeira] * 100).toFixed(3).replace(".", ",")} a cada 100 kWh`);
    msgs.push(
      `Bandeira tarifária no período: ${textoBandeiras(ciclo)}.${adicionais.length ? ` Adicional (sem tributos) ${adicionais.join("; ")}.` : ""}`,
    );
  }
  if (ctx.uc.subgrupo === "A4") {
    msgs.push("Horário de ponta: 18h às 21h, de segunda a sexta-feira (exceto feriados nacionais).");
    const reativo = itens.filter((i) => i.descricao.startsWith("Cons.Reat.Exc")).reduce((s, i) => s + i.valor, 0);
    if (reativo > 0) {
      msgs.push(
        `Fator de potência médio de ${mes.fatorPotencia.toFixed(2).replace(".", ",")}, abaixo do mínimo de ${FATOR_POTENCIA_REFERENCIA.toFixed(2).replace(".", ",")}. Foi cobrado excedente de energia reativa: verifique o banco de capacitores.`,
      );
    }
  }
  if (mes.competencia.slice(5, 7) === "05") {
    msgs.push(`Tarifas reajustadas a partir de ${DATA_REAJUSTE_TARIFARIO}/${mes.competencia.slice(0, 4)} (reajuste anual fictício).`);
  }
  if (mes.dic) {
    msgs.push(
      `Crédito de compensação por indisponibilidade do serviço (DIC) referente a ${mesAnoCurto(mes.dic.referencia)} incluído nesta fatura.`,
    );
  }
  msgs.push("Este documento é uma SIMULAÇÃO gerada pelo CondoGest para testes. Não é uma fatura real e não deve ser pago.");
  return msgs;
}

/* ------------------------------ montagem ------------------------------ */

interface OpcoesGeracao {
  /** Histórico comparativo livre × cativo de 12 meses na fatura da comercializadora (padrão: true) */
  historicoComparativo?: boolean;
}

function textoSemente(s: ParametrosFatura["semente"]) {
  return s === undefined || s === "" ? SEMENTE_PADRAO : String(s);
}

export function gerarFaturas(parametros: ParametrosFatura, opcoes: OpcoesGeracao = {}): FaturasGeradas {
  const ctx = contextoDaUc(parametros.uc);
  const semente = textoSemente(parametros.semente);
  const { mes, anteriores } = mesDaSerie(ctx, parametros.competencia, {
    consumoKwh: parametros.consumoKwh,
    dias: parametros.dias,
    demandaMedidaKw: ctx.uc.subgrupo === "A4" ? parametros.demandaMedidaKw : undefined,
    semente,
  });
  const a4 = ctx.uc.subgrupo === "A4";
  const livre = a4 && ctx.uc.ambiente === "livre";
  const tipo: FaturaDistribuidora["tipo"] = !a4 ? "b3_cativo" : livre ? "a4_verde_livre_distribuicao" : "a4_verde_cativo";
  const ciclo = bandeirasDoCiclo(mes.leituraAnterior, mes.leituraAtual, parametros.bandeira);

  const itens = tipo === "b3_cativo" ? itensB3(ctx, mes, ciclo) : livre ? itensA4LivreDistribuicao(ctx, mes) : itensA4Cativo(ctx, mes, ciclo, true);
  const { total, tributos } = totalizar(itens);

  const rng = criarPrng(`${semente}:emissao:${ctx.chave}:${mes.competencia}`);
  const emissao = somarDias(mes.leituraAtual, rng.inteiro(1, 3));
  const excedente = arred2(mes.excedentePontaKvarh + mes.excedenteForaPontaKvarh);

  const principal: FaturaDistribuidora = {
    tipo,
    tipoFatura: livre ? "distribuicao" : "completa",
    emissor: DISTRIBUIDORA,
    cliente: clienteDaFatura(ctx),
    uc: ucDaFatura(ctx),
    competencia: mes.competencia,
    numero: numeroFatura("EL", ctx, mes.competencia, semente),
    emissao,
    vencimento: vencimentoNoDia(mes.competencia, ctx.perfil.diaVencimento, emissao),
    total,
    leituraAnterior: mes.leituraAnterior,
    leituraAtual: mes.leituraAtual,
    proximaLeitura: somarDias(mes.leituraAtual, 30),
    dias: mes.dias,
    consumoKwh: mes.consumoKwh,
    ...(a4
      ? {
          consumoPontaKwh: mes.consumoPontaKwh,
          consumoForaPontaKwh: mes.consumoForaPontaKwh,
          demandaMedidaKw: mes.demandaKw,
          demandaMedidaPontaKw: mes.demandaPontaKw,
          reativoExcedenteKvarh: excedente,
          fatorPotencia: mes.fatorPotencia,
        }
      : {}),
    bandeira: bandeiraPredominante(ciclo),
    bandeirasNoCiclo: ciclo,
    itens,
    tributos,
    mensagens: mensagensDistribuidora(tipo, ctx, mes, ciclo, itens),
    semente,
    classificacao:
      tipo === "b3_cativo"
        ? "B3 COMERCIAL - OUTROS SERVIÇOS E OUTRAS ATIVIDADES"
        : livre
          ? "A4 Livre - Verde"
          : "A4 Verde - Comercial - Outros Serviços",
    tipoFornecimento: tipo === "b3_cativo" ? "Conv. Monômia - Trifásico" : "Horária Verde - Trifásico",
    medidor: medidorDaFatura(ctx, mes),
    historico: [...anteriores, mes].map((m) => historicoDoMes(m, a4)),
  };

  if (!livre) return { principal };

  // ---- Mercado livre: fatura da comercializadora + comparativo com o cativo
  const cativo = custoCativoEquivalente(ctx, mes);
  const preco = precoContratoLivreMwh(mes.competencia);
  principal.custoEquivalenteCativo = cativo;
  principal.precoEnergiaLivreMwh = preco;

  const energia = energiaLivre(mes);
  const itemEnergia: ItemDetalhado = {
    descricao: "Energia elétrica — mercado livre",
    unidade: "MWh",
    quantidade: energia.faturadoMwh,
    precoUnitario: energia.precoMwhComIcms,
    valor: energia.valor,
    baseIcms: energia.valor,
    aliquotaIcms: energia.aliquotaIcms,
    icms: energia.icms,
    tarifaSemTributos: energia.precoMwhSemIcms,
  };
  const emissaoEnergia = somarDias(mes.leituraAtual, 3);
  const comparativo = comparativoDoMes(mes.competencia, total, energia.valor, cativo);

  let historicoComparativo: ComparativoLivreCativo[] = [];
  if (opcoes.historicoComparativo !== false) {
    const anterioresPadrao = mesesPadrao(ctx, somarMeses(mes.competencia, -11), somarMeses(mes.competencia, -1));
    historicoComparativo = [
      ...anterioresPadrao.map((m) =>
        comparativoDoMes(
          m.competencia,
          totalizar(itensA4LivreDistribuicao(ctx, m)).total,
          energiaLivre(m).valor,
          custoCativoEquivalente(ctx, m),
        ),
      ),
      comparativo,
    ];
  }

  const hUc = hashString(`ponto:${ctx.chave}`);
  const comercializadora: FaturaComercializadora = {
    tipo: "comercializadora_livre",
    tipoFatura: "energia_livre",
    emissor: COMERCIALIZADORA,
    cliente: principal.cliente,
    uc: principal.uc,
    competencia: mes.competencia,
    numero: numeroFatura("AL", ctx, mes.competencia, semente),
    emissao: emissaoEnergia,
    vencimento: vencimentoNoDia(mes.competencia, ctx.perfil.diaVencimentoComercializadora ?? 18, emissaoEnergia),
    total: energia.valor,
    leituraAnterior: mes.leituraAnterior,
    leituraAtual: mes.leituraAtual,
    proximaLeitura: principal.proximaLeitura,
    dias: mes.dias,
    consumoKwh: mes.consumoKwh,
    consumoPontaKwh: mes.consumoPontaKwh,
    consumoForaPontaKwh: mes.consumoForaPontaKwh,
    demandaMedidaKw: mes.demandaKw,
    demandaMedidaPontaKw: mes.demandaPontaKw,
    reativoExcedenteKvarh: excedente,
    bandeira: principal.bandeira,
    bandeirasNoCiclo: ciclo,
    itens: [itemEnergia],
    tributos: [{ tributo: "ICMS", base: energia.valor, aliquota: energia.aliquotaIcms, valor: energia.icms }],
    mensagens: [
      "Quantidade faturada = energia medida pela distribuidora + perdas da rede básica - cota do PROINFA.",
      "Preço do contrato com PIS/COFINS inclusos; ICMS calculado por dentro.",
      `Relatório da página 2: comparação do custo no mercado livre com o custo estimado no mercado cativo para a mesma medição.`,
      "Este documento é uma SIMULAÇÃO gerada pelo CondoGest para testes. Não é uma fatura real e não deve ser pago.",
    ],
    semente,
    contrato: `Contrato bilateral SIM-${2024 + (hUc % 2)}/${String(100 + (hUc % 800)).padStart(4, "0")} · energia incentivada 50% (fictício)`,
    pontoMedicao: `PE-SIM-${String(hUc % 10_000).padStart(4, "0")}-01 (fictício)`,
    energia: {
      medidoMwh: energia.medidoMwh,
      perdasPercentual: energia.perdasPercentual,
      perdasMwh: energia.perdasMwh,
      proinfaPercentual: energia.proinfaPercentual,
      proinfaMwh: energia.proinfaMwh,
      faturadoMwh: energia.faturadoMwh,
      precoMwhSemIcms: energia.precoMwhSemIcms,
      precoMwhComIcms: energia.precoMwhComIcms,
      valorSemIcms: energia.valorSemIcms,
      icms: energia.icms,
      aliquotaIcms: energia.aliquotaIcms,
    },
    comparativo,
    historicoComparativo,
  };
  return { principal, comercializadora };
}

/** Lista de faturas (principal e, no livre, a da comercializadora) */
export const listarFaturas = (g: FaturasGeradas) => (g.comercializadora ? [g.principal, g.comercializadora] : [g.principal]);
