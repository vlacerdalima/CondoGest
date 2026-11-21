import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,31,29,0.04)]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  titulo,
  descricao,
  acoes,
  className,
  icone,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icone && <div className="mt-0.5 shrink-0 text-muted">{icone}</div>}
        <div className="min-w-0">
          <h2 className="text-[0.95rem] font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-muted">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-t border-border px-5 py-3 text-sm text-muted", className)} {...props} />;
}
