import type { Metadata } from "next";
import { ListaCondominios } from "@/components/gestao/condominios/lista-condominios";

export const metadata: Metadata = { title: "Condomínios" };

export default function Pagina() {
  return <ListaCondominios />;
}
