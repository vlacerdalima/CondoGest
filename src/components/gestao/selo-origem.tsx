import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Conta } from "@/lib/tipos";

/** Selo para contas que o gestor enviou pela tela "Enviar conta" */
export function SeloOrigem({ conta, className }: { conta: Pick<Conta, "origem">; className?: string }) {
  if (conta.origem !== "envio") return null;
  return (
    <Badge tom="primario" className={className}>
      <Upload aria-hidden />
      Enviada por você
    </Badge>
  );
}
