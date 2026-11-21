/**
 * Extração automática de dados de uma conta enviada (PDF/imagem).
 *
 * DONO: agente "Gerador".
 * Roda no NAVEGADOR (recebe um File do input/drag&drop). A tela "Enviar
 * conta" chama esta função e, conforme o resultado, pré-preenche o formulário
 * de revisão (reconhecido/parcial) ou abre o formulário manual.
 *
 * Nesta versão só lemos as contas SIMULADAS pelo CondoGest: o PDF gerado traz
 * a conta inteira nos metadados (keywords/subject = "condogest-simulacao:v1:"
 * + base64(JSON)). Leitura de faturas reais (texto/OCR) fica para depois.
 */
import { UNIDADES_CONSUMIDORAS } from "../dados/condominios";
import type { ResultadoExtracao } from "../tipos";
import { decodificarMetadados, PREFIXO_METADADOS, type ContaDosMetadados } from "./conta";

const FONTE = "Conta simulada CondoGest (metadados do PDF)";
const PROXIMA_VERSAO =
  "A leitura automática de contas de outras origens chega na próxima versão. Por enquanto, preencha os campos abaixo.";

function ehPdf(arquivo: File, inicio: Uint8Array) {
  const assinatura = String.fromCharCode(...inicio.subarray(0, 5));
  return assinatura === "%PDF-" || arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name);
}

function ehImagem(arquivo: File) {
  return arquivo.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i.test(arquivo.name);
}

async function lerMetadadosPdf(bytes: Uint8Array): Promise<string[]> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return [doc.getKeywords(), doc.getSubject()].filter((t): t is string => Boolean(t));
}

function paraResultado(dados: ContaDosMetadados, arquivoNome: string): ResultadoExtracao {
  const { numeroUc, ...conta } = dados;
  const uc = UNIDADES_CONSUMIDORAS.find((u) => u.numeroUc === numeroUc);
  if (uc) {
    return {
      status: "reconhecido",
      fonte: FONTE,
      conta: {
        ...conta,
        condominioId: uc.condominioId,
        arquivoNome,
        energia: { ...conta.energia, ucId: uc.id },
      },
    };
  }
  // UC avulsa (fora da carteira): devolve os dados, mas o gestor escolhe o condomínio e a UC
  const { condominioId: _condominio, ...semCondominio } = conta;
  void _condominio;
  return {
    status: "parcial",
    fonte: FONTE,
    aviso: `A unidade consumidora nº ${numeroUc} não está cadastrada na carteira. Escolha o condomínio e a unidade consumidora antes de salvar; os demais dados foram lidos da conta simulada.`,
    campos: {
      ...semCondominio,
      arquivoNome,
      observacoes: [conta.observacoes, `UC nº ${numeroUc} (fora da carteira)`].filter(Boolean).join(" · "),
      energia: { ...conta.energia, ucId: "" },
    },
  };
}

export async function extrairDadosDaConta(arquivo: File): Promise<ResultadoExtracao> {
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (bytes.length === 0) {
      return { status: "nao_reconhecido", motivo: `O arquivo "${arquivo.name}" está vazio. Envie a conta de novo ou preencha os campos.` };
    }

    if (ehPdf(arquivo, bytes)) {
      let textos: string[];
      try {
        textos = await lerMetadadosPdf(bytes);
      } catch {
        return {
          status: "nao_reconhecido",
          motivo: `Não conseguimos abrir "${arquivo.name}": o PDF parece corrompido ou protegido. Confira o arquivo ou preencha os campos abaixo.`,
        };
      }
      const comPrefixo = textos.find((t) => t.includes(PREFIXO_METADADOS));
      if (!comPrefixo) return { status: "nao_reconhecido", motivo: PROXIMA_VERSAO };
      let dados: ContaDosMetadados | null;
      try {
        dados = decodificarMetadados(comPrefixo);
      } catch {
        return {
          status: "nao_reconhecido",
          motivo: "Este PDF parece uma conta simulada do CondoGest, mas os dados embutidos estão incompletos. Gere a conta de novo ou preencha os campos abaixo.",
        };
      }
      if (!dados) return { status: "nao_reconhecido", motivo: PROXIMA_VERSAO };
      return paraResultado(dados, arquivo.name);
    }

    if (ehImagem(arquivo)) {
      return {
        status: "nao_reconhecido",
        motivo: "A leitura automática de fotos de contas chega na próxima versão. Por enquanto, preencha os campos abaixo.",
      };
    }

    return {
      status: "nao_reconhecido",
      motivo: `Formato de "${arquivo.name}" não reconhecido. Envie a conta em PDF ou foto (JPG/PNG), ou preencha os campos abaixo.`,
    };
  } catch {
    return {
      status: "nao_reconhecido",
      motivo: `Não foi possível ler "${arquivo.name}". Preencha os campos abaixo.`,
    };
  }
}
