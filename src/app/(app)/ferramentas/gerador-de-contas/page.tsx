import type { Metadata } from "next";
import { ComoTestar } from "@/components/gerador/como-testar";
import { GeradorDeContas } from "@/components/gerador/gerador-de-contas";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Gerador de contas" };

export default function Pagina() {
  return (
    <div className="space-y-6">
      <PageHeader
        className="pb-0"
        sobretitulo={
          <span className="inline-flex items-center gap-2">
            Ferramentas <Badge tom="atencao">Simulação</Badge>
          </span>
        }
        titulo="Gerador de contas fictícias"
        descricao="Enquanto temos poucas faturas de verdade, este gerador cria contas de energia realistas para testar a plataforma: mesmo formato das faturas da distribuidora e da comercializadora, números coerentes com o histórico de cada condomínio. Tudo sai marcado como simulação."
      />
      <GeradorDeContas />
      <ComoTestar />
    </div>
  );
}
