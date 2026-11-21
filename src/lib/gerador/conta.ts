/**
 * Conversão da fatura rica → contrato `Conta` (src/lib/tipos.ts) e
 * metadados legíveis por máquina embutidos no PDF.
 *
 * Metadados: keywords (e subject) do PDF =
 *   "condogest-simulacao:v1:" + base64(JSON da conta sem id/origem/enviadaEm + numeroUc)
 */
import type { DetalheEnergia, ItemFatura } from "../tipos";
import type { FaturaFicticia, NovaContaEnergia } from "./tipos";

export const PREFIXO_METADADOS = "condogest-simulacao:v1:";

function semIndefinidos<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function descricaoDaConta(f: FaturaFicticia) {
  if (f.tipoFatura === "distribuicao") return `Energia (distribuição) — ${f.uc.apelido}`;
  if (f.tipoFatura === "energia_livre") return `Energia (mercado livre) — ${f.uc.apelido}`;
  return `Energia — ${f.uc.apelido}`;
}

export function faturaParaConta(
  f: FaturaFicticia,
  extra: { observacoes?: string; arquivoNome?: string } = {},
): NovaContaEnergia {
  const a4 = f.uc.subgrupo === "A4";
  const tributo = (t: "PIS" | "COFINS" | "ICMS") => f.tributos.find((x) => x.tributo === t)?.valor ?? 0;
  const itens: ItemFatura[] = f.itens.map((i) =>
    semIndefinidos({
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      valor: i.valor,
    }),
  );
  const energia: DetalheEnergia = semIndefinidos({
    ucId: f.uc.id,
    tipoFatura: f.tipoFatura,
    leituraAnterior: f.leituraAnterior,
    leituraAtual: f.leituraAtual,
    dias: f.dias,
    consumoKwh: f.consumoKwh,
    consumoPontaKwh: a4 ? f.consumoPontaKwh : undefined,
    consumoForaPontaKwh: a4 ? f.consumoForaPontaKwh : undefined,
    demandaContratadaKw: a4 ? f.uc.demandaContratadaKw : undefined,
    demandaMedidaKw: a4 ? f.demandaMedidaKw : undefined,
    demandaMedidaPontaKw: a4 ? f.demandaMedidaPontaKw : undefined,
    reativoExcedenteKvarh: a4 ? f.reativoExcedenteKvarh : undefined,
    bandeira: f.bandeira,
    itens,
    tributos: { pis: tributo("PIS"), cofins: tributo("COFINS"), icms: tributo("ICMS") },
    precoEnergiaLivreMwh:
      f.tipo === "comercializadora_livre"
        ? f.energia.precoMwhSemIcms
        : f.tipo === "a4_verde_livre_distribuicao"
          ? f.precoEnergiaLivreMwh
          : undefined,
    custoEquivalenteCativo: f.tipo === "a4_verde_livre_distribuicao" ? f.custoEquivalenteCativo : undefined,
  });
  return semIndefinidos({
    condominioId: f.uc.condominioId,
    categoria: "energia" as const,
    fornecedor: f.emissor.nome,
    descricao: descricaoDaConta(f),
    competencia: f.competencia,
    emissao: f.emissao,
    vencimento: f.vencimento,
    valor: f.total,
    energia,
    observacoes: extra.observacoes,
    arquivoNome: extra.arquivoNome,
  });
}

/* ------------------------------ metadados ------------------------------ */

function paraBase64(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

function deBase64(b64: string) {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Texto para keywords/subject do PDF */
export function codificarMetadados(conta: NovaContaEnergia, numeroUc: string) {
  return PREFIXO_METADADOS + paraBase64(JSON.stringify({ ...conta, numeroUc }));
}

export type ContaDosMetadados = NovaContaEnergia & { numeroUc: string };

/**
 * Lê os metadados de simulação. Devolve null se o texto não tem o prefixo;
 * lança erro se tem o prefixo mas o conteúdo está corrompido.
 */
export function decodificarMetadados(texto: string | undefined | null): ContaDosMetadados | null {
  if (!texto) return null;
  const inicio = texto.indexOf(PREFIXO_METADADOS);
  if (inicio < 0) return null;
  const b64 = texto.slice(inicio + PREFIXO_METADADOS.length).trim().split(/\s/)[0];
  const dados = JSON.parse(deBase64(b64)) as Partial<ContaDosMetadados>;
  const valido =
    typeof dados === "object" &&
    dados !== null &&
    dados.categoria === "energia" &&
    typeof dados.competencia === "string" &&
    /^\d{4}-\d{2}$/.test(dados.competencia) &&
    typeof dados.vencimento === "string" &&
    typeof dados.valor === "number" &&
    typeof dados.fornecedor === "string" &&
    typeof dados.numeroUc === "string" &&
    typeof dados.energia === "object" &&
    dados.energia !== null &&
    Array.isArray(dados.energia.itens);
  if (!valido) throw new Error("Metadados de simulação com formato inesperado");
  return dados as ContaDosMetadados;
}

/** "conta-ficticia-7004118377-1-2026-12.pdf" */
export function nomeArquivoPdf(f: FaturaFicticia) {
  const uc = f.uc.numeroUc.replace(/[^\dA-Za-z-]/g, "");
  const sufixo = f.tipoFatura === "energia_livre" ? "-comercializadora" : f.tipoFatura === "distribuicao" ? "-distribuicao" : "";
  return `conta-ficticia-${uc}-${f.competencia}${sufixo}.pdf`;
}
