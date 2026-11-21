import type { Metadata } from "next";
import { PainelCarteira } from "@/components/gestao/painel/painel-carteira";

export const metadata: Metadata = { title: "Painel da carteira" };

export default function Pagina() {
  return <PainelCarteira />;
}
