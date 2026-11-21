/**
 * Tipos do gerador de contas fictícias.
 *
 * A "fatura rica" (FaturaFicticia) tem tudo o que o PDF precisa — cabeçalho,
 * leituras, medidor, itens com todas as colunas, tributos, histórico — e é
 * convertida para o contrato `Conta` (src/lib/tipos.ts) por `faturaParaConta`.
 */
import type {
  AmbienteContratacao,
  Bandeira,
  Competencia,
  Conta,
  DataISO,
  DetalheEnergia,
  Id,
  ItemFatura,
  ModalidadeTarifaria,
  Subgrupo,
  TipoFaturaEnergia,
} from "../tipos";

/** Conta de energia pronta para entrar na plataforma (sem id/origem/enviadaEm) */
export type NovaContaEnergia = Omit<Conta, "id" | "origem" | "enviadaEm"> & { energia: DetalheEnergia };

/** Unidade consumidora fora da carteira de demonstração */
export interface UcAvulsa {
  /** Número fictício da UC */
  numeroUc: string;
  nomeCliente?: string;
  subgrupo: Subgrupo;
  ambiente: AmbienteContratacao;
  /** Só grupo A (A4) */
  demandaContratadaKw?: number;
  /** Consumo médio mensal (kWh) usado no modo automático */
  consumoMedioKwh?: number;
}

export interface ParametrosFatura {
  /** Id de uma UC da carteira (UNIDADES_CONSUMIDORAS) ou uma UC avulsa */
  uc: Id | UcAvulsa;
  competencia: Competencia;
  /** Consumo alvo do ciclo (kWh). Ausente = automático pelo perfil da UC */
  consumoKwh?: number;
  /** Dias do ciclo (28–33). Ausente = calendário de leituras da UC */
  dias?: number;
  /** Bandeira aplicada ao ciclo inteiro. Ausente = calendário de bandeiras */
  bandeira?: Bandeira;
  /** Demanda medida (kW), só A4. Ausente = automática */
  demandaMedidaKw?: number;
  /** Semente da variação. Ausente (ou "demo") = mesma série da demonstração */
  semente?: string | number;
}

export type TipoFaturaFicticia =
  | "b3_cativo"
  | "a4_verde_cativo"
  | "a4_verde_livre_distribuicao"
  | "comercializadora_livre";

export interface Empresa {
  nome: string;
  nomeCurto: string;
  documento: string;
  inscricaoEstadual: string;
  endereco: string;
  atendimento: string;
}

/** Linha da tabela de itens da fatura (todas as colunas do documento) */
export interface ItemDetalhado extends ItemFatura {
  /** PIS + COFINS do item (R$) */
  pisCofins?: number;
  baseIcms?: number;
  /** Alíquota de ICMS em % (20.5) */
  aliquotaIcms?: number;
  icms?: number;
  /** Tarifa unitária sem tributos (R$) */
  tarifaSemTributos?: number;
}

export interface LinhaMedidor {
  grandeza: "Energia Ativa" | "Energia Reativa" | "Demanda Ativa";
  posto: "Único" | "Ponta" | "Fora Ponta";
  unidade: "kWh" | "kVArh" | "kW";
  /** Ausente nos registradores de demanda (máxima do ciclo) */
  leituraAnterior?: number;
  leituraAtual: number;
  constante: number;
  /** (atual − anterior) × constante; na demanda, atual × constante */
  medido: number;
}

export interface MesHistorico {
  competencia: Competencia;
  dias: number;
  consumoKwh: number;
  consumoPontaKwh?: number;
  consumoForaPontaKwh?: number;
  demandaMedidaKw?: number;
}

export interface LinhaTributo {
  tributo: "PIS" | "COFINS" | "ICMS";
  base: number;
  /** % */
  aliquota: number;
  valor: number;
}

export interface UcDaFatura {
  /** Vazio para UC avulsa */
  id: Id;
  /** Vazio para UC avulsa */
  condominioId: Id;
  numeroUc: string;
  numeroMedidor: string;
  apelido: string;
  subgrupo: Subgrupo;
  modalidade: ModalidadeTarifaria;
  ambiente: AmbienteContratacao;
  demandaContratadaKw?: number;
  avulsa: boolean;
}

interface FaturaBase {
  tipo: TipoFaturaFicticia;
  tipoFatura: TipoFaturaEnergia;
  emissor: Empresa;
  cliente: { nome: string; documento: string; endereco: string[] };
  uc: UcDaFatura;
  competencia: Competencia;
  numero: string;
  emissao: DataISO;
  vencimento: DataISO;
  /** Soma dos itens */
  total: number;
  leituraAnterior: DataISO;
  leituraAtual: DataISO;
  proximaLeitura: DataISO;
  dias: number;
  consumoKwh: number;
  consumoPontaKwh?: number;
  consumoForaPontaKwh?: number;
  demandaMedidaKw?: number;
  demandaMedidaPontaKw?: number;
  reativoExcedenteKvarh?: number;
  /** Bandeira predominante no ciclo */
  bandeira: Bandeira;
  /** Dias do ciclo em cada bandeira */
  bandeirasNoCiclo: { bandeira: Bandeira; dias: number }[];
  itens: ItemDetalhado[];
  tributos: LinhaTributo[];
  mensagens: string[];
  /** Semente usada ("demo" = série da demonstração) */
  semente: string;
}

export interface FaturaDistribuidora extends FaturaBase {
  tipo: "b3_cativo" | "a4_verde_cativo" | "a4_verde_livre_distribuicao";
  tipoFatura: "completa" | "distribuicao";
  classificacao: string;
  tipoFornecimento: string;
  medidor: LinhaMedidor[];
  /** 13 meses, do mais antigo ao atual (o último é esta fatura) */
  historico: MesHistorico[];
  fatorPotencia?: number;
  /** Mercado livre: custo estimado no cativo para as mesmas medições */
  custoEquivalenteCativo?: number;
  precoEnergiaLivreMwh?: number;
}

export interface ComparativoLivreCativo {
  competencia: Competencia;
  distribuicao: number;
  energia: number;
  totalLivre: number;
  cativoEquivalente: number;
  economia: number;
  /** % */
  economiaPercentual: number;
}

export interface FaturaComercializadora extends FaturaBase {
  tipo: "comercializadora_livre";
  tipoFatura: "energia_livre";
  contrato: string;
  pontoMedicao: string;
  energia: {
    medidoMwh: number;
    perdasPercentual: number;
    perdasMwh: number;
    proinfaPercentual: number;
    proinfaMwh: number;
    faturadoMwh: number;
    precoMwhSemIcms: number;
    precoMwhComIcms: number;
    valorSemIcms: number;
    icms: number;
    aliquotaIcms: number;
  };
  /** Mês desta fatura */
  comparativo: ComparativoLivreCativo;
  /** Até 12 meses (do mais antigo ao atual) — vazio quando não solicitado */
  historicoComparativo: ComparativoLivreCativo[];
}

export type FaturaFicticia = FaturaDistribuidora | FaturaComercializadora;

/** Resultado da geração: UC livre gera o par distribuição + comercializadora */
export interface FaturasGeradas {
  principal: FaturaDistribuidora;
  comercializadora?: FaturaComercializadora;
}
