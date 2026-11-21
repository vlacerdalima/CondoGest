/**
 * Contrato de dados do CondoGest (MVP sem banco de dados).
 *
 * Todas as telas, o gerador de contas fictícias e as análises falam esta
 * "língua". Quando entrar um banco de dados, estes tipos viram o schema.
 *
 * Convenções:
 *  - Datas: string ISO "AAAA-MM-DD".
 *  - Competência (mês de referência da conta): string "AAAA-MM".
 *  - Valores monetários: number em reais (R$), com 2 casas.
 *  - Energia em kWh; demanda em kW.
 */

export type Id = string;
export type DataISO = string; // "2026-11-21"
export type Competencia = string; // "2026-11"

/* ------------------------------------------------------------------ */
/* Carteira                                                            */
/* ------------------------------------------------------------------ */

export interface Administradora {
  id: Id;
  nome: string;
  cidade: string;
  uf: string;
  gestor: { nome: string; cargo: string; email: string };
}

export type TipoCondominio = "horizontal" | "vertical";

export interface Condominio {
  id: Id;
  /** Slug usado nas rotas (/condominios/[slug]) */
  slug: string;
  nome: string;
  tipo: TipoCondominio;
  bairro: string;
  cidade: string;
  uf: string;
  /** Total de unidades (lotes, casas ou apartamentos) */
  unidades: number;
  /** Unidades ocupadas por competência (crescimento de ocupação, p.ex. 60 → 80 casas) */
  ocupacao: { competencia: Competencia; unidadesOcupadas: number }[];
  sindico: string;
  /** Áreas e equipamentos comuns — usados para insights e recomendações */
  areasComuns: string[];
  /** Cor de identificação na UI (índice da paleta de gráficos 1..7) */
  corSerie: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/* ------------------------------------------------------------------ */
/* Energia                                                             */
/* ------------------------------------------------------------------ */

/** Subgrupo tarifário ANEEL. A4 = média tensão (2,3–25 kV); B3 = baixa tensão comercial/demais classes. */
export type Subgrupo = "A4" | "B3";
export type ModalidadeTarifaria = "verde" | "azul" | "convencional" | "branca";
export type AmbienteContratacao = "cativo" | "livre";
export type Bandeira = "verde" | "amarela" | "vermelha_1" | "vermelha_2" | "escassez_hidrica";

/** Unidade consumidora (medidor/contrato com a distribuidora) */
export interface UnidadeConsumidora {
  id: Id;
  condominioId: Id;
  apelido: string; // "Áreas comuns — média tensão"
  numeroUc: string; // fictício
  numeroMedidor: string; // fictício
  distribuidora: string; // fictícia
  subgrupo: Subgrupo;
  modalidade: ModalidadeTarifaria;
  ambiente: AmbienteContratacao;
  /** Comercializadora de energia (só mercado livre) — fictícia */
  comercializadora?: string;
  /** Demanda contratada (só grupo A) */
  demandaContratadaKw?: number;
  /** Principais cargas atendidas por esta UC */
  cargas: string[];
}

/** Que fatura é esta: completa (cativo), só distribuição (TUSD, livre) ou só energia (comercializadora, livre) */
export type TipoFaturaEnergia = "completa" | "distribuicao" | "energia_livre";

export interface ItemFatura {
  descricao: string; // "Consumo-TUSD", "Demanda Fora Ponta", "Ilum. Púb. Municipal"...
  unidade?: "kWh" | "kW" | "kVArh" | "kVAr" | "MWh";
  quantidade?: number;
  /** Preço unitário com tributos (R$) */
  precoUnitario?: number;
  /** Valor em R$ (negativo para créditos/compensações) */
  valor: number;
}

export interface DetalheEnergia {
  ucId: Id;
  tipoFatura: TipoFaturaEnergia;
  leituraAnterior: DataISO;
  leituraAtual: DataISO;
  /** Dias do ciclo de faturamento (28–33). Use para normalizar em kWh/dia. */
  dias: number;
  /** Consumo total faturado no ciclo */
  consumoKwh: number;
  /** Grupo A: consumo no horário de ponta / fora de ponta */
  consumoPontaKwh?: number;
  consumoForaPontaKwh?: number;
  /** Grupo A */
  demandaContratadaKw?: number;
  demandaMedidaKw?: number;
  demandaMedidaPontaKw?: number;
  /** Energia reativa excedente (fator de potência < 0,92) */
  reativoExcedenteKvarh?: number;
  bandeira: Bandeira;
  itens: ItemFatura[];
  tributos: { pis: number; cofins: number; icms: number };
  /** Só mercado livre: preço contratado da energia (R$/MWh, sem ICMS) */
  precoEnergiaLivreMwh?: number;
  /** Só mercado livre: custo estimado se estivesse no mercado cativo (R$), para medir a economia */
  custoEquivalenteCativo?: number;
}

/* ------------------------------------------------------------------ */
/* Contas                                                              */
/* ------------------------------------------------------------------ */

export type Categoria =
  | "energia"
  | "agua"
  | "gas"
  | "manutencao"
  | "limpeza"
  | "seguranca"
  | "elevadores"
  | "pessoal"
  | "administracao"
  | "seguros"
  | "outros";

/** De onde veio a conta: dados de demonstração ou enviada pelo gestor na tela "Enviar conta" */
export type OrigemConta = "demo" | "envio";

/** Status é DERIVADO (ver statusDaConta em lib/dados) — não é armazenado. */
export type StatusConta = "paga" | "a_vencer" | "vence_em_breve" | "vencida";

export interface Conta {
  id: Id;
  condominioId: Id;
  categoria: Categoria;
  fornecedor: string;
  descricao: string;
  competencia: Competencia;
  emissao?: DataISO;
  vencimento: DataISO;
  valor: number;
  /** Data de pagamento; ausente = em aberto */
  pagaEm?: DataISO;
  origem: OrigemConta;
  /** Preenchidos quando origem = "envio" */
  arquivoNome?: string;
  enviadaEm?: string; // ISO datetime
  observacoes?: string;
  /** Presente quando categoria = "energia" */
  energia?: DetalheEnergia;
  /** Presente quando categoria = "agua" */
  agua?: { consumoM3: number; dias: number };
  /** Presente quando categoria = "gas" */
  gas?: { consumoM3: number };
}

/* ------------------------------------------------------------------ */
/* Insights e recomendações                                           */
/* ------------------------------------------------------------------ */

export type Severidade = "info" | "oportunidade" | "atencao" | "critico";

export interface Insight {
  id: Id;
  condominioId?: Id;
  categoria: Categoria | "geral";
  severidade: Severidade;
  titulo: string;
  /** 1–2 frases, linguagem sem jargão */
  descricao: string;
  /** Impacto financeiro estimado (R$/mês), quando houver */
  impactoMensal?: { min: number; max: number };
  /** Link interno para aprofundar */
  href?: string;
}

export interface Recomendacao {
  id: Id;
  condominioId: Id;
  ucId?: Id;
  titulo: string;
  descricao: string;
  /** Economia estimada em faixa (mín–máx) — premissas abertas */
  economiaMensalReais: { min: number; max: number };
  economiaMensalKwh?: { min: number; max: number };
  investimentoReais?: { min: number; max: number };
  paybackMeses?: { min: number; max: number };
  premissas: string[];
  esforco: "baixo" | "medio" | "alto";
  prioridade: number; // 1 = mais prioritária
}

/* ------------------------------------------------------------------ */
/* Extração automática (tela "Enviar conta")                          */
/* ------------------------------------------------------------------ */

/** Campos que a extração conseguiu ler; o gestor revisa antes de salvar */
export type ContaExtraida = Partial<Omit<Conta, "id" | "origem" | "enviadaEm">>;

export type ResultadoExtracao =
  | {
      status: "reconhecido";
      /** Conta pronta para revisão (todos os campos obrigatórios preenchidos) */
      conta: Omit<Conta, "id" | "origem" | "enviadaEm">;
      /** Como foi lido, p.ex. "Conta simulada CondoGest (metadados do PDF)" */
      fonte: string;
    }
  | { status: "parcial"; campos: ContaExtraida; fonte: string; aviso: string }
  | { status: "nao_reconhecido"; motivo: string };
