import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@/components/gestao/carregando";
import { CentralInsights } from "@/components/gestao/insights/central-insights";

export const metadata: Metadata = { title: "Insights" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando titulo="Insights" />}>
      <CentralInsights />
    </Suspense>
  );
}
