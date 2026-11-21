"use client";

import { ChevronRight, LineChart, MessageSquareQuote, Presentation } from "lucide-react";
import Link from "next/link";
import type { RecomendacaoEnergia } from "@/lib/analise/energia";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { faixaKwh, faixaMeses, faixaReais } from "./formato";
import { Termo } from "./glossario";

const ESFORCO = { baixo: "Esforço baixo", medio: "Esforço médio", alto: "Esforço alto" } as const;

function Linha({ rotulo, children }: { rotulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="tabular mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function efeitoNoConsumo(rec: RecomendacaoEnergia) {
  if (rec.economiaMensalKwh) return `${faixaKwh(rec.economiaMensalKwh)}/mês a menos`;
  if (rec.kwhDeslocadosMes) return `Muda de horário ${faixaKwh(rec.kwhDeslocadosMes)}/mês`;
  return "Não muda o consumo: reduz o valor pago";
}

export function CartaoRecomendacao({
  rec,
  onSimular,
  hrefAssembleia,
  className,
}: {
  rec: RecomendacaoEnergia;
  onSimular?: (rec: RecomendacaoEnergia) => void;
  hrefAssembleia?: string;
  className?: string;
}) {
  const anual = { min: rec.economiaMensalReais.min * 12, max: rec.economiaMensalReais.max * 12 };
  const semInvestimento = !rec.investimentoReais || rec.investimentoReais.max <= 0;
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-surface",
        rec.prioridade === 1 ? "border-energy-strong/70 shadow-[0_0_0_1px_var(--energy-soft)]" : "border-border",
        className,
      )}
      aria-labelledby={`rec-${rec.id}`}
    >
      <header className="flex flex-col gap-2 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-full px-2 text-xs font-bold",
              rec.prioridade === 1 ? "bg-energy-strong text-[#2b1d00]" : "bg-surface-2 text-foreground",
            )}
          >
            Prioridade {rec.prioridade}
          </span>
          <Badge>{ESFORCO[rec.esforco]}</Badge>
          {rec.ucApelido && <Badge tom="primario">{rec.ucApelido.replace(/^.*—\s*/, "")}</Badge>}
        </div>
        <h3 id={`rec-${rec.id}`} className="text-base leading-snug font-semibold text-foreground">
          {rec.titulo}
        </h3>
        <p className="text-sm text-muted">{rec.descricao}</p>
      </header>

      <div className="mx-4 rounded-lg bg-energy-soft/60 px-4 py-3">
        <p className="text-xs font-medium text-muted">Economia estimada</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {faixaReais(rec.economiaMensalReais)}
          <span className="text-sm font-medium text-muted"> /mês</span>
        </p>
        <p className="text-xs text-muted">{faixaReais(anual)} por ano</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
        <Linha rotulo="Consumo (kWh)">{efeitoNoConsumo(rec)}</Linha>
        <Linha rotulo="Investimento">{semInvestimento ? "Sem investimento" : faixaReais(rec.investimentoReais!)}</Linha>
        <Linha rotulo={<Termo id="payback">Retorno</Termo>}>{rec.paybackMeses ? faixaMeses(rec.paybackMeses) : "Imediato"}</Linha>
        <Linha rotulo="Quando aparece na conta">{rec.prazo}</Linha>
      </dl>

      <div className="flex flex-col gap-2 px-4 pb-4">
        <details className="group rounded-lg border border-border" open={rec.prioridade === 1}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-foreground marker:hidden focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            <MessageSquareQuote className="size-4 text-energy" aria-hidden />
            Explicação em 1 minuto
            <ChevronRight className="ml-auto size-4 text-muted transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <p className="px-3 pb-3 text-sm leading-relaxed text-foreground">{rec.explicacao}</p>
        </details>
        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            Premissas e conta ({rec.premissas.length + 1})
            <ChevronRight className="ml-auto size-4 text-muted transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="px-3 pb-3">
            <p className="mb-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-foreground">
              <span className="font-semibold">A conta: </span>
              {rec.calculo}.
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              {rec.premissas.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        </details>
      </div>

      {(onSimular || hrefAssembleia) && (
        <footer className="mt-auto flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {onSimular && (
            <Button variante="contorno" tamanho="sm" onClick={() => onSimular(rec)}>
              <LineChart aria-hidden />
              Comprovar antes/depois
            </Button>
          )}
          {hrefAssembleia && (
            <ButtonLink variante="fantasma" tamanho="sm" href={hrefAssembleia}>
              <Presentation aria-hidden />
              Levar à assembleia
            </ButtonLink>
          )}
        </footer>
      )}
    </article>
  );
}

/** Linha compacta para listas (carteira) */
export function ItemRecomendacao({
  rec,
  condominioNome,
  href,
}: {
  rec: RecomendacaoEnergia;
  condominioNome?: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-lg px-3 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          {condominioNome && <p className="text-xs font-medium text-muted">{condominioNome}</p>}
          <p className="font-medium text-foreground">{rec.titulo}</p>
          <p className="text-xs text-muted">
            {ESFORCO[rec.esforco]} ·{" "}
            {!rec.investimentoReais || rec.investimentoReais.max <= 0
              ? "sem investimento"
              : `investimento ${faixaReais(rec.investimentoReais)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:text-right">
          <span className="tabular font-semibold whitespace-nowrap text-foreground">
            {faixaReais(rec.economiaMensalReais)}
            <span className="text-xs font-normal text-muted">/mês</span>
          </span>
          <ChevronRight className="size-4 text-muted group-hover:text-foreground" aria-hidden />
        </div>
      </Link>
    </li>
  );
}
