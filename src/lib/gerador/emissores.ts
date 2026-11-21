/**
 * Empresas emissoras FICTÍCIAS. Documentos com dígitos "XX" e CEP 00000-000
 * de propósito: nenhum número aqui é válido ou pertence a alguém.
 */
import { COMERCIALIZADORA_FICTICIA, DISTRIBUIDORA_FICTICIA } from "../dados/condominios";
import type { Empresa } from "./tipos";

export const DISTRIBUIDORA: Empresa = {
  nome: DISTRIBUIDORA_FICTICIA,
  nomeCurto: "EnerLitoral",
  documento: "CNPJ 11.111.111/0001-XX (fictício)",
  inscricaoEstadual: "Insc. Est. 000.000-XX (fictícia)",
  endereco: "Av. das Marés Fictícias, 1000 · Recife/PE · CEP 00000-000",
  atendimento: "Central de atendimento (fictícia): 0800 000 0000",
};

export const COMERCIALIZADORA: Empresa = {
  nome: COMERCIALIZADORA_FICTICIA,
  nomeCurto: "Alísio",
  documento: "CNPJ 22.222.222/0001-XX (fictício)",
  inscricaoEstadual: "Insc. Est. 000.000-XX (fictícia)",
  endereco: "Rua dos Ventos Alísios, 200, sala 1 · Recife/PE · CEP 00000-000",
  atendimento: "Atendimento ao cliente livre (fictício): 0800 000 0001",
};

/** CNPJ fictício do cliente, estável por chave */
export function documentoFicticioCliente(indice: number) {
  const n = String(30 + (indice % 70)).padStart(2, "0");
  return `CNPJ ${n}.${n}${n[0]}.${n}${n[1]}/0001-XX (fictício)`;
}
