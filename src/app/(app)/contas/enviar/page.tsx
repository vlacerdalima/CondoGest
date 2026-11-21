import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando } from "@/components/gestao/carregando";
import { FluxoEnvio } from "@/components/gestao/envio/fluxo-envio";

export const metadata: Metadata = { title: "Enviar conta" };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando titulo="Enviar conta" />}>
      <FluxoEnvio />
    </Suspense>
  );
}
