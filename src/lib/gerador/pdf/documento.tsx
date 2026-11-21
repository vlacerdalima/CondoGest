/**
 * Documento PDF de uma fatura fictícia (react-pdf). Funciona no navegador
 * (`pdf(<DocumentoFatura/>).toBlob()`) e no Node (`renderToFile`).
 *
 * Metadados legíveis por máquina: keywords = "condogest-simulacao:v1:" +
 * base64(JSON da conta). A tela "Enviar conta" lê isso de volta (extracao.ts).
 */
import { codificarMetadados, faturaParaConta } from "../conta";
import type { FaturaFicticia } from "../tipos";
import { TEXTO_SIMULACAO } from "./componentes";
import { PaginasFaturaComercializadora } from "./fatura-comercializadora";
import { PaginaFaturaDistribuidora } from "./fatura-distribuidora";
import { refMesAno } from "./formato";
import { Document } from "./primitivas";

export function DocumentoFatura({ fatura }: { fatura: FaturaFicticia }) {
  const conta = faturaParaConta(fatura);
  const tipo = fatura.tipo === "comercializadora_livre" ? "Fatura da comercializadora" : "Fatura de energia";
  return (
    <Document
      title={`${tipo} ${refMesAno(fatura.competencia)} — UC ${fatura.uc.numeroUc} — SIMULAÇÃO`}
      author="CondoGest (simulador)"
      subject={`${TEXTO_SIMULACAO}. Conta fictícia para testes da plataforma CondoGest.`}
      keywords={codificarMetadados(conta, fatura.uc.numeroUc)}
      creator="CondoGest — Gerador de contas fictícias"
      producer="CondoGest (simulação)"
      language="pt-BR"
    >
      {fatura.tipo === "comercializadora_livre" ? (
        <PaginasFaturaComercializadora fatura={fatura} />
      ) : (
        <PaginaFaturaDistribuidora fatura={fatura} />
      )}
    </Document>
  );
}
