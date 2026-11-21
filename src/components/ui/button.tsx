import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variante = "primaria" | "secundaria" | "contorno" | "fantasma" | "energia" | "perigo";
type Tamanho = "sm" | "md" | "lg" | "icone";

const VARIANTES: Record<Variante, string> = {
  primaria: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secundaria: "bg-surface-2 text-foreground hover:bg-border",
  contorno: "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
  fantasma: "text-muted hover:bg-surface-2 hover:text-foreground",
  energia: "bg-energy-strong text-[#2b1d00] hover:brightness-95",
  perigo: "bg-critical text-white hover:brightness-95",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icone: "size-9",
};

export function estiloBotao(variante: Variante = "primaria", tamanho: Tamanho = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTES[variante],
    TAMANHOS[tamanho],
    className,
  );
}

export function Button({
  variante = "primaria",
  tamanho = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamanho?: Tamanho }) {
  return <button type={type} className={estiloBotao(variante, tamanho, className)} {...props} />;
}

export function ButtonLink({
  variante = "primaria",
  tamanho = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamanho?: Tamanho }) {
  return <Link className={estiloBotao(variante, tamanho, className)} {...props} />;
}
