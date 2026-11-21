import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatarPercentual } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/**
 * Bloco de KPI. `variacao` em % (ex.: 12.3). `bomQuando` define se subir é bom
 * (receita, economia) ou ruim (custo, consumo) — muda só a cor do delta, que
 * sempre vem com seta + texto.
 */
export function Stat({
  rotulo,
  valor,
  variacao,
  bomQuando = "cair",
  contexto,
  icone,
  destaque,
  className,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  variacao?: number;
  bomQuando?: "subir" | "cair";
  /** Texto curto abaixo do valor: "vs. mês anterior", "média de 12 meses"… */
  contexto?: ReactNode;
  icone?: ReactNode;
  destaque?: "energia" | "primario";
  className?: string;
}) {
  const temVariacao = variacao !== undefined && Number.isFinite(variacao);
  const neutro = temVariacao && Math.abs(variacao!) < 0.5;
  const bom = temVariacao && !neutro && (bomQuando === "subir" ? variacao! > 0 : variacao! < 0);
  const Seta = !temVariacao || neutro ? Minus : variacao! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-surface p-4",
        destaque === "energia" && "border-energy-strong/60 bg-energy-soft/40",
        destaque === "primario" && "border-primary/40 bg-primary-soft/40",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted">
        {icone && <span className="[&_svg]:size-4">{icone}</span>}
        <span className="truncate">{rotulo}</span>
      </div>
      <div className="tabular text-2xl font-semibold tracking-tight text-foreground">{valor}</div>
      {(temVariacao || contexto) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {temVariacao && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                neutro ? "text-muted" : bom ? "text-ok" : "text-critical",
              )}
            >
              <Seta className="size-3.5" aria-hidden />
              {formatarPercentual(variacao!, { sinal: true })}
            </span>
          )}
          {contexto && <span className="text-muted">{contexto}</span>}
        </div>
      )}
    </div>
  );
}
