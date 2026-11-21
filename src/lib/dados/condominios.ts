import type { Administradora, Competencia, Condominio, UnidadeConsumidora } from "../tipos";
import { COMPETENCIAS_DEMO } from "./referencia";

/*
 * Carteira FICTÍCIA de demonstração. Nenhum nome, número de UC, medidor ou
 * empresa aqui é real. O "Reserva das Palmeiras" é inspirado no perfil do
 * condomínio piloto (condomínio de casas, 211 lotes, ~60 casas ocupadas
 * crescendo para ~80, duas contas de energia nas áreas comuns: média tensão no
 * mercado livre + baixa tensão), mas sem nenhum dado identificável.
 */

export const DISTRIBUIDORA_FICTICIA = "EnerLitoral Distribuidora S.A.";
export const COMERCIALIZADORA_FICTICIA = "Alísio Comercializadora de Energia Ltda.";

export const ADMINISTRADORA: Administradora = {
  id: "prisma",
  nome: "Prisma Gestão Condominial",
  cidade: "Recife",
  uf: "PE",
  gestor: { nome: "Carla Menezes", cargo: "Gestora de carteira", email: "carla@prisma.exemplo" },
};

/** Interpola a ocupação linearmente entre o início e o fim do histórico */
function ocupacaoLinear(inicio: number, fim: number): Condominio["ocupacao"] {
  const n = COMPETENCIAS_DEMO.length;
  return COMPETENCIAS_DEMO.map((competencia: Competencia, i) => ({
    competencia,
    unidadesOcupadas: Math.round(inicio + ((fim - inicio) * i) / (n - 1)),
  }));
}

export const CONDOMINIOS: Condominio[] = [
  {
    id: "reserva-das-palmeiras",
    slug: "reserva-das-palmeiras",
    nome: "Reserva das Palmeiras",
    tipo: "horizontal",
    bairro: "Aldeia",
    cidade: "Camaragibe",
    uf: "PE",
    unidades: 211,
    ocupacao: ocupacaoLinear(52, 64),
    sindico: "Roberto Albuquerque",
    areasComuns: [
      "Iluminação viária (≈ 320 postes)",
      "Clube com piscina e bombas de filtragem",
      "Estação de tratamento de esgoto (ETE)",
      "Poço artesiano e bombas de recalque",
      "Portaria 24h e guaritas",
      "Quadra poliesportiva iluminada",
      "Salão de festas",
    ],
    corSerie: 1,
  },
  {
    id: "mirante-do-capibaribe",
    slug: "mirante-do-capibaribe",
    nome: "Edifício Mirante do Capibaribe",
    tipo: "vertical",
    bairro: "Graças",
    cidade: "Recife",
    uf: "PE",
    unidades: 168,
    ocupacao: ocupacaoLinear(158, 162),
    sindico: "Fernanda Lins",
    areasComuns: [
      "2 torres com 6 elevadores",
      "Bombas de recalque e pressurização",
      "Garagem em 2 subsolos (iluminação 24h)",
      "Piscina e academia",
      "Salão de festas e espaço gourmet",
    ],
    corSerie: 2,
  },
  {
    id: "jardins-de-boa-viagem",
    slug: "jardins-de-boa-viagem",
    nome: "Residencial Jardins de Boa Viagem",
    tipo: "vertical",
    bairro: "Boa Viagem",
    cidade: "Recife",
    uf: "PE",
    unidades: 120,
    ocupacao: ocupacaoLinear(112, 115),
    sindico: "Marcos Tavares",
    areasComuns: [
      "3 elevadores",
      "Bombas de recalque",
      "Garagem coberta",
      "Piscina",
      "Gerador a diesel",
    ],
    corSerie: 3,
  },
  {
    id: "villa-aldeia",
    slug: "villa-aldeia",
    nome: "Condomínio Villa Aldeia",
    tipo: "horizontal",
    bairro: "Aldeia",
    cidade: "Camaragibe",
    uf: "PE",
    unidades: 48,
    ocupacao: ocupacaoLinear(41, 45),
    sindico: "Luciana Prado",
    areasComuns: ["Iluminação viária", "Portaria", "Piscina", "Bomba do poço"],
    corSerie: 4,
  },
  {
    id: "edificio-atlantico",
    slug: "edificio-atlantico",
    nome: "Edifício Atlântico Sul",
    tipo: "vertical",
    bairro: "Piedade",
    cidade: "Jaboatão dos Guararapes",
    uf: "PE",
    unidades: 64,
    ocupacao: ocupacaoLinear(60, 61),
    sindico: "José Carlos Moura",
    areasComuns: ["2 elevadores", "Bombas de recalque", "Garagem", "Salão de festas"],
    corSerie: 5,
  },
];

export const UNIDADES_CONSUMIDORAS: UnidadeConsumidora[] = [
  {
    id: "uc-rp-mt",
    condominioId: "reserva-das-palmeiras",
    apelido: "Áreas comuns — média tensão",
    numeroUc: "7.004.118.203-5",
    numeroMedidor: "90017731",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "A4",
    modalidade: "verde",
    ambiente: "livre",
    comercializadora: COMERCIALIZADORA_FICTICIA,
    demandaContratadaKw: 150,
    cargas: ["Clube e piscina", "ETE", "Poço artesiano e recalque", "Quadra iluminada"],
  },
  {
    id: "uc-rp-bt",
    condominioId: "reserva-das-palmeiras",
    apelido: "Áreas comuns — baixa tensão",
    numeroUc: "7.004.118.377-1",
    numeroMedidor: "41552096",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "B3",
    modalidade: "convencional",
    ambiente: "cativo",
    cargas: ["Iluminação viária", "Portaria e guaritas", "Salão de festas"],
  },
  {
    id: "uc-mc-mt",
    condominioId: "mirante-do-capibaribe",
    apelido: "Condomínio — média tensão",
    numeroUc: "7.002.551.090-8",
    numeroMedidor: "90023418",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "A4",
    modalidade: "verde",
    ambiente: "cativo",
    demandaContratadaKw: 90,
    cargas: ["Elevadores", "Bombas de recalque e pressurização", "Iluminação de garagem", "Piscina"],
  },
  {
    id: "uc-jbv-bt",
    condominioId: "jardins-de-boa-viagem",
    apelido: "Condomínio — baixa tensão",
    numeroUc: "7.001.874.662-3",
    numeroMedidor: "41388254",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "B3",
    modalidade: "convencional",
    ambiente: "cativo",
    cargas: ["Elevadores", "Bombas de recalque", "Iluminação de garagem", "Piscina"],
  },
  {
    id: "uc-va-bt",
    condominioId: "villa-aldeia",
    apelido: "Áreas comuns — baixa tensão",
    numeroUc: "7.004.209.115-0",
    numeroMedidor: "41610447",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "B3",
    modalidade: "convencional",
    ambiente: "cativo",
    cargas: ["Iluminação viária", "Portaria", "Bomba do poço", "Piscina"],
  },
  {
    id: "uc-as-bt",
    condominioId: "edificio-atlantico",
    apelido: "Condomínio — baixa tensão",
    numeroUc: "7.003.007.481-9",
    numeroMedidor: "41290873",
    distribuidora: DISTRIBUIDORA_FICTICIA,
    subgrupo: "B3",
    modalidade: "convencional",
    ambiente: "cativo",
    cargas: ["Elevadores", "Bombas de recalque", "Iluminação de garagem"],
  },
];

export function obterCondominio(idOuSlug: string) {
  return CONDOMINIOS.find((c) => c.id === idOuSlug || c.slug === idOuSlug);
}

export function obterUcsDoCondominio(condominioId: string) {
  return UNIDADES_CONSUMIDORAS.filter((uc) => uc.condominioId === condominioId);
}

export function obterUc(ucId: string) {
  return UNIDADES_CONSUMIDORAS.find((uc) => uc.id === ucId);
}

/** Unidades ocupadas numa competência (usa a mais próxima disponível) */
export function unidadesOcupadas(condominio: Condominio, competencia: Competencia) {
  const exata = condominio.ocupacao.find((o) => o.competencia === competencia);
  if (exata) return exata.unidadesOcupadas;
  const ordenada = [...condominio.ocupacao].sort((a, b) => a.competencia.localeCompare(b.competencia));
  if (competencia < ordenada[0].competencia) return ordenada[0].unidadesOcupadas;
  return ordenada[ordenada.length - 1].unidadesOcupadas;
}
