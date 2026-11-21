/**
 * Gerador de contas fictícias de energia (núcleo puro, determinístico).
 * O PDF fica em ./pdf (importar só quando for gerar o documento).
 */
export * from "./tipos";
export { gerarFaturas, listarFaturas, bandeirasDoCiclo } from "./fatura";
export { faturaParaConta, codificarMetadados, decodificarMetadados, nomeArquivoPdf, PREFIXO_METADADOS } from "./conta";
export {
  COMPETENCIA_MAXIMA,
  COMPETENCIA_MINIMA,
  SEMENTE_PADRAO,
  competenciaValida,
  contextoDaUc,
  mesDaSerie,
} from "./serie";
export { PERFIS_DEMO } from "./perfis";
export { ADICIONAL_BANDEIRA, BANDEIRAS, ROTULO_BANDEIRA, bandeiraDoMesCivil } from "./tarifas";
export { DISTRIBUIDORA, COMERCIALIZADORA } from "./emissores";
