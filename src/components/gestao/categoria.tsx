import {
  ArrowUpDown,
  Briefcase,
  Droplets,
  Flame,
  Package,
  ShieldCheck,
  Sparkles,
  Umbrella,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Categoria } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const ICONES_CATEGORIA: Record<Categoria | "geral", LucideIcon> = {
  energia: Zap,
  agua: Droplets,
  gas: Flame,
  manutencao: Wrench,
  limpeza: Sparkles,
  seguranca: ShieldCheck,
  elevadores: ArrowUpDown,
  pessoal: Users,
  administracao: Briefcase,
  seguros: Umbrella,
  outros: Package,
  geral: Briefcase,
};

/** Ícone da categoria num quadrado suave (energia ganha o destaque âmbar) */
export function IconeCategoria({
  categoria,
  tamanho = "md",
  className,
}: {
  categoria: Categoria | "geral";
  tamanho?: "sm" | "md";
  className?: string;
}) {
  const Icone = ICONES_CATEGORIA[categoria];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        tamanho === "sm" ? "size-7 [&_svg]:size-3.5" : "size-9 [&_svg]:size-4",
        categoria === "energia" ? "bg-energy-soft text-energy" : "bg-surface-2 text-muted",
        className,
      )}
    >
      <Icone />
    </span>
  );
}

/** Ícone + nome da categoria, em linha */
export function RotuloCategoria({ categoria, className }: { categoria: Categoria; className?: string }) {
  const Icone = ICONES_CATEGORIA[categoria];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <Icone className={cn("size-3.5", categoria === "energia" ? "text-energy" : "text-subtle")} aria-hidden />
      {ROTULOS_CATEGORIA[categoria]}
    </span>
  );
}
