import { grupoDaCategoria } from "@/lib/analise/geral";
import { formatarMoeda, formatarPercentual, ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Categoria } from "@/lib/tipos";
import { ICONES_CATEGORIA } from "./categoria";
import { formatarMoedaInteira } from "./formato";

/**
 * Participação de cada categoria (barras horizontais em ranking). A cor de
 * cada barra é a do grupo da categoria — a mesma do gráfico de evolução.
 */
export function DistribuicaoCategorias({
  itens,
}: {
  itens: { categoria: Categoria; valor: number; participacao: number }[];
}) {
  const maior = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="space-y-3">
      {itens.map((i) => {
        const Icone = ICONES_CATEGORIA[i.categoria];
        return (
          <li key={i.categoria} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
            <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              <Icone className={i.categoria === "energia" ? "size-4 shrink-0 text-energy" : "size-4 shrink-0 text-subtle"} aria-hidden />
              <span className="truncate">{ROTULOS_CATEGORIA[i.categoria]}</span>
            </span>
            <span className="tabular text-right text-sm whitespace-nowrap text-foreground sm:order-last" title={formatarMoeda(i.valor)}>
              {formatarMoedaInteira(i.valor)}
              <span className="ml-1.5 inline-block w-12 text-xs text-muted">{formatarPercentual(i.participacao)}</span>
            </span>
            <span
              className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2 sm:col-span-1"
              role="presentation"
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(1.5, (i.valor / maior) * 100)}%`, background: grupoDaCategoria(i.categoria).cor }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
