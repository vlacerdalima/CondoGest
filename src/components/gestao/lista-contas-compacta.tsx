import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { obterCondominio, statusDaConta } from "@/lib/dados";
import { formatarCompetencia, formatarDataCurta, formatarMoeda } from "@/lib/formatacao";
import type { Conta } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { IconeCategoria } from "./categoria";
import { SeloOrigem } from "./selo-origem";

/**
 * Lista curta de contas (próximos vencimentos, contas recentes). Cada linha
 * abre o detalhe na tela de Contas.
 */
export function ListaContasCompacta({
  contas,
  mostrarCondominio = true,
  className,
}: {
  contas: Conta[];
  mostrarCondominio?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {contas.map((c) => {
        const condominio = obterCondominio(c.condominioId);
        return (
          <li key={c.id}>
            <Link
              href={`/contas?conta=${encodeURIComponent(c.id)}`}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <IconeCategoria categoria={c.categoria} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{c.descricao}</span>
                <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  {mostrarCondominio && condominio && <span className="truncate">{condominio.nome}</span>}
                  {mostrarCondominio && condominio && <span aria-hidden>·</span>}
                  <span className="truncate">{c.fornecedor}</span>
                  <span aria-hidden>·</span>
                  <span>{formatarCompetencia(c.competencia)}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-sm font-semibold text-foreground">{formatarMoeda(c.valor)}</span>
                <span className="flex items-center gap-1.5">
                  <SeloOrigem conta={c} className="hidden sm:inline-flex" />
                  <span className="tabular text-xs text-muted">{formatarDataCurta(c.vencimento)}</span>
                  <StatusBadge status={statusDaConta(c)} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
