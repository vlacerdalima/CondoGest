"use client";

/**
 * Peças comuns dos gráficos de energia (Recharts):
 *  - quadro com legenda e alternância "ver dados em tabela";
 *  - tooltip com valores em destaque e chave de linha/barra;
 *  - eixos e grade discretos (tokens --chart-grid / --chart-axis).
 */
import { BarChart3, Table2 } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const assinarNada = () => () => {};

/** true só no navegador (Recharts mede o contêiner; no servidor mostramos um espaço reservado) */
export function useMontado() {
  return useSyncExternalStore(
    assinarNada,
    () => true,
    () => false,
  );
}

export type FormaLegenda = "linha" | "tracejado" | "barra" | "faixa" | "ponto";

export interface ItemLegenda {
  rotulo: ReactNode;
  cor: string;
  forma: FormaLegenda;
}

export function ChaveCor({ cor, forma, className }: { cor: string; forma: FormaLegenda; className?: string }) {
  if (forma === "linha" || forma === "tracejado")
    return (
      <svg width="18" height="8" className={cn("shrink-0", className)} aria-hidden>
        <line
          x1="1"
          y1="4"
          x2="17"
          y2="4"
          stroke={cor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={forma === "tracejado" ? "4 3" : undefined}
        />
      </svg>
    );
  if (forma === "ponto")
    return (
      <span
        className={cn("inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface", className)}
        style={{ background: cor }}
        aria-hidden
      />
    );
  return (
    <span
      className={cn("inline-block h-2.5 w-3 shrink-0 rounded-[3px]", forma === "faixa" && "opacity-40", className)}
      style={{ background: cor }}
      aria-hidden
    />
  );
}

export function Legenda({ itens, className }: { itens: ItemLegenda[]; className?: string }) {
  if (!itens.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted", className)}>
      {itens.map((item, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <ChaveCor cor={item.cor} forma={item.forma} />
          <span>{item.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}

export interface LinhaTooltip {
  rotulo: ReactNode;
  valor: ReactNode;
  cor?: string;
  forma?: FormaLegenda;
  /** Linha secundária (texto mais discreto) */
  discreta?: boolean;
}

export function CaixaTooltip({ titulo, linhas, rodape }: { titulo: ReactNode; linhas: LinhaTooltip[]; rodape?: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {linhas.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted">
              {l.cor && <ChaveCor cor={l.cor} forma={l.forma ?? "linha"} />}
              {l.rotulo}
            </span>
            <span className={cn("tabular font-semibold", l.discreta ? "text-muted" : "text-foreground")}>{l.valor}</span>
          </li>
        ))}
      </ul>
      {rodape && <div className="mt-1.5 border-t border-border pt-1.5 text-muted">{rodape}</div>}
    </div>
  );
}

/** Conteúdo de tooltip do Recharts que entrega a linha de dados (payload) para um renderizador */
export function conteudoTooltip<T>(render: (linha: T) => ReactNode) {
  return (props: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => {
    const linha = props.active ? (props.payload?.[0]?.payload as T | undefined) : undefined;
    return linha ? render(linha) : null;
  };
}

export interface TabelaDados {
  colunas: string[];
  linhas: ReactNode[][];
  /** Índices das colunas numéricas (alinhadas à direita) */
  numericas?: number[];
}

export function Tabela({ tabela, legenda }: { tabela: TabelaDados; legenda?: string }) {
  const numericas = new Set(tabela.numericas ?? tabela.colunas.map((_, i) => i).filter((i) => i > 0));
  return (
    <div className="relative max-h-96 overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
          <tr>
            {tabela.colunas.map((c, i) => (
              <th key={c} scope="col" className={cn("px-3 py-2 font-medium whitespace-nowrap", numericas.has(i) ? "text-right" : "text-left")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {tabela.linhas.map((linha, i) => (
            <tr key={i} className="border-t border-border">
              {linha.map((v, j) => (
                <td key={j} className={cn("px-3 py-1.5 whitespace-nowrap", numericas.has(j) ? "text-right" : "text-left text-foreground")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Quadro de gráfico: legenda acima, gráfico (só no navegador) e botão para
 * alternar com a tabela de dados (o "gêmeo acessível" do gráfico).
 */
export function QuadroGrafico({
  altura,
  legenda,
  tabela,
  rotulo,
  children,
  acoes,
  className,
}: {
  altura: number;
  legenda?: ItemLegenda[];
  tabela?: TabelaDados;
  /** Nome acessível do gráfico */
  rotulo: string;
  children: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  const montado = useMontado();
  const [verTabela, setVerTabela] = useState(false);
  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legenda itens={legenda ?? []} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {acoes}
          {tabela && (
            <button
              type="button"
              onClick={() => setVerTabela((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              aria-pressed={verTabela}
            >
              {verTabela ? <BarChart3 className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
              {verTabela ? "Ver gráfico" : "Ver dados em tabela"}
            </button>
          )}
        </div>
      </div>
      {verTabela && tabela ? (
        <Tabela tabela={tabela} legenda={rotulo} />
      ) : (
        <div role="img" aria-label={rotulo} style={{ height: altura }} className="w-full min-w-0">
          {montado ? children : <div className="h-full w-full animate-pulse rounded-lg bg-surface-2/60" />}
        </div>
      )}
    </figure>
  );
}

/** Escala com marcas "redondas" (1, 2, 2,5, 5 × 10ⁿ) cobrindo [min, max] */
export function escalaBonita(min: number, max: number, marcas = 4, desdeZero = false) {
  const lo0 = desdeZero ? 0 : min;
  const bruto = Math.max(max - lo0, Math.abs(max) * 0.05, 1e-6) / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  const lo = desdeZero ? 0 : Math.floor(lo0 / passo) * passo;
  const hi = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) ticks.push(Math.round(v * 1e6) / 1e6);
  return { dominio: [lo, hi] as [number, number], ticks };
}

/** Props padrão de eixos discretos */
export const EIXO = {
  stroke: "var(--chart-grid)",
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
} as const;

export const GRADE = { stroke: "var(--chart-grid)", vertical: false } as const;
