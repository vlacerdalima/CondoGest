/**
 * Energia — camada 1: organizar o dado.
 *
 * Transforma as contas (demo + enviadas pelo gestor) num modelo único por
 * unidade consumidora (UC) e competência, normalizado por dia:
 *  - UC no mercado livre tem DUAS faturas por mês ("distribuicao" + "energia_livre"):
 *    o custo é a soma das duas e o kWh é contado UMA vez (da distribuição);
 *  - UC cativa tem uma fatura "completa";
 *  - itens da fatura são classificados por descrição/unidade (demanda, ponta,
 *    fora ponta, bandeira, reativo, iluminação pública…) de forma genérica,
 *    para funcionar com contas detalhadas ou com itens mínimos.
 *
 * Funções puras e determinísticas (nada de Date.now/Math.random).
 */
import { obterUc, obterUcsDoCondominio, unidadesOcupadas } from "../dados/condominios";
import { diferencaEmDias, somarMeses } from "../dados/referencia";
import type {
  AmbienteContratacao,
  Bandeira,
  Competencia,
  Condominio,
  Conta,
  ItemFatura,
  TipoFaturaEnergia,
  UnidadeConsumidora,
} from "../tipos";

/** Dias de um "mês padrão" (365/12) — para converter kWh/dia em kWh/mês */
export const DIAS_MES_PADRAO = 30.4;

export interface Faixa {
  min: number;
  max: number;
}

/* ------------------------------------------------------------------ */
/* Utilitários numéricos                                               */
/* ------------------------------------------------------------------ */

export function media(valores: number[]) {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

export function soma(valores: number[]) {
  return valores.reduce((s, v) => s + v, 0);
}

export function desvioPadrao(valores: number[]) {
  if (valores.length < 2) return 0;
  const m = media(valores);
  return Math.sqrt(valores.reduce((s, v) => s + (v - m) ** 2, 0) / (valores.length - 1));
}

export const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Número finito ou undefined (protege contra campos vazios em contas enviadas) */
export function numero(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Arredonda para um "passo" (10, 50, 100…) — evita falsa precisão em estimativas */
export function arredondarPasso(v: number, passo = 10) {
  return Math.round(v / passo) * passo;
}

/** Passo de arredondamento adequado ao tamanho do número */
export function passoPara(v: number) {
  const a = Math.abs(v);
  if (a >= 20_000) return 500;
  if (a >= 5_000) return 100;
  if (a >= 1_000) return 50;
  if (a >= 100) return 10;
  return 1;
}

export function arredondarFaixa(f: Faixa, passo?: number): Faixa {
  const p = passo ?? passoPara(f.max);
  const min = Math.max(0, arredondarPasso(f.min, p));
  const max = Math.max(min, arredondarPasso(f.max, p));
  return { min, max };
}

/** Lista de competências entre a e b (inclusive), em ordem crescente */
export function competenciasEntre(a: Competencia, b: Competencia): Competencia[] {
  const lista: Competencia[] = [];
  let c = a;
  let guarda = 0;
  while (c <= b && guarda < 600) {
    lista.push(c);
    c = somarMeses(c, 1);
    guarda++;
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* Rótulos                                                             */
/* ------------------------------------------------------------------ */

export const ROTULOS_BANDEIRA: Record<Bandeira, string> = {
  verde: "Verde",
  amarela: "Amarela",
  vermelha_1: "Vermelha 1",
  vermelha_2: "Vermelha 2",
  escassez_hidrica: "Escassez hídrica",
};

/**
 * Adicional das bandeiras (R$/kWh, sem impostos — valores de referência da ANEEL).
 * Usado só para ESTIMAR o custo da bandeira quando a conta não traz o item.
 */
export const ADICIONAL_BANDEIRA_KWH: Record<Bandeira, number> = {
  verde: 0,
  amarela: 0.01885,
  vermelha_1: 0.04463,
  vermelha_2: 0.07877,
  escassez_hidrica: 0.142,
};

/** "Média tensão · mercado livre", "Baixa tensão"… */
export function descreverUc(uc: Pick<UnidadeConsumidora, "subgrupo" | "ambiente">) {
  const tensao = uc.subgrupo === "A4" ? "Média tensão" : "Baixa tensão";
  if (uc.subgrupo === "A4") return `${tensao} · ${uc.ambiente === "livre" ? "mercado livre" : "mercado cativo"}`;
  return uc.ambiente === "livre" ? `${tensao} · mercado livre` : tensao;
}

/* ------------------------------------------------------------------ */
/* Classificação dos itens da fatura                                   */
/* ------------------------------------------------------------------ */

export type ComponenteCusto =
  | "demanda"
  | "ultrapassagem"
  | "consumoPonta"
  | "consumoForaPonta"
  | "consumo"
  | "energiaLivre"
  | "bandeira"
  | "reativo"
  | "iluminacaoPublica"
  | "creditos"
  | "encargos"
  | "outros";

export const COMPONENTES: ComponenteCusto[] = [
  "demanda",
  "ultrapassagem",
  "consumoPonta",
  "consumoForaPonta",
  "consumo",
  "energiaLivre",
  "bandeira",
  "reativo",
  "iluminacaoPublica",
  "creditos",
  "encargos",
  "outros",
];

export const ROTULOS_COMPONENTE: Record<ComponenteCusto, string> = {
  demanda: "Demanda contratada",
  ultrapassagem: "Multa de ultrapassagem",
  consumoPonta: "Consumo na ponta",
  consumoForaPonta: "Consumo fora da ponta",
  consumo: "Consumo",
  energiaLivre: "Energia (comercializadora)",
  bandeira: "Bandeira tarifária",
  reativo: "Reativo excedente",
  iluminacaoPublica: "Iluminação pública",
  creditos: "Créditos e descontos",
  encargos: "Juros e multas",
  outros: "Outros",
};

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Classifica um item da fatura pela descrição e unidade (genérico — não depende do layout da conta) */
export function classificarItem(item: ItemFatura, tipo: TipoFaturaEnergia): ComponenteCusto {
  const d = semAcento(item.descricao ?? "");
  if (/ilum|\bcip\b|cosip|custeio/.test(d)) return "iluminacaoPublica";
  if (/bandeira|\bband\b/.test(d)) return "bandeira";
  if (/reativ|\breat\b|\breat\.|\bufer\b|\bdmcr\b/.test(d) || item.unidade === "kVArh" || item.unidade === "kVAr") return "reativo";
  if (/ultrap/.test(d)) return "ultrapassagem";
  if (/juros|multa|mora|atualizacao|correcao monet/.test(d)) return "encargos";
  if (item.valor < 0 || /credito|compensa|\bcomp\.|devoluc|desconto|abatimento/.test(d)) return "creditos";
  if (/demanda/.test(d) || item.unidade === "kW") return "demanda";
  if (tipo === "energia_livre" || item.unidade === "MWh") return "energiaLivre";
  const ehConsumo = item.unidade === "kWh" || /consumo|energia|tusd|\bte\b|uso do sistema|uso sist/.test(d);
  if (ehConsumo) {
    if (/fora\s*(de\s*)?ponta|\bf\.?\s?ponta|\bfp\b|\bf\.\s?p\b/.test(d)) return "consumoForaPonta";
    if (/ponta|\bnp\b|\bn\.\s?p\b/.test(d)) return "consumoPonta";
    return "consumo";
  }
  return "outros";
}

function componentesVazios(): Record<ComponenteCusto, number> {
  return Object.fromEntries(COMPONENTES.map((c) => [c, 0])) as Record<ComponenteCusto, number>;
}

/* ------------------------------------------------------------------ */
/* Contas de energia: filtro e deduplicação                            */
/* ------------------------------------------------------------------ */

function chaveFatura(c: Conta) {
  return `${c.energia!.ucId}|${c.competencia}|${c.energia!.tipoFatura ?? "completa"}`;
}

/** A conta enviada pelo gestor substitui a demo da mesma UC/competência/tipo; a mais recente vence */
function substitui(nova: Conta, atual: Conta) {
  if (nova.origem === "envio" && atual.origem === "demo") return true;
  if (nova.origem === "demo" && atual.origem === "envio") return false;
  if (nova.origem === "envio" && atual.origem === "envio") return (nova.enviadaEm ?? "") >= (atual.enviadaEm ?? "");
  return false;
}

/** Só contas de energia com detalhe (`energia.ucId`), sem duplicatas */
export function contasDeEnergia(contas: Conta[]): Conta[] {
  const mapa = new Map<string, Conta>();
  for (const c of contas) {
    if (c.categoria !== "energia" || !c.energia || !c.energia.ucId || !c.competencia) continue;
    const k = chaveFatura(c);
    const atual = mapa.get(k);
    if (!atual || substitui(c, atual)) mapa.set(k, c);
  }
  return [...mapa.values()];
}

/* ------------------------------------------------------------------ */
/* Unidades consumidoras                                               */
/* ------------------------------------------------------------------ */

/** UC cadastrada ou, para contas de UCs desconhecidas, uma UC inferida dos dados da conta */
function ucInferida(ucId: string, faturas: Conta[]): UnidadeConsumidora {
  const detalhes = faturas.map((f) => f.energia!);
  const temGrupoA = detalhes.some(
    (d) => numero(d.demandaContratadaKw) !== undefined || numero(d.consumoPontaKwh) !== undefined,
  );
  const livre = detalhes.some((d) => d.tipoFatura === "distribuicao" || d.tipoFatura === "energia_livre");
  return {
    id: ucId,
    condominioId: faturas[0].condominioId,
    apelido: `Unidade consumidora ${ucId}`,
    numeroUc: ucId,
    numeroMedidor: "—",
    distribuidora: faturas.find((f) => f.energia!.tipoFatura !== "energia_livre")?.fornecedor ?? "—",
    subgrupo: temGrupoA ? "A4" : "B3",
    modalidade: temGrupoA ? "verde" : "convencional",
    ambiente: livre ? "livre" : "cativo",
    comercializadora: faturas.find((f) => f.energia!.tipoFatura === "energia_livre")?.fornecedor,
    demandaContratadaKw: detalhes.map((d) => numero(d.demandaContratadaKw)).find((v) => v !== undefined),
    cargas: [],
  };
}

/* ------------------------------------------------------------------ */
/* Mês de uma UC                                                       */
/* ------------------------------------------------------------------ */

export interface MesEnergiaUc {
  ucId: string;
  condominioId: string;
  competencia: Competencia;
  ambiente: AmbienteContratacao;
  /** Dias do ciclo de leitura */
  dias: number;
  kwh: number;
  kwhDia: number;
  pontaKwh?: number;
  foraPontaKwh?: number;
  /** Custo total do mês (todas as faturas da UC) */
  custo: number;
  custoDistribuicao?: number;
  custoEnergiaLivre?: number;
  /** Só mercado livre: quanto custaria tudo no cativo */
  custoEquivalenteCativo?: number;
  /** Só mercado livre: custoEquivalenteCativo − (distribuição + energia) */
  economiaLivre?: number;
  precoEnergiaLivreMwh?: number;
  demandaContratadaKw?: number;
  demandaMedidaKw?: number;
  demandaMedidaPontaKw?: number;
  reativoKvarh?: number;
  bandeira: Bandeira;
  /** R$ pagos por causa da bandeira (item da conta, ou estimativa se a conta não detalha) */
  custoBandeira: number;
  custoBandeiraEstimado: boolean;
  /** R$ por componente da fatura (soma das faturas do mês) */
  componentes: Record<ComponenteCusto, number>;
  /** Todas as faturas esperadas estão presentes (livre = distribuição + comercializadora) */
  completo: boolean;
  faltando: TipoFaturaEnergia[];
  /** Alguma fatura deste mês foi enviada pelo gestor */
  temEnvio: boolean;
  /** Ids das contas que compõem o mês */
  contas: string[];
}

function montarMes(uc: UnidadeConsumidora, competencia: Competencia, faturas: Conta[]): MesEnergiaUc {
  const porTipo = new Map<TipoFaturaEnergia, Conta>();
  for (const f of faturas) porTipo.set(f.energia!.tipoFatura ?? "completa", f);

  const livre =
    uc.ambiente === "livre" || porTipo.has("distribuicao") || porTipo.has("energia_livre");
  const ambiente: AmbienteContratacao = livre ? "livre" : "cativo";
  // kWh contado UMA vez: completa → distribuição → comercializadora
  const principal = porTipo.get("completa") ?? porTipo.get("distribuicao") ?? porTipo.get("energia_livre")!;
  const det = principal.energia!;

  const diasInformados = numero(det.dias);
  const diasLeitura =
    det.leituraAnterior && det.leituraAtual ? diferencaEmDias(det.leituraAnterior, det.leituraAtual) : 0;
  const dias = diasInformados && diasInformados > 0 ? diasInformados : diasLeitura > 0 ? diasLeitura : 30;
  const kwh = Math.max(0, numero(det.consumoKwh) ?? 0);

  // Demanda/ponta/reativo: da fatura que tiver (distribuição ou completa)
  const detalhes = [porTipo.get("completa"), porTipo.get("distribuicao"), porTipo.get("energia_livre")]
    .filter((f): f is Conta => Boolean(f))
    .map((f) => f.energia!);
  const primeiro = (campo: "consumoPontaKwh" | "consumoForaPontaKwh" | "demandaContratadaKw" | "demandaMedidaKw" | "demandaMedidaPontaKw" | "reativoExcedenteKvarh" | "custoEquivalenteCativo" | "precoEnergiaLivreMwh") =>
    detalhes.map((d) => numero(d[campo])).find((v) => v !== undefined);

  const componentes = componentesVazios();
  for (const f of faturas) {
    const itens = f.energia!.itens ?? [];
    const tipo = f.energia!.tipoFatura ?? "completa";
    let somaItens = 0;
    for (const item of itens) {
      const valor = numero(item.valor) ?? 0;
      somaItens += valor;
      componentes[classificarItem(item, tipo)] += valor;
    }
    // Conta com itens mínimos: a diferença entre o valor e os itens vira "consumo"/"energia"
    const resto = (numero(f.valor) ?? 0) - somaItens;
    if (Math.abs(resto) > 0.5) componentes[tipo === "energia_livre" ? "energiaLivre" : itens.length ? "outros" : "consumo"] += resto;
  }

  const custo = soma(faturas.map((f) => numero(f.valor) ?? 0));
  const custoDistribuicao = porTipo.get("distribuicao") ? numero(porTipo.get("distribuicao")!.valor) : undefined;
  const custoEnergiaLivre = porTipo.get("energia_livre") ? numero(porTipo.get("energia_livre")!.valor) : undefined;
  const custoEquivalenteCativo = livre ? primeiro("custoEquivalenteCativo") : undefined;
  const faltando: TipoFaturaEnergia[] = livre
    ? (["distribuicao", "energia_livre"] as const).filter((t) => !porTipo.has(t))
    : [];
  const completo = faltando.length === 0;
  const economiaLivre =
    livre && completo && custoEquivalenteCativo !== undefined ? custoEquivalenteCativo - custo : undefined;

  const bandeira = (det.bandeira ?? detalhes.find((d) => d.bandeira)?.bandeira ?? "verde") as Bandeira;
  let custoBandeira = componentes.bandeira;
  let custoBandeiraEstimado = false;
  // No mercado livre a bandeira não é cobrada sobre a energia
  if (custoBandeira === 0 && !livre && bandeira !== "verde") {
    custoBandeira = kwh * (ADICIONAL_BANDEIRA_KWH[bandeira] ?? 0);
    custoBandeiraEstimado = custoBandeira > 0;
  }

  return {
    ucId: uc.id,
    condominioId: uc.condominioId,
    competencia,
    ambiente,
    dias,
    kwh,
    kwhDia: dias > 0 ? kwh / dias : 0,
    pontaKwh: primeiro("consumoPontaKwh"),
    foraPontaKwh: primeiro("consumoForaPontaKwh"),
    custo,
    custoDistribuicao,
    custoEnergiaLivre,
    custoEquivalenteCativo,
    economiaLivre,
    precoEnergiaLivreMwh: primeiro("precoEnergiaLivreMwh"),
    demandaContratadaKw: primeiro("demandaContratadaKw") ?? (uc.subgrupo === "A4" ? uc.demandaContratadaKw : undefined),
    demandaMedidaKw: primeiro("demandaMedidaKw"),
    demandaMedidaPontaKw: primeiro("demandaMedidaPontaKw"),
    reativoKvarh: primeiro("reativoExcedenteKvarh"),
    bandeira,
    custoBandeira,
    custoBandeiraEstimado,
    componentes,
    completo,
    faltando,
    temEnvio: faturas.some((f) => f.origem === "envio"),
    contas: faturas.map((f) => f.id),
  };
}

export interface DadosEnergiaUc {
  uc: UnidadeConsumidora;
  /** Meses em ordem crescente */
  meses: MesEnergiaUc[];
}

/**
 * Agrupa as contas de energia de um condomínio por UC e competência.
 * Inclui UCs cadastradas sem conta (meses = []) e UCs só vistas em contas enviadas.
 */
export function dadosPorUc(condominio: Condominio, contas: Conta[]): DadosEnergiaUc[] {
  const energia = contasDeEnergia(contas).filter((c) => c.condominioId === condominio.id);
  const grupos = new Map<string, Map<Competencia, Conta[]>>();
  for (const c of energia) {
    const ucId = c.energia!.ucId;
    if (!grupos.has(ucId)) grupos.set(ucId, new Map());
    const porComp = grupos.get(ucId)!;
    if (!porComp.has(c.competencia)) porComp.set(c.competencia, []);
    porComp.get(c.competencia)!.push(c);
  }

  const cadastradas = obterUcsDoCondominio(condominio.id);
  const ids = [...cadastradas.map((u) => u.id), ...[...grupos.keys()].filter((id) => !cadastradas.some((u) => u.id === id))];

  return ids.map((ucId) => {
    const porComp = grupos.get(ucId) ?? new Map<Competencia, Conta[]>();
    const todas = [...porComp.values()].flat();
    const cadastrada = obterUc(ucId);
    const uc = cadastrada ?? ucInferida(ucId, todas);
    const meses = [...porComp.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([competencia, faturas]) => montarMes(uc, competencia, faturas));
    return { uc, meses };
  });
}

/* ------------------------------------------------------------------ */
/* Série mensal (condomínio inteiro ou uma seleção de UCs)             */
/* ------------------------------------------------------------------ */

export interface PontoSerie {
  competencia: Competencia;
  kwh: number;
  /** Soma do kWh/dia de cada UC (cada uma normalizada pelos seus dias) */
  kwhDia: number;
  custo: number;
  /** R$/kWh médio (custo total ÷ kWh) */
  reaisPorKwh: number;
  /** R$/kWh sem a bandeira — para comparar meses com bandeiras diferentes */
  reaisPorKwhSemBandeira: number;
  dias: number;
  ocupadas: number;
  kwhDiaPorUnidade: number;
  custoPorUnidade: number;
  pontaKwh?: number;
  foraPontaKwh?: number;
  pontaKwhDia?: number;
  custoEquivalenteCativo?: number;
  economiaLivre?: number;
  custoBandeira: number;
  bandeira: Bandeira;
  custoDemanda: number;
  custoReativo: number;
  demandaContratadaKw?: number;
  demandaMedidaKw?: number;
  componentes: Record<ComponenteCusto, number>;
  /** Todas as UCs ativas têm todas as faturas do mês */
  completo: boolean;
  /** Todas as UCs ativas têm o consumo do mês (kWh/dia comparável, mesmo sem todas as faturas) */
  kwhCompleto: boolean;
  ucsPresentes: string[];
  porUc: Record<string, { kwh: number; kwhDia: number; custo: number }>;
  temEnvio: boolean;
}

/**
 * Série mensal agregada. Uma competência é "completa" quando todas as UCs que
 * estavam ativas (com conta neste mês ou nos 3 anteriores) têm todas as faturas.
 */
export function montarSerie(condominio: Condominio, dados: DadosEnergiaUc[]): PontoSerie[] {
  const porUc = new Map(dados.map((d) => [d.uc.id, new Map(d.meses.map((m) => [m.competencia, m]))]));
  const competencias = [...new Set(dados.flatMap((d) => d.meses.map((m) => m.competencia)))].sort();

  return competencias.map((competencia) => {
    const registros = dados
      .map((d) => porUc.get(d.uc.id)!.get(competencia))
      .filter((m): m is MesEnergiaUc => Boolean(m));
    const janela = [1, 2, 3].map((i) => somarMeses(competencia, -i));
    const ativas = dados.filter((d) => {
      const mapa = porUc.get(d.uc.id)!;
      return mapa.has(competencia) || janela.some((c) => mapa.has(c));
    });
    const completo = ativas.every((d) => porUc.get(d.uc.id)!.get(competencia)?.completo);
    const kwhCompleto = ativas.every((d) => (porUc.get(d.uc.id)!.get(competencia)?.kwh ?? 0) > 0);

    const kwh = soma(registros.map((m) => m.kwh));
    const kwhDia = soma(registros.map((m) => m.kwhDia));
    const custo = soma(registros.map((m) => m.custo));
    const custoBandeira = soma(registros.map((m) => m.custoBandeira));
    const ocupadas = unidadesOcupadas(condominio, competencia);
    const comPonta = registros.filter((m) => m.pontaKwh !== undefined);
    const pontaKwh = comPonta.length ? soma(comPonta.map((m) => m.pontaKwh!)) : undefined;
    const foraPontaKwh = comPonta.length ? soma(comPonta.map((m) => m.foraPontaKwh ?? m.kwh - m.pontaKwh!)) : undefined;
    const comLivre = registros.filter((m) => m.economiaLivre !== undefined);
    const comDemanda = registros.filter((m) => m.demandaContratadaKw !== undefined);
    const componentes = componentesVazios();
    for (const m of registros) for (const c of COMPONENTES) componentes[c] += m.componentes[c];
    const cativa = registros.find((m) => m.ambiente === "cativo");

    return {
      competencia,
      kwh,
      kwhDia,
      custo,
      reaisPorKwh: kwh > 0 ? custo / kwh : 0,
      reaisPorKwhSemBandeira: kwh > 0 ? (custo - custoBandeira) / kwh : 0,
      dias: registros.length ? Math.round(media(registros.map((m) => m.dias))) : 0,
      ocupadas,
      kwhDiaPorUnidade: ocupadas > 0 ? kwhDia / ocupadas : 0,
      custoPorUnidade: ocupadas > 0 ? custo / ocupadas : 0,
      pontaKwh,
      foraPontaKwh,
      pontaKwhDia: comPonta.length ? soma(comPonta.map((m) => m.pontaKwh! / m.dias)) : undefined,
      custoEquivalenteCativo: comLivre.length ? soma(comLivre.map((m) => m.custoEquivalenteCativo!)) : undefined,
      economiaLivre: comLivre.length ? soma(comLivre.map((m) => m.economiaLivre!)) : undefined,
      custoBandeira,
      bandeira: (cativa ?? registros[0]).bandeira,
      custoDemanda: componentes.demanda + componentes.ultrapassagem,
      custoReativo: componentes.reativo,
      demandaContratadaKw: comDemanda.length ? soma(comDemanda.map((m) => m.demandaContratadaKw!)) : undefined,
      demandaMedidaKw: comDemanda.some((m) => m.demandaMedidaKw !== undefined)
        ? soma(comDemanda.map((m) => m.demandaMedidaKw ?? 0))
        : undefined,
      componentes,
      completo,
      kwhCompleto,
      ucsPresentes: registros.map((m) => m.ucId),
      porUc: Object.fromEntries(registros.map((m) => [m.ucId, { kwh: m.kwh, kwhDia: m.kwhDia, custo: m.custo }])),
      temEnvio: registros.some((m) => m.temEnvio),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Tarifas efetivas de uma UC (a partir das próprias contas)           */
/* ------------------------------------------------------------------ */

export type FonteValor = "conta" | "estimada";

export interface TarifasUc {
  /** Custo total ÷ kWh */
  reaisPorKwhMedio: number;
  /** Só a parte que muda com o kWh (consumo + energia + bandeira) ÷ kWh */
  reaisPorKwhVariavel: number;
  fonteVariavel: FonteValor;
  /** R$/kWh no horário de ponta e fora dele (inclui a energia da comercializadora no livre) */
  ponta?: number;
  foraPonta?: number;
  fontePonta?: FonteValor;
  /** R$ por kW de demanda */
  demanda?: number;
  fonteDemanda?: FonteValor;
  /** R$ por kvarh de reativo excedente */
  reativo?: number;
  fonteReativo?: FonteValor;
}

/** Valores típicos usados SÓ quando a conta não detalha os itens (premissa explícita na UI) */
export const TARIFAS_PADRAO = {
  /** Razão ponta/fora ponta do R$/kWh: cativo A4 verde ≈ 4×; livre (só a TUSD muda) ≈ 2,5× */
  razaoPontaCativo: 4,
  razaoPontaLivre: 2.5,
  demandaKw: 20,
  reativoKvarh: 0.3,
  /** Parte variável quando a conta só traz o total */
  parcelaVariavel: 0.85,
};

export function calcularTarifas(uc: UnidadeConsumidora, meses: MesEnergiaUc[]): TarifasUc {
  const kwh = soma(meses.map((m) => m.kwh));
  const custo = soma(meses.map((m) => m.custo));
  const comp = componentesVazios();
  for (const m of meses) for (const c of COMPONENTES) comp[c] += m.componentes[c];
  const livre = uc.ambiente === "livre" || meses.some((m) => m.ambiente === "livre");

  const reaisPorKwhMedio = kwh > 0 ? custo / kwh : 0;
  const variavelItens = comp.consumo + comp.consumoPonta + comp.consumoForaPonta + comp.energiaLivre + comp.bandeira;
  const temVariavel = variavelItens > 0 && kwh > 0;
  const reaisPorKwhVariavel = temVariavel ? variavelItens / kwh : reaisPorKwhMedio * TARIFAS_PADRAO.parcelaVariavel;

  const tarifas: TarifasUc = {
    reaisPorKwhMedio,
    reaisPorKwhVariavel,
    fonteVariavel: temVariavel ? "conta" : "estimada",
  };

  // Ponta × fora ponta
  const comPonta = meses.filter((m) => m.pontaKwh !== undefined && m.pontaKwh > 0);
  if (comPonta.length) {
    const kwhPonta = soma(comPonta.map((m) => m.pontaKwh!));
    const kwhFora = soma(comPonta.map((m) => m.foraPontaKwh ?? m.kwh - m.pontaKwh!));
    const rPonta = soma(comPonta.map((m) => m.componentes.consumoPonta));
    const rFora = soma(comPonta.map((m) => m.componentes.consumoForaPonta));
    // energia da comercializadora (livre) tem preço único: soma o mesmo R$/kWh nos dois horários
    const kwhComPonta = soma(comPonta.map((m) => m.kwh));
    const energiaPorKwh = kwhComPonta > 0 ? soma(comPonta.map((m) => m.componentes.energiaLivre)) / kwhComPonta : 0;
    if (rPonta > 0 && rFora > 0 && kwhPonta > 0 && kwhFora > 0) {
      tarifas.ponta = rPonta / kwhPonta + energiaPorKwh;
      tarifas.foraPonta = rFora / kwhFora + energiaPorKwh;
      tarifas.fontePonta = "conta";
    } else {
      const p = kwhPonta / Math.max(1, kwhPonta + kwhFora);
      const r = livre ? TARIFAS_PADRAO.razaoPontaLivre : TARIFAS_PADRAO.razaoPontaCativo;
      const fp = reaisPorKwhVariavel / (p * r + 1 - p);
      tarifas.ponta = fp * r;
      tarifas.foraPonta = fp;
      tarifas.fontePonta = "estimada";
    }
  }

  // Demanda (R$/kW): itens de demanda com quantidade; senão valor ÷ demanda faturada
  if (uc.subgrupo === "A4" || meses.some((m) => m.demandaContratadaKw !== undefined)) {
    const precos: number[] = [];
    for (const m of meses) {
      const kw = Math.max(m.demandaContratadaKw ?? 0, m.demandaMedidaKw ?? 0);
      if (m.componentes.demanda > 0 && kw > 0) precos.push(m.componentes.demanda / kw);
    }
    tarifas.demanda = precos.length ? media(precos) : TARIFAS_PADRAO.demandaKw;
    tarifas.fonteDemanda = precos.length ? "conta" : "estimada";
  }

  // Reativo (R$/kvarh)
  const comReativo = meses.filter((m) => (m.reativoKvarh ?? 0) > 0);
  if (comReativo.length) {
    const kvarh = soma(comReativo.map((m) => m.reativoKvarh!));
    const r = soma(comReativo.map((m) => m.componentes.reativo));
    tarifas.reativo = r > 0 && kvarh > 0 ? r / kvarh : TARIFAS_PADRAO.reativoKvarh;
    tarifas.fonteReativo = r > 0 ? "conta" : "estimada";
  }

  return tarifas;
}

/* ------------------------------------------------------------------ */
/* Mercado livre e bandeiras                                           */
/* ------------------------------------------------------------------ */

export interface MesMercadoLivre {
  competencia: Competencia;
  custoReal: number;
  custoCativo: number;
  economia: number;
  economiaAcumulada: number;
}

export interface ResumoMercadoLivre {
  meses: MesMercadoLivre[];
  /** Últimos 12 meses (ou menos, se não houver) */
  economia12m: number;
  custoCativo12m: number;
  percentual12m: number;
  meses12m: number;
  economiaTotal: number;
  inicio?: Competencia;
  precoMwh?: number;
}

export function resumirMercadoLivre(meses: MesEnergiaUc[], ate?: Competencia): ResumoMercadoLivre | undefined {
  const validos = meses.filter((m) => m.economiaLivre !== undefined && (!ate || m.competencia <= ate));
  if (!validos.length) return undefined;
  let acumulada = 0;
  const lista = validos.map((m) => {
    acumulada += m.economiaLivre!;
    return {
      competencia: m.competencia,
      custoReal: m.custo,
      custoCativo: m.custoEquivalenteCativo!,
      economia: m.economiaLivre!,
      economiaAcumulada: acumulada,
    };
  });
  const ultimos = lista.slice(-12);
  const economia12m = soma(ultimos.map((m) => m.economia));
  const custoCativo12m = soma(ultimos.map((m) => m.custoCativo));
  return {
    meses: lista,
    economia12m,
    custoCativo12m,
    percentual12m: custoCativo12m > 0 ? economia12m / custoCativo12m : 0,
    meses12m: ultimos.length,
    economiaTotal: acumulada,
    inicio: lista[0].competencia,
    precoMwh: [...validos].reverse().find((m) => m.precoEnergiaLivreMwh !== undefined)?.precoEnergiaLivreMwh,
  };
}

export interface MesBandeira {
  competencia: Competencia;
  bandeira: Bandeira;
  custo: number;
  estimado: boolean;
}

export interface ResumoBandeiras {
  meses: MesBandeira[];
  total: number;
  /** Parcela do gasto com energia (mesmo período) */
  percentualDoGasto: number;
  contagem: Partial<Record<Bandeira, number>>;
  /** Existe UC cativa (que paga bandeira) */
  temCativo: boolean;
  temLivre: boolean;
}

/** Impacto das bandeiras num conjunto de competências (normalmente os últimos 12 meses) */
export function resumirBandeiras(dados: DadosEnergiaUc[], competencias: Competencia[]): ResumoBandeiras {
  const mesesBandeira: MesBandeira[] = [];
  let gasto = 0;
  const contagem: Partial<Record<Bandeira, number>> = {};
  for (const competencia of competencias) {
    const registros = dados.flatMap((d) => d.meses.filter((m) => m.competencia === competencia));
    if (!registros.length) continue;
    gasto += soma(registros.map((m) => m.custo));
    const cativa = registros.find((m) => m.ambiente === "cativo") ?? registros[0];
    const custo = soma(registros.map((m) => m.custoBandeira));
    mesesBandeira.push({
      competencia,
      bandeira: cativa.bandeira,
      custo,
      estimado: registros.some((m) => m.custoBandeiraEstimado),
    });
    contagem[cativa.bandeira] = (contagem[cativa.bandeira] ?? 0) + 1;
  }
  const total = soma(mesesBandeira.map((m) => m.custo));
  return {
    meses: mesesBandeira,
    total,
    percentualDoGasto: gasto > 0 ? total / gasto : 0,
    contagem,
    temCativo: dados.some((d) => d.meses.some((m) => m.ambiente === "cativo")),
    temLivre: dados.some((d) => d.meses.some((m) => m.ambiente === "livre")),
  };
}
