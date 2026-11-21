import { ArrowRight, PiggyBank } from "lucide-react";
import Link from "next/link";
import { SEVERIDADES, SeveridadeBadge } from "@/components/ui/badge";
import { obterCondominio } from "@/lib/dados";
import { ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Insight } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ICONES_CATEGORIA } from "./categoria";
import { formatarImpacto } from "./formato";

const FAIXA_SEVERIDADE: Record<Insight["severidade"], string> = {
  critico: "bg-critical",
  atencao: "bg-warn",
  oportunidade: "bg-primary",
  info: "bg-border-strong",
};

const ICONE_SEVERIDADE: Record<Insight["severidade"], string> = {
  critico: "bg-critical-soft text-critical",
  atencao: "bg-warn-soft text-warn",
  oportunidade: "bg-primary-soft text-primary",
  info: "bg-surface-2 text-muted",
};

/** Insight em lista compacta (Painel, detalhe do condomínio) */
export function ItemInsightCompacto({ insight, mostrarCondominio = true }: { insight: Insight; mostrarCondominio?: boolean }) {
  const { icone: Icone } = SEVERIDADES[insight.severidade];
  const condominio = insight.condominioId ? obterCondominio(insight.condominioId) : undefined;
  const conteudo = (
    <>
      <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5", ICONE_SEVERIDADE[insight.severidade])}>
        <Icone aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="shrink-0 font-medium">{SEVERIDADES[insight.severidade].rotulo}</span>
          {mostrarCondominio && condominio && <span className="min-w-0 truncate">· {condominio.nome}</span>}
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-foreground group-hover:text-primary">{insight.titulo}</span>
        {insight.impactoMensal && (
          <span className="tabular mt-0.5 block text-xs text-muted">
            Impacto estimado: {formatarImpacto(insight.impactoMensal)}/mês
          </span>
        )}
      </span>
      {insight.href && <ArrowRight className="mt-1 size-4 shrink-0 text-subtle group-hover:text-primary" aria-hidden />}
    </>
  );
  const classe = "group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors";
  return insight.href ? (
    <Link
      href={insight.href}
      className={cn(classe, "hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary")}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Insight completo (tela de Insights) */
export function CartaoInsight({ insight }: { insight: Insight }) {
  const condominio = insight.condominioId ? obterCondominio(insight.condominioId) : undefined;
  const IconeCat = ICONES_CATEGORIA[insight.categoria];
  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-surface p-5 pl-6 shadow-[0_1px_2px_rgba(15,31,29,0.04)]">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", FAIXA_SEVERIDADE[insight.severidade])} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <SeveridadeBadge severidade={insight.severidade} />
        <span className="inline-flex items-center gap-1">
          <IconeCat className={cn("size-3.5", insight.categoria === "energia" ? "text-energy" : "text-subtle")} aria-hidden />
          {insight.categoria === "geral" ? "Geral" : ROTULOS_CATEGORIA[insight.categoria]}
        </span>
        <span aria-hidden>·</span>
        <span>{condominio ? condominio.nome : "Carteira toda"}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{insight.titulo}</h3>
      <p className="mt-1 text-sm text-muted">{insight.descricao}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {insight.impactoMensal ? (
          <span className="tabular inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary">
            <PiggyBank className="size-4" aria-hidden />
            {formatarImpacto(insight.impactoMensal)}/mês
          </span>
        ) : (
          <span className="text-xs text-subtle">Sem estimativa de impacto em R$</span>
        )}
        {insight.href && (
          <Link
            href={insight.href}
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Ver detalhes
            <ArrowRight className="size-4" aria-hidden />
            <span className="sr-only">: {insight.titulo}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
