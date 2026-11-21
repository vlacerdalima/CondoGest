import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatarPercentual } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/**
 * Delta percentual com seta + texto (cor nunca sozinha). Para custos, subir é
 * ruim (`bomQuando="cair"`, padrão).
 */
export function Variacao({
  valor,
  bomQuando = "cair",
  className,
  rotulo,
}: {
  valor?: number;
  bomQuando?: "subir" | "cair";
  className?: string;
  /** Texto após o número: "vs. out/26" */
  rotulo?: string;
}) {
  if (valor === undefined || !Number.isFinite(valor)) {
    return <span className={cn("text-xs text-subtle", className)}>sem base de comparação</span>;
  }
  const neutro = Math.abs(valor) < 0.5;
  const bom = !neutro && (bomQuando === "subir" ? valor > 0 : valor < 0);
  const Seta = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", className)}>
      <span
        className={cn(
          "tabular inline-flex items-center gap-0.5 font-medium",
          neutro ? "text-muted" : bom ? "text-ok" : "text-critical",
        )}
      >
        <Seta className="size-3.5" aria-hidden />
        {formatarPercentual(valor, { sinal: true })}
      </span>
      {rotulo && <span className="text-muted">{rotulo}</span>}
    </span>
  );
}
