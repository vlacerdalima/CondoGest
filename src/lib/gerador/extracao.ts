/**
 * Extração automática de dados de uma conta enviada (PDF/imagem).
 *
 * DONO: agente "Gerador" — STUB provisório da fundação.
 * Manter a assinatura. Roda no NAVEGADOR (recebe um File do input/drag&drop).
 * A tela "Enviar conta" chama esta função e, conforme o resultado, pré-preenche
 * o formulário de revisão (reconhecido/parcial) ou abre o formulário manual.
 */
import type { ResultadoExtracao } from "../tipos";

export async function extrairDadosDaConta(arquivo: File): Promise<ResultadoExtracao> {
  return {
    status: "nao_reconhecido",
    motivo: `Não foi possível ler "${arquivo.name}" automaticamente. Preencha os dados manualmente.`,
  };
}
