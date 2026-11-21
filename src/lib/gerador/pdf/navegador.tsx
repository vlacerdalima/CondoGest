/**
 * Geração do PDF no NAVEGADOR. O motor do react-pdf (~1 MB) só é baixado
 * na primeira vez que alguém gera/baixa um PDF.
 */
import type { FaturaFicticia } from "../tipos";
import { DocumentoFatura } from "./documento";
import { prepararMotor } from "./primitivas";

let motor: Promise<typeof import("@react-pdf/renderer")> | null = null;

function carregarMotor() {
  if (!motor) {
    motor = import("@react-pdf/renderer").then((m) => {
      prepararMotor(m);
      return m;
    });
    motor.catch(() => {
      motor = null;
    });
  }
  return motor;
}

export async function gerarBlobPdf(fatura: FaturaFicticia): Promise<Blob> {
  const { pdf } = await carregarMotor();
  return pdf(<DocumentoFatura fatura={fatura} />).toBlob();
}

/** Dispara o download de um Blob com o nome indicado */
export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
