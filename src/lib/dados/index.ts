/**
 * Camada de dados do MVP (sem banco de dados).
 *
 * Fonte da verdade = contas de demonstração (determinísticas, geradas no
 * carregamento do módulo — iguais no servidor e no navegador) + contas que o
 * gestor enviou pela tela "Enviar conta" (guardadas no navegador; ver ./store).
 *
 * Para trocar por um banco depois: implementar as mesmas funções lendo do
 * banco. As telas só usam estas funções e os hooks de ./store.
 */
import type { Categoria, Conta, StatusConta } from "../tipos";
import { DATA_REFERENCIA, diferencaEmDias } from "./referencia";
import { gerarContasEnergiaDemo } from "./seed-energia";
import { gerarContasGeraisDemo } from "./seed-geral";

export * from "./condominios";
export * from "./referencia";

let contasDemoCache: Conta[] | null = null;

/** Todas as contas de demonstração (memoizado) */
export function obterContasDemo(): Conta[] {
  if (!contasDemoCache) {
    contasDemoCache = [...gerarContasEnergiaDemo(), ...gerarContasGeraisDemo()].sort((a, b) =>
      a.vencimento.localeCompare(b.vencimento),
    );
  }
  return contasDemoCache;
}

/** Dias antes do vencimento em que a conta passa a "vence em breve" */
export const DIAS_ALERTA_VENCIMENTO = 7;

export function statusDaConta(conta: Conta, hoje = DATA_REFERENCIA): StatusConta {
  if (conta.pagaEm) return "paga";
  const dias = diferencaEmDias(hoje, conta.vencimento);
  if (dias < 0) return "vencida";
  if (dias <= DIAS_ALERTA_VENCIMENTO) return "vence_em_breve";
  return "a_vencer";
}

export function filtrarContas(
  contas: Conta[],
  filtro: { condominioId?: string; categoria?: Categoria; competencia?: string } = {},
) {
  return contas.filter(
    (c) =>
      (!filtro.condominioId || c.condominioId === filtro.condominioId) &&
      (!filtro.categoria || c.categoria === filtro.categoria) &&
      (!filtro.competencia || c.competencia === filtro.competencia),
  );
}

/** Soma de valores por competência → [{ competencia, valor }] em ordem crescente */
export function totalPorCompetencia(contas: Conta[]) {
  const mapa = new Map<string, number>();
  for (const c of contas) mapa.set(c.competencia, (mapa.get(c.competencia) ?? 0) + c.valor);
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([competencia, valor]) => ({ competencia, valor: Math.round(valor * 100) / 100 }));
}
