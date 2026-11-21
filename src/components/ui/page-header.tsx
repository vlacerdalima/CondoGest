import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descricao,
  acoes,
  sobretitulo,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  sobretitulo?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-6", className)}>
      <div className="min-w-0">
        {sobretitulo && <div className="mb-1 text-sm font-medium text-muted">{sobretitulo}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-3xl text-[0.95rem] text-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center",
        className,
      )}
    >
      {icone && <div className="mb-1 text-subtle [&_svg]:size-8">{icone}</div>}
      <p className="font-semibold text-foreground">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-muted">{descricao}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

/** Estilo padrão para <select>, <input> e <textarea> nativos */
export const estiloCampo =
  "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-60";

export function Rotulo({ children, htmlFor, dica }: { children: ReactNode; htmlFor?: string; dica?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-foreground">
      <span>{children}</span>
      {dica && <span className="text-xs font-normal text-muted">{dica}</span>}
    </label>
  );
}
