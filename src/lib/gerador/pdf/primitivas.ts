/**
 * Primitivas do react-pdf sem carregar o motor de renderização.
 *
 * No react-pdf, View/Text/Page/Document são só strings ("VIEW", "TEXT"…)
 * reexportadas por @react-pdf/renderer. Importá-las daqui deixa os layouts
 * leves e utilizáveis tanto no navegador (motor carregado sob demanda) quanto
 * no CLI com tsx (o motor é ESM-only e precisa de import() dinâmico lá).
 */
import * as P from "@react-pdf/primitives";
import type {
  Document as DocumentoRP,
  Page as PaginaRP,
  Styles,
  Text as TextoRP,
  View as VisaoRP,
} from "@react-pdf/renderer";

export const Document = P.Document as unknown as typeof DocumentoRP;
export const Page = P.Page as unknown as typeof PaginaRP;
export const View = P.View as unknown as typeof VisaoRP;
export const Text = P.Text as unknown as typeof TextoRP;

export type Estilo = Styles[string];

/** Equivalente ao StyleSheet.create (identidade tipada) */
export const criarEstilos = <T extends Styles>(estilos: T) => estilos;

/** Ajustes de fonte que precisam do motor carregado (sem hifenização automática) */
export function prepararMotor(motor: { Font: { registerHyphenationCallback: (cb: (palavra: string) => string[]) => void } }) {
  motor.Font.registerHyphenationCallback((palavra) => [palavra]);
}
