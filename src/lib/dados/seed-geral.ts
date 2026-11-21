/**
 * Contas NÃO-energia da demonstração (água, gás, manutenção, limpeza,
 * segurança, elevadores, pessoal, administração, seguros, outros).
 *
 * DONO: agente "Gestão".
 * Regras: determinística (criarPrng com semente), origem "demo", competências
 * em COMPETENCIAS_DEMO, pagas até DATA_REFERENCIA, fornecedores fictícios.
 *
 * Magnitudes calibradas para condomínios da Região Metropolitana do Recife:
 * pessoal ≈ 40–50% do gasto, energia ≈ 10–15%, água ≈ 5–15% (prédios com
 * medição coletiva pesam mais). Contratos reajustam uma vez por ano (IPCA
 * ≈ 4,5%); a folha reajusta em janeiro (dissídio); 13º em nov e dez.
 *
 * Histórias embutidas (os insights de src/lib/analise/geral.ts as encontram):
 *  1. Vazamento — Residencial Jardins de Boa Viagem: água +33% (out/26) e
 *     +38% (nov/26) sobre o normal, sem conserto registrado.
 *  2. Reajuste acima da inflação — Vertix Elevadores (Mirante do Capibaribe)
 *     +18,9% em mar/26; Verde Vale (limpeza e jardinagem do Reserva das
 *     Palmeiras) +12,6% em jul/26.
 *  3. Custo por unidade — Mirante do Capibaribe tem duas portarias (uma por
 *     torre) e fica bem acima dos outros prédios; Reserva das Palmeiras acima
 *     do Villa Aldeia (ETE, clube e rondas).
 *  4. Contas vencidas sem pagamento — parcela do seguro do Villa Aldeia
 *     (12/11) e água do Atlântico Sul (18/11).
 *  5. Seguro do Reserva das Palmeiras renova em jan/2027 (hora de cotar).
 *  6. Mesmos fornecedores em vários condomínios (Brilho Limpeza, Olho Vivo
 *     Monitoramento): oportunidade de negociar em bloco.
 */
import { centavos, criarPrng, type Prng } from "../prng";
import type { Categoria, Competencia, Conta, DataISO } from "../tipos";
import { COMPETENCIAS_DEMO, DATA_REFERENCIA, somarDias, somarMeses } from "./referencia";

/* ------------------------------------------------------------------ */
/* Fornecedores fictícios                                              */
/* ------------------------------------------------------------------ */

export const FORNECEDORES = {
  saneamento: "Aquaterra Saneamento S.A.",
  gasNatural: "Brisa Gás Natural S.A.",
  glp: "Chama Azul GLP a Granel Ltda.",
  folha: "Folha de pagamento — funcionários",
  inss: "Previdência Social — INSS",
  fgts: "FGTS — guia mensal",
  beneficios: "Bem Mais Benefícios Ltda.",
  verdeVale: "Verde Vale Paisagismo e Limpeza Ltda.",
  jardimNativo: "Jardim Nativo Serviços de Jardinagem",
  brilho: "Brilho Serviços de Limpeza Ltda.",
  pragasZero: "Pragas Zero Dedetização",
  guardiao: "Guardião Segurança Patrimonial",
  olhoVivo: "Olho Vivo Monitoramento Eletrônico",
  vertix: "Vertix Elevadores Ltda.",
  elevar: "Elevar Nordeste Elevadores",
  aquaClara: "AquaClara Tratamento de Piscinas",
  bioTrat: "BioTrat Operação de ETE",
  manutec: "Manutec Manutenção Predial",
  hidrotec: "Hidrotec Reparos Hidráulicos",
  eletroLuz: "Eletro Luz Instalações Elétricas",
  dieselForte: "Diesel Forte Geradores",
  prisma: "Prisma Gestão Condominial",
  amparo: "Amparo Seguros S.A.",
  banco: "Banco Capibaribe S.A.",
  casaForte: "Casa Forte Suprimentos",
  festa: "Festa & Cia Eventos",
  cartorio: "Cartório de Registro de Títulos e Documentos",
} as const;

/* ------------------------------------------------------------------ */
/* Índices                                                             */
/* ------------------------------------------------------------------ */

/** Reajuste anual: mês do aniversário + percentual por ano (ausente = IPCA) */
interface Reajuste {
  mes: number;
  percentuais?: Partial<Record<number, number>>;
}

const IPCA: Record<number, number> = { 2025: 4.6, 2026: 4.4 };
const DISSIDIO: Reajuste = { mes: 1, percentuais: { 2025: 5.6, 2026: 5.1 } };
const TARIFA_AGUA: Reajuste = { mes: 7, percentuais: { 2025: 5.9, 2026: 6.2 } };
const TARIFA_GAS: Reajuste = { mes: 1, percentuais: { 2025: 3.8, 2026: 4.1 } };
/** Tarifa média água + esgoto (R$/m³) em dez/2024 */
const TARIFA_AGUA_BASE = 11.2;
const TAXA_FIXA_AGUA = 48.9;

const ano = (c: Competencia) => Number(c.slice(0, 4));
const mesDe = (c: Competencia) => Number(c.slice(5, 7));

function fatorReajuste(c: Competencia, r?: Reajuste) {
  if (!r) return 1;
  let fator = 1;
  for (const a of [2025, 2026]) {
    const inicio = `${a}-${String(r.mes).padStart(2, "0")}`;
    if (c >= inicio) fator *= 1 + (r.percentuais?.[a] ?? IPCA[a]) / 100;
  }
  return fator;
}

function diasNoMes(c: Competencia) {
  const [a, m] = c.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Data no mês da competência (ou meses depois), limitando o dia ao fim do mês */
function dataNoMes(c: Competencia, dia: number, mesesDepois = 0): DataISO {
  const alvo = somarMeses(c, mesesDepois);
  return `${alvo}-${String(Math.min(dia, diasNoMes(alvo))).padStart(2, "0")}`;
}

/** Sazonalidade de Recife: mais calor (e mais água) de nov a mar */
const sazonalCalor = (c: Competencia) => Math.cos(((mesDe(c) - 1) / 12) * 2 * Math.PI);

/* ------------------------------------------------------------------ */
/* Perfis dos condomínios                                              */
/* ------------------------------------------------------------------ */

interface Contrato {
  chave: string;
  categoria: Categoria;
  fornecedor: string;
  descricao: string;
  /** Valor mensal em dez/2024 */
  valor: number;
  /** Dia do vencimento */
  dia: number;
  /** Vence no mês seguinte ao da competência */
  mesSeguinte?: boolean;
  reajuste?: Reajuste;
  /** Variação relativa mês a mês (contas de consumo) */
  variacao?: number;
  /** Só existe nestes meses do ano (ex.: dedetização semestral) */
  meses?: number[];
}

interface Eventual {
  competencia: Competencia;
  categoria: Categoria;
  fornecedor: string;
  descricao: string;
  valor: number;
  dia: number;
}

interface Perfil {
  id: string;
  pessoal: { salarios: number; beneficios: number; equipe: string };
  agua: { m3Dia: number; dia: number; descricao: string; fatorMes?: Partial<Record<Competencia, number>> };
  gas?: { fornecedor: string; descricao: string; m3Dia: number; tarifa: number; dia: number };
  seguro: { premioAnual2024: number; mesRenovacao: number; dia: number };
  contratos: Contrato[];
  corretivas: { chance: number; min: number; max: number; horizontal?: boolean; ate?: Competencia };
  eventuais: Eventual[];
}

/** Contratos comuns a todos (banco, material, dedetização, Natal, ata) */
function contratosComuns(p: {
  unidades: number;
  material: number;
  dedetizacao: number;
  natal: number;
}): Contrato[] {
  return [
    {
      chave: "banco",
      categoria: "outros",
      fornecedor: FORNECEDORES.banco,
      descricao: "Tarifas bancárias e emissão de boletos",
      valor: centavos(p.unidades * 2.9),
      dia: 2,
      mesSeguinte: true,
      variacao: 0.04,
    },
    {
      chave: "material",
      categoria: "outros",
      fornecedor: FORNECEDORES.casaForte,
      descricao: "Material de limpeza e consumo",
      valor: p.material,
      dia: 18,
      variacao: 0.15,
      reajuste: { mes: 1 },
    },
    {
      chave: "dedetizacao",
      categoria: "limpeza",
      fornecedor: FORNECEDORES.pragasZero,
      descricao: "Dedetização e limpeza de caixas d'água",
      valor: p.dedetizacao,
      dia: 16,
      meses: [3, 9],
      reajuste: { mes: 1 },
    },
    {
      chave: "natal",
      categoria: "outros",
      fornecedor: FORNECEDORES.festa,
      descricao: "Decoração de Natal e confraternização da equipe",
      valor: p.natal,
      dia: 10,
      meses: [12],
    },
    {
      chave: "ata",
      categoria: "outros",
      fornecedor: FORNECEDORES.cartorio,
      descricao: "Registro da ata da assembleia geral",
      valor: 420,
      dia: 20,
      meses: [3],
      reajuste: { mes: 1 },
    },
  ];
}

const taxaAdministracao = (unidades: number, porUnidade: number, minimo = 1600): Contrato => ({
  chave: "administracao",
  categoria: "administracao",
  fornecedor: FORNECEDORES.prisma,
  descricao: `Taxa de administração (${unidades} unidades)`,
  valor: centavos(Math.max(unidades * porUnidade, minimo)),
  dia: 10,
  reajuste: { mes: 1 },
});

const PERFIS: Perfil[] = [
  {
    id: "reserva-das-palmeiras",
    pessoal: { salarios: 45_000, beneficios: 6_900, equipe: "portaria 24h, zeladoria e manutenção" },
    agua: { m3Dia: 18, dia: 22, descricao: "Água e esgoto — clube, portaria e áreas comuns" },
    seguro: { premioAnual2024: 37_200, mesRenovacao: 1, dia: 14 },
    contratos: [
      {
        chave: "limpeza",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.verdeVale,
        descricao: "Limpeza e jardinagem das áreas comuns",
        valor: 18_400,
        dia: 8,
        // HISTÓRIA 2: reajuste bem acima da inflação em jul/2026
        reajuste: { mes: 7, percentuais: { 2025: 4.9, 2026: 12.6 } },
      },
      {
        chave: "rondas",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.guardiao,
        descricao: "Rondas motorizadas e vigilância noturna",
        valor: 9_800,
        dia: 10,
        reajuste: { mes: 5 },
      },
      {
        chave: "monitoramento",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.olhoVivo,
        descricao: "Monitoramento de câmeras e alarmes",
        valor: 2_400,
        dia: 20,
        reajuste: { mes: 10 },
      },
      {
        chave: "piscina",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.aquaClara,
        descricao: "Tratamento e limpeza da piscina do clube",
        valor: 2_450,
        dia: 5,
        reajuste: { mes: 1 },
      },
      {
        chave: "ete",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.bioTrat,
        descricao: "Operação e análises da estação de esgoto (ETE)",
        valor: 4_900,
        dia: 18,
        reajuste: { mes: 4 },
      },
      {
        chave: "preventiva",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Manutenção preventiva — bombas, portões e iluminação",
        valor: 3_200,
        dia: 25,
        reajuste: { mes: 8 },
      },
      taxaAdministracao(211, 27),
      ...contratosComuns({ unidades: 211, material: 1_350, dedetizacao: 2_800, natal: 4_800 }),
    ],
    corretivas: { chance: 0.22, min: 900, max: 6_500, horizontal: true },
    eventuais: [
      {
        competencia: "2025-05",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Pintura das guaritas e da portaria",
        valor: 14_800,
        dia: 20,
      },
      {
        competencia: "2025-10",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.hidrotec,
        descricao: "Troca da bomba do poço artesiano",
        valor: 11_600,
        dia: 12,
      },
      {
        competencia: "2026-02",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.verdeVale,
        descricao: "Poda de árvores de grande porte",
        valor: 3_900,
        dia: 16,
      },
    ],
  },
  {
    id: "mirante-do-capibaribe",
    // HISTÓRIA 3: duas portarias (uma por torre) → folha maior que a dos pares
    pessoal: { salarios: 41_000, beneficios: 6_300, equipe: "portarias das 2 torres e zeladoria" },
    agua: { m3Dia: 42, dia: 25, descricao: "Água e esgoto — consumo coletivo" },
    gas: {
      fornecedor: FORNECEDORES.gasNatural,
      descricao: "Gás natural canalizado — consumo coletivo",
      m3Dia: 16,
      tarifa: 8.9,
      dia: 15,
    },
    seguro: { premioAnual2024: 29_300, mesRenovacao: 4, dia: 12 },
    contratos: [
      {
        chave: "elevadores",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.vertix,
        descricao: "Manutenção mensal — 6 elevadores",
        valor: 4_920,
        dia: 10,
        // HISTÓRIA 2: reajuste de 18,9% em mar/2026
        reajuste: { mes: 3, percentuais: { 2025: 4.6, 2026: 18.9 } },
      },
      {
        chave: "limpeza",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.brilho,
        descricao: "Limpeza terceirizada — garagens e fachadas",
        valor: 9_000,
        dia: 15,
        reajuste: { mes: 9 },
      },
      {
        chave: "monitoramento",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.olhoVivo,
        descricao: "Monitoramento de câmeras e controle de acesso",
        valor: 4_200,
        dia: 20,
        reajuste: { mes: 10 },
      },
      {
        chave: "piscina",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.aquaClara,
        descricao: "Tratamento da piscina",
        valor: 1_650,
        dia: 5,
        reajuste: { mes: 1 },
      },
      {
        chave: "preventiva",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Manutenção preventiva — bombas e instalações",
        valor: 3_100,
        dia: 25,
        reajuste: { mes: 8 },
      },
      taxaAdministracao(168, 30),
      ...contratosComuns({ unidades: 168, material: 1_100, dedetizacao: 1_900, natal: 3_600 }),
    ],
    corretivas: { chance: 0.16, min: 700, max: 5_200 },
    eventuais: [
      {
        competencia: "2025-08",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Impermeabilização da piscina",
        valor: 18_500,
        dia: 22,
      },
      {
        competencia: "2025-09",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.vertix,
        descricao: "Substituição de placa de comando — torre B",
        valor: 6_400,
        dia: 18,
      },
    ],
  },
  {
    id: "jardins-de-boa-viagem",
    pessoal: { salarios: 24_000, beneficios: 3_600, equipe: "portaria e zeladoria" },
    agua: {
      m3Dia: 28,
      dia: 24,
      descricao: "Água e esgoto — consumo coletivo",
      // HISTÓRIA 1: vazamento nos dois últimos meses
      fatorMes: { "2026-10": 1.33, "2026-11": 1.38 },
    },
    gas: {
      fornecedor: FORNECEDORES.glp,
      descricao: "Gás GLP — central de gás",
      m3Dia: 9.5,
      tarifa: 11.2,
      dia: 12,
    },
    seguro: { premioAnual2024: 20_300, mesRenovacao: 8, dia: 15 },
    contratos: [
      {
        chave: "elevadores",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.elevar,
        descricao: "Manutenção mensal — 3 elevadores",
        valor: 2_640,
        dia: 12,
        reajuste: { mes: 6 },
      },
      {
        chave: "limpeza",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.brilho,
        descricao: "Limpeza terceirizada — áreas comuns",
        valor: 6_500,
        dia: 15,
        reajuste: { mes: 9 },
      },
      {
        chave: "monitoramento",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.olhoVivo,
        descricao: "Monitoramento de câmeras e alarmes",
        valor: 3_300,
        dia: 20,
        reajuste: { mes: 10 },
      },
      {
        chave: "piscina",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.aquaClara,
        descricao: "Tratamento da piscina",
        valor: 1_350,
        dia: 5,
        reajuste: { mes: 1 },
      },
      {
        chave: "preventiva",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Manutenção preventiva — bombas e instalações",
        valor: 2_300,
        dia: 25,
        reajuste: { mes: 8 },
      },
      {
        chave: "gerador",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.dieselForte,
        descricao: "Manutenção preventiva do gerador",
        valor: 690,
        dia: 27,
        reajuste: { mes: 2 },
      },
      taxaAdministracao(120, 31),
      ...contratosComuns({ unidades: 120, material: 800, dedetizacao: 1_500, natal: 2_400 }),
    ],
    // Sem corretivas depois de ago/26: o vazamento ainda não foi consertado
    corretivas: { chance: 0.15, min: 600, max: 4_800, ate: "2026-08" },
    eventuais: [
      {
        competencia: "2026-01",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.hidrotec,
        descricao: "Troca de bomba de recalque",
        valor: 7_900,
        dia: 19,
      },
      {
        competencia: "2026-02",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.elevar,
        descricao: "Reparo de porta de cabina",
        valor: 1_980,
        dia: 14,
      },
    ],
  },
  {
    id: "villa-aldeia",
    pessoal: { salarios: 8_400, beneficios: 1_250, equipe: "portaria" },
    agua: { m3Dia: 4.5, dia: 23, descricao: "Água e esgoto — portaria e piscina" },
    seguro: { premioAnual2024: 7_900, mesRenovacao: 5, dia: 12 },
    contratos: [
      {
        chave: "limpeza",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.jardimNativo,
        descricao: "Jardinagem e limpeza das áreas comuns",
        valor: 4_350,
        dia: 8,
        reajuste: { mes: 2 },
      },
      {
        chave: "monitoramento",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.olhoVivo,
        descricao: "Monitoramento de câmeras e alarmes",
        valor: 1_950,
        dia: 20,
        reajuste: { mes: 10 },
      },
      {
        chave: "piscina",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.aquaClara,
        descricao: "Tratamento da piscina",
        valor: 980,
        dia: 5,
        reajuste: { mes: 1 },
      },
      {
        chave: "preventiva",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Manutenção preventiva — bomba do poço e portões",
        valor: 1_200,
        dia: 25,
        reajuste: { mes: 8 },
      },
      taxaAdministracao(48, 33),
      ...contratosComuns({ unidades: 48, material: 380, dedetizacao: 900, natal: 1_500 }),
    ],
    corretivas: { chance: 0.14, min: 400, max: 2_800, horizontal: true },
    eventuais: [
      {
        competencia: "2025-11",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Reforma do deck da piscina",
        valor: 6_200,
        dia: 17,
      },
    ],
  },
  {
    id: "edificio-atlantico",
    pessoal: { salarios: 12_000, beneficios: 1_800, equipe: "portaria e zeladoria" },
    agua: { m3Dia: 15, dia: 18, descricao: "Água e esgoto — consumo coletivo" },
    seguro: { premioAnual2024: 10_800, mesRenovacao: 2, dia: 15 },
    contratos: [
      {
        chave: "elevadores",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.elevar,
        descricao: "Manutenção mensal — 2 elevadores",
        valor: 1_860,
        dia: 12,
        reajuste: { mes: 6 },
      },
      {
        chave: "limpeza",
        categoria: "limpeza",
        fornecedor: FORNECEDORES.brilho,
        descricao: "Limpeza terceirizada — áreas comuns",
        valor: 3_500,
        dia: 15,
        reajuste: { mes: 9 },
      },
      {
        chave: "monitoramento",
        categoria: "seguranca",
        fornecedor: FORNECEDORES.olhoVivo,
        descricao: "Monitoramento de câmeras",
        valor: 2_050,
        dia: 20,
        reajuste: { mes: 10 },
      },
      {
        chave: "preventiva",
        categoria: "manutencao",
        fornecedor: FORNECEDORES.manutec,
        descricao: "Manutenção preventiva — bombas e instalações",
        valor: 1_700,
        dia: 25,
        reajuste: { mes: 8 },
      },
      taxaAdministracao(64, 34),
      ...contratosComuns({ unidades: 64, material: 520, dedetizacao: 1_400, natal: 1_100 }),
    ],
    corretivas: { chance: 0.14, min: 500, max: 3_600 },
    eventuais: [
      {
        competencia: "2025-06",
        categoria: "elevadores",
        fornecedor: FORNECEDORES.elevar,
        descricao: "Troca de cabos de tração — elevador social",
        valor: 9_850,
        dia: 23,
      },
    ],
  },
];

/** Reparos eventuais (sorteados por mês) */
const CORRETIVAS: { descricao: string; fornecedor: string; fator: number; soHorizontal?: boolean }[] = [
  { descricao: "Reparo em bomba de recalque", fornecedor: FORNECEDORES.hidrotec, fator: 1 },
  { descricao: "Desentupimento da rede de esgoto", fornecedor: FORNECEDORES.hidrotec, fator: 0.5 },
  { descricao: "Troca de lâmpadas e reatores", fornecedor: FORNECEDORES.eletroLuz, fator: 0.45 },
  { descricao: "Conserto de portão eletrônico", fornecedor: FORNECEDORES.manutec, fator: 0.55 },
  { descricao: "Reparo no interfone e na central de portaria", fornecedor: FORNECEDORES.eletroLuz, fator: 0.6 },
  { descricao: "Pequenos reparos de alvenaria e pintura", fornecedor: FORNECEDORES.manutec, fator: 0.8 },
  { descricao: "Reparo de iluminação viária", fornecedor: FORNECEDORES.eletroLuz, fator: 0.9, soHorizontal: true },
];

/**
 * Contas com vencimento antes da DATA_REFERENCIA que (de propósito) NÃO foram
 * pagas — HISTÓRIA 4.
 */
const EM_ATRASO = new Set(["gr-villa-aldeia-seguro-2026-11", "gr-edificio-atlantico-agua-2026-11"]);

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

interface DadosConta {
  chave: string;
  competencia: Competencia;
  categoria: Categoria;
  fornecedor: string;
  descricao: string;
  valor: number;
  vencimento: DataISO;
  agua?: Conta["agua"];
  gas?: Conta["gas"];
  observacoes?: string;
}

function montar(condominioId: string, d: DadosConta, rng: Prng): Conta {
  const id = `gr-${condominioId}-${d.chave}-${d.competencia}`;
  const emAberto = EM_ATRASO.has(id) || d.vencimento >= DATA_REFERENCIA;
  return {
    id,
    condominioId,
    categoria: d.categoria,
    fornecedor: d.fornecedor,
    descricao: d.descricao,
    competencia: d.competencia,
    emissao: somarDias(d.vencimento, -rng.inteiro(7, 12)),
    vencimento: d.vencimento,
    valor: centavos(d.valor),
    pagaEm: emAberto ? undefined : somarDias(d.vencimento, -rng.inteiro(0, 3)),
    origem: "demo",
    ...(d.agua && { agua: d.agua }),
    ...(d.gas && { gas: d.gas }),
    ...(d.observacoes && { observacoes: d.observacoes }),
  };
}

function contasDoPerfil(p: Perfil): Conta[] {
  const contas: Conta[] = [];
  const rng = (chave: string) => criarPrng(`geral:${p.id}:${chave}`);
  const add = (d: DadosConta, r: Prng) => contas.push(montar(p.id, d, r));

  // Pessoal: salários, encargos, benefícios e 13º
  const rP = rng("pessoal");
  for (const c of COMPETENCIAS_DEMO) {
    const fator = fatorReajuste(c, DISSIDIO);
    const salariosBase = p.pessoal.salarios * fator;
    const salarios = salariosBase * (1 + 0.012 * rP.normal()); // horas extras e faltas
    add(
      {
        chave: "salarios",
        competencia: c,
        categoria: "pessoal",
        fornecedor: FORNECEDORES.folha,
        descricao: `Salários — ${p.pessoal.equipe}`,
        valor: salarios,
        vencimento: dataNoMes(c, 5, 1),
      },
      rP,
    );
    add(
      {
        chave: "inss",
        competencia: c,
        categoria: "pessoal",
        fornecedor: FORNECEDORES.inss,
        descricao: "Encargos — INSS patronal e terceiros",
        valor: salarios * 0.268,
        vencimento: dataNoMes(c, 20, 1),
      },
      rP,
    );
    add(
      {
        chave: "fgts",
        competencia: c,
        categoria: "pessoal",
        fornecedor: FORNECEDORES.fgts,
        descricao: "Encargos — FGTS",
        valor: salarios * 0.08,
        vencimento: dataNoMes(c, 20, 1),
      },
      rP,
    );
    add(
      {
        chave: "beneficios",
        competencia: c,
        categoria: "pessoal",
        fornecedor: FORNECEDORES.beneficios,
        descricao: "Vale-transporte e vale-alimentação",
        valor: p.pessoal.beneficios * fator,
        vencimento: dataNoMes(c, 28),
      },
      rP,
    );
    if (mesDe(c) === 11) {
      add(
        {
          chave: "13-salario",
          competencia: c,
          categoria: "pessoal",
          fornecedor: FORNECEDORES.folha,
          descricao: "13º salário — 1ª parcela",
          valor: salariosBase * 0.5,
          vencimento: dataNoMes(c, 30),
        },
        rP,
      );
    }
    if (mesDe(c) === 12) {
      add(
        {
          chave: "13-salario",
          competencia: c,
          categoria: "pessoal",
          fornecedor: FORNECEDORES.folha,
          descricao: "13º salário — 2ª parcela",
          valor: salariosBase * 0.5,
          vencimento: dataNoMes(c, 18),
        },
        rP,
      );
    }
  }

  // Água (consumo medido; HISTÓRIA 1 via fatorMes)
  const rA = rng("agua");
  for (const c of COMPETENCIAS_DEMO) {
    const dias = rA.inteiro(29, 32);
    const fatorMes = p.agua.fatorMes?.[c] ?? 1;
    const consumoM3 = Math.round(
      p.agua.m3Dia * dias * (1 + 0.05 * sazonalCalor(c)) * fatorMes * (1 + 0.03 * rA.normal()),
    );
    const tarifa = TARIFA_AGUA_BASE * fatorReajuste(c, TARIFA_AGUA);
    add(
      {
        chave: "agua",
        competencia: c,
        categoria: "agua",
        fornecedor: FORNECEDORES.saneamento,
        descricao: p.agua.descricao,
        valor: consumoM3 * tarifa + TAXA_FIXA_AGUA,
        vencimento: dataNoMes(c, p.agua.dia),
        agua: { consumoM3, dias },
      },
      rA,
    );
  }

  // Gás (só prédios com central de gás)
  if (p.gas) {
    const gas = p.gas;
    const rG = rng("gas");
    for (const c of COMPETENCIAS_DEMO) {
      const consumoM3 = Math.round(
        gas.m3Dia * diasNoMes(c) * (1 - 0.04 * sazonalCalor(c)) * (1 + 0.04 * rG.normal()),
      );
      add(
        {
          chave: "gas",
          competencia: c,
          categoria: "gas",
          fornecedor: gas.fornecedor,
          descricao: gas.descricao,
          valor: consumoM3 * gas.tarifa * fatorReajuste(c, TARIFA_GAS) + 35,
          vencimento: dataNoMes(c, gas.dia),
          gas: { consumoM3 },
        },
        rG,
      );
    }
  }

  // Seguro: prêmio anual em 10 parcelas a partir do mês de renovação
  const rS = rng("seguro");
  for (const c of COMPETENCIAS_DEMO) {
    const k = (mesDe(c) - p.seguro.mesRenovacao + 12) % 12;
    if (k >= 10) continue;
    const anoApolice = mesDe(c) >= p.seguro.mesRenovacao ? ano(c) : ano(c) - 1;
    const premio = p.seguro.premioAnual2024 * 1.065 ** (anoApolice - 2024);
    add(
      {
        chave: "seguro",
        competencia: c,
        categoria: "seguros",
        fornecedor: FORNECEDORES.amparo,
        descricao: `Seguro condominial — parcela ${k + 1}/10 (apólice ${anoApolice}/${anoApolice + 1})`,
        valor: premio / 10,
        vencimento: dataNoMes(c, p.seguro.dia),
      },
      rS,
    );
  }

  // Contratos mensais e periódicos
  for (const ct of p.contratos) {
    const r = rng(ct.chave);
    for (const c of COMPETENCIAS_DEMO) {
      if (ct.meses && !ct.meses.includes(mesDe(c))) continue;
      const ruido = ct.variacao ? 1 + ct.variacao * r.normal() : 1;
      add(
        {
          chave: ct.chave,
          competencia: c,
          categoria: ct.categoria,
          fornecedor: ct.fornecedor,
          descricao: ct.descricao,
          valor: ct.valor * fatorReajuste(c, ct.reajuste) * Math.max(0.6, ruido),
          vencimento: dataNoMes(c, ct.dia, ct.mesSeguinte ? 1 : 0),
        },
        r,
      );
    }
  }

  // Manutenções corretivas sorteadas
  const rC = rng("corretivas");
  const opcoes = CORRETIVAS.filter((o) => !o.soHorizontal || p.corretivas.horizontal);
  for (const c of COMPETENCIAS_DEMO) {
    const sorteio = rC.proximo();
    const escolha = rC.escolher(opcoes);
    const valor = Math.round(rC.entre(p.corretivas.min, p.corretivas.max) * escolha.fator / 10) * 10;
    const dia = rC.inteiro(6, 26);
    if (sorteio >= p.corretivas.chance) continue;
    if (p.corretivas.ate && c > p.corretivas.ate) continue;
    add(
      {
        chave: "corretiva",
        competencia: c,
        categoria: "manutencao",
        fornecedor: escolha.fornecedor,
        descricao: escolha.descricao,
        valor: Math.max(valor, 250),
        vencimento: dataNoMes(c, dia),
      },
      rC,
    );
  }

  // Serviços pontuais
  const rE = rng("eventuais");
  p.eventuais.forEach((e, i) =>
    add(
      {
        chave: `eventual-${i + 1}`,
        competencia: e.competencia,
        categoria: e.categoria,
        fornecedor: e.fornecedor,
        descricao: e.descricao,
        valor: e.valor,
        vencimento: dataNoMes(e.competencia, e.dia),
        observacoes: "Serviço pontual aprovado pelo síndico.",
      },
      rE,
    ),
  );

  return contas;
}

export function gerarContasGeraisDemo(): Conta[] {
  return PERFIS.flatMap(contasDoPerfil);
}
