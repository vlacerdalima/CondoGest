/**
 * Contas de energia da demonstração.
 *
 * DONO: agente "Gerador" — este arquivo é um STUB provisório da fundação.
 * O gerador de contas fictícias (src/lib/gerador) deve substituir a
 * implementação mantendo a assinatura `gerarContasEnergiaDemo(): Conta[]`.
 *
 * Regras que a implementação final precisa manter:
 *  - determinística (PRNG com semente fixa; nada de Math.random/Date.now);
 *  - uma conta por UC por competência em COMPETENCIAS_DEMO, exceto UCs no
 *    mercado livre, que têm DUAS contas por competência: "distribuicao"
 *    (distribuidora, TUSD) e "energia_livre" (comercializadora);
 *  - categoria "energia", origem "demo", campo `energia` preenchido;
 *  - `valor` = soma dos itens da fatura;
 *  - pagas até a DATA_REFERENCIA (com pagaEm), em aberto depois.
 */
import { centavos, criarPrng } from "../prng";
import type { Bandeira, Competencia, Conta, DetalheEnergia, UnidadeConsumidora } from "../tipos";
import { CONDOMINIOS, UNIDADES_CONSUMIDORAS, unidadesOcupadas } from "./condominios";
import { COMPETENCIAS_DEMO, DATA_REFERENCIA, somarDias } from "./referencia";

/** Consumo médio mensal (kWh) por UC — perfil da demonstração */
const CONSUMO_BASE: Record<string, number> = {
  "uc-rp-mt": 18_500,
  "uc-rp-bt": 7_400,
  "uc-mc-mt": 21_000,
  "uc-jbv-bt": 9_300,
  "uc-va-bt": 3_100,
  "uc-as-bt": 5_200,
};

/** Bandeira tarifária por mês (fictícia, mas com padrão plausível: secas no 2º semestre) */
function bandeiraDoMes(c: Competencia): Bandeira {
  const mes = Number(c.slice(5, 7));
  if (mes >= 8 && mes <= 10) return c.startsWith("2026") ? "vermelha_1" : "amarela";
  if (mes === 7 || mes === 11) return "amarela";
  return "verde";
}

const ADICIONAL_BANDEIRA: Record<Bandeira, number> = {
  verde: 0,
  amarela: 0.01885,
  vermelha_1: 0.04463,
  vermelha_2: 0.07877,
  escassez_hidrica: 0.142,
};

/** Sazonalidade de Recife: mais calor (bombas, piscina, ar) de out a mar */
function fatorSazonal(c: Competencia) {
  const mes = Number(c.slice(5, 7));
  return 1 + 0.07 * Math.cos(((mes - 1) / 12) * 2 * Math.PI);
}

function datasDoCiclo(c: Competencia, dias: number, diaLeitura: number) {
  const leituraAtual = `${c}-${String(diaLeitura).padStart(2, "0")}`;
  return { leituraAtual, leituraAnterior: somarDias(leituraAtual, -dias) };
}

function pagamento(vencimento: string, rng: ReturnType<typeof criarPrng>) {
  return vencimento < DATA_REFERENCIA ? somarDias(vencimento, -rng.inteiro(0, 4)) : undefined;
}

function contasDaUc(uc: UnidadeConsumidora): Conta[] {
  const rng = criarPrng(`energia:${uc.id}`);
  const condominio = CONDOMINIOS.find((c) => c.id === uc.condominioId)!;
  const ocupacaoInicial = unidadesOcupadas(condominio, COMPETENCIAS_DEMO[0]);
  const contas: Conta[] = [];

  for (const competencia of COMPETENCIAS_DEMO) {
    const dias = rng.inteiro(28, 33);
    const ocupacao = unidadesOcupadas(condominio, competencia) / ocupacaoInicial;
    const fatorOcupacao = condominio.tipo === "horizontal" ? 1 + (ocupacao - 1) * 0.6 : 1;
    const consumoKwh = Math.round(
      CONSUMO_BASE[uc.id] * (dias / 30) * fatorSazonal(competencia) * fatorOcupacao * (1 + 0.035 * rng.normal()),
    );
    const bandeira = bandeiraDoMes(competencia);
    const { leituraAtual, leituraAnterior } = datasDoCiclo(competencia, dias, rng.inteiro(3, 7));
    const base = {
      ucId: uc.id,
      leituraAnterior,
      leituraAtual,
      dias,
      consumoKwh,
      bandeira,
    } satisfies Partial<DetalheEnergia>;

    if (uc.subgrupo === "B3") {
      const tusd = centavos(consumoKwh * 0.7205);
      const te = centavos(consumoKwh * 0.3549);
      const band = centavos(consumoKwh * ADICIONAL_BANDEIRA[bandeira]);
      const ilum = 288.72;
      const itens = [
        { descricao: "Consumo-TUSD", unidade: "kWh" as const, quantidade: consumoKwh, precoUnitario: 0.7205, valor: tusd },
        { descricao: "Consumo-TE", unidade: "kWh" as const, quantidade: consumoKwh, precoUnitario: 0.3549, valor: te },
        ...(band > 0 ? [{ descricao: "Acréscimo bandeira", valor: band }] : []),
        { descricao: "Ilum. Púb. Municipal", valor: ilum },
      ];
      const valor = centavos(itens.reduce((s, i) => s + i.valor, 0));
      const vencimento = somarDias(leituraAtual, 15);
      contas.push({
        id: `en-${uc.id}-${competencia}`,
        condominioId: uc.condominioId,
        categoria: "energia",
        fornecedor: uc.distribuidora,
        descricao: `Energia — ${uc.apelido}`,
        competencia,
        emissao: somarDias(leituraAtual, 2),
        vencimento,
        valor,
        pagaEm: pagamento(vencimento, rng),
        origem: "demo",
        energia: {
          ...base,
          tipoFatura: "completa",
          itens,
          tributos: { pis: centavos(valor * 0.0117), cofins: centavos(valor * 0.0539), icms: centavos(valor * 0.205) },
        },
      });
      continue;
    }

    // Grupo A (A4 verde): ponta ≈ 10% do consumo
    const consumoPontaKwh = Math.round(consumoKwh * rng.entre(0.08, 0.11));
    const consumoForaPontaKwh = consumoKwh - consumoPontaKwh;
    const demandaContratadaKw = uc.demandaContratadaKw!;
    const demandaMedidaKw = Math.round(demandaContratadaKw * rng.entre(0.42, 0.62));
    const demandaValor = centavos(demandaContratadaKw * 13.14);
    const vencimento = somarDias(leituraAtual, 20);
    const energiaBase = {
      ...base,
      consumoPontaKwh,
      consumoForaPontaKwh,
      demandaContratadaKw,
      demandaMedidaKw,
      demandaMedidaPontaKw: Math.round(demandaMedidaKw * 0.75),
    };

    if (uc.ambiente === "livre") {
      const itensDistribuicao = [
        { descricao: "Demanda (uso do sistema)", unidade: "kW" as const, quantidade: demandaContratadaKw, precoUnitario: 13.14, valor: demandaValor },
        { descricao: "Encargo uso do sistema — ponta", unidade: "kWh" as const, quantidade: consumoPontaKwh, precoUnitario: 0.8428, valor: centavos(consumoPontaKwh * 0.8428) },
        { descricao: "Encargo uso do sistema — fora ponta", unidade: "kWh" as const, quantidade: consumoForaPontaKwh, precoUnitario: 0.1664, valor: centavos(consumoForaPontaKwh * 0.1664) },
        { descricao: "Ilum. Púb. Municipal", valor: 288.72 },
      ];
      const valorDistribuicao = centavos(itensDistribuicao.reduce((s, i) => s + i.valor, 0));
      const preco = 232.5;
      const energiaSemIcms = centavos((consumoKwh / 1000) * preco);
      const valorEnergia = centavos(energiaSemIcms / (1 - 0.205));
      const custoEquivalenteCativo = centavos((valorDistribuicao + valorEnergia) * rng.entre(1.28, 1.36));
      contas.push({
        id: `en-${uc.id}-${competencia}-dist`,
        condominioId: uc.condominioId,
        categoria: "energia",
        fornecedor: uc.distribuidora,
        descricao: `Energia (distribuição) — ${uc.apelido}`,
        competencia,
        emissao: somarDias(leituraAtual, 2),
        vencimento,
        valor: valorDistribuicao,
        pagaEm: pagamento(vencimento, rng),
        origem: "demo",
        energia: {
          ...energiaBase,
          tipoFatura: "distribuicao",
          itens: itensDistribuicao,
          tributos: {
            pis: centavos(valorDistribuicao * 0.0117),
            cofins: centavos(valorDistribuicao * 0.0539),
            icms: centavos(valorDistribuicao * 0.205),
          },
          custoEquivalenteCativo,
        },
      });
      const vencimentoEnergia = somarDias(leituraAtual, 12);
      contas.push({
        id: `en-${uc.id}-${competencia}-livre`,
        condominioId: uc.condominioId,
        categoria: "energia",
        fornecedor: uc.comercializadora!,
        descricao: `Energia (mercado livre) — ${uc.apelido}`,
        competencia,
        emissao: somarDias(leituraAtual, 1),
        vencimento: vencimentoEnergia,
        valor: valorEnergia,
        pagaEm: pagamento(vencimentoEnergia, rng),
        origem: "demo",
        energia: {
          ...energiaBase,
          tipoFatura: "energia_livre",
          itens: [{ descricao: "Energia elétrica", unidade: "MWh", quantidade: consumoKwh / 1000, precoUnitario: preco, valor: valorEnergia }],
          tributos: { pis: 0, cofins: 0, icms: centavos(valorEnergia - energiaSemIcms) },
          precoEnergiaLivreMwh: preco,
        },
      });
      continue;
    }

    // A4 verde cativo: fatura completa
    const itens = [
      { descricao: "Demanda", unidade: "kW" as const, quantidade: demandaContratadaKw, precoUnitario: 13.14, valor: demandaValor },
      { descricao: "Consumo ponta", unidade: "kWh" as const, quantidade: consumoPontaKwh, precoUnitario: 2.32, valor: centavos(consumoPontaKwh * 2.32) },
      { descricao: "Consumo fora ponta", unidade: "kWh" as const, quantidade: consumoForaPontaKwh, precoUnitario: 0.5251, valor: centavos(consumoForaPontaKwh * 0.5251) },
      ...(ADICIONAL_BANDEIRA[bandeira] > 0
        ? [{ descricao: "Acréscimo bandeira", valor: centavos(consumoKwh * ADICIONAL_BANDEIRA[bandeira]) }]
        : []),
      { descricao: "Ilum. Púb. Municipal", valor: 288.72 },
    ];
    const valor = centavos(itens.reduce((s, i) => s + i.valor, 0));
    contas.push({
      id: `en-${uc.id}-${competencia}`,
      condominioId: uc.condominioId,
      categoria: "energia",
      fornecedor: uc.distribuidora,
      descricao: `Energia — ${uc.apelido}`,
      competencia,
      emissao: somarDias(leituraAtual, 2),
      vencimento,
      valor,
      pagaEm: pagamento(vencimento, rng),
      origem: "demo",
      energia: {
        ...energiaBase,
        tipoFatura: "completa",
        itens,
        tributos: { pis: centavos(valor * 0.0117), cofins: centavos(valor * 0.0539), icms: centavos(valor * 0.205) },
      },
    });
  }
  return contas;
}

export function gerarContasEnergiaDemo(): Conta[] {
  return UNIDADES_CONSUMIDORAS.flatMap(contasDaUc);
}
