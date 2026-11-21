import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Info, Lightbulb, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import type { Severidade, StatusConta } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Tom = "neutro" | "primario" | "energia" | "ok" | "atencao" | "serio" | "critico";

const TONS: Record<Tom, string> = {
  neutro: "bg-surface-2 text-muted",
  primario: "bg-primary-soft text-primary",
  energia: "bg-energy-soft text-energy",
  ok: "bg-ok-soft text-ok",
  atencao: "bg-warn-soft text-warn",
  serio: "bg-serious-soft text-serious",
  critico: "bg-critical-soft text-critical",
};

export function Badge({ tom = "neutro", className, ...props }: ComponentProps<"span"> & { tom?: Tom }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
        TONS[tom],
        className,
      )}
      {...props}
    />
  );
}

/** Status de conta — sempre ícone + texto (cor nunca sozinha) */
const STATUS: Record<StatusConta, { rotulo: string; tom: Tom; icone: LucideIcon }> = {
  paga: { rotulo: "Paga", tom: "ok", icone: CheckCircle2 },
  a_vencer: { rotulo: "A vencer", tom: "neutro", icone: Clock },
  vence_em_breve: { rotulo: "Vence em breve", tom: "atencao", icone: AlertTriangle },
  vencida: { rotulo: "Vencida", tom: "critico", icone: AlertOctagon },
};

export function StatusBadge({ status, className }: { status: StatusConta; className?: string }) {
  const { rotulo, tom, icone: Icone } = STATUS[status];
  return (
    <Badge tom={tom} className={className}>
      <Icone aria-hidden />
      {rotulo}
    </Badge>
  );
}

/** Severidade de insight — sempre ícone + texto */
export const SEVERIDADES: Record<Severidade, { rotulo: string; tom: Tom; icone: LucideIcon }> = {
  info: { rotulo: "Informação", tom: "neutro", icone: Info },
  oportunidade: { rotulo: "Oportunidade", tom: "primario", icone: Lightbulb },
  atencao: { rotulo: "Atenção", tom: "atencao", icone: AlertTriangle },
  critico: { rotulo: "Crítico", tom: "critico", icone: AlertOctagon },
};

export function SeveridadeBadge({ severidade, className }: { severidade: Severidade; className?: string }) {
  const { rotulo, tom, icone: Icone } = SEVERIDADES[severidade];
  return (
    <Badge tom={tom} className={className}>
      <Icone aria-hidden />
      {rotulo}
    </Badge>
  );
}
