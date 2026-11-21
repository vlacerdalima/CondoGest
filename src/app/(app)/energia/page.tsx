import type { Metadata } from "next";
import { VisaoCarteiraEnergia } from "@/components/energia/visao-carteira";

export const metadata: Metadata = {
  title: "Energia",
  description: "Consumo de energia por dia, linha de base, alertas e recomendações com número para a carteira.",
};

export default function Pagina() {
  return <VisaoCarteiraEnergia />;
}
