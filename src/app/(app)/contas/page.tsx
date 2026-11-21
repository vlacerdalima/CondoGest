import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@/components/gestao/carregando";
import { ExploradorContas } from "@/components/gestao/contas/explorador-contas";

export const metadata: Metadata = { title: "Contas" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando titulo="Contas" />}>
      <ExploradorContas />
    </Suspense>
  );
}
