import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  formatarCompetenciaLonga,
  formatarData,
  formatarKw,
  formatarKwh,
  formatarMoeda,
  formatarNumero,
  formatarNumero2,
  formatarPercentual,
} from "@/lib/formatacao";
import { ROTULO_BANDEIRA } from "@/lib/gerador/tarifas";
import type { FaturaFicticia, ItemDetalhado } from "@/lib/gerador/tipos";
import type { Bandeira } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const TOM_BANDEIRA: Record<Bandeira, "ok" | "atencao" | "serio" | "critico"> = {
  verde: "ok",
  amarela: "atencao",
  vermelha_1: "serio",
  vermelha_2: "critico",
  escassez_hidrica: "critico",
};

export const ROTULO_TIPO_FATURA: Record<FaturaFicticia["tipo"], string> = {
  b3_cativo: "Fatura da distribuidora · baixa tensão (B3)",
  a4_verde_cativo: "Fatura da distribuidora · média tensão (A4 verde)",
  a4_verde_livre_distribuicao: "Fatura da distribuidora · uso da rede (mercado livre)",
  comercializadora_livre: "Fatura da comercializadora · energia (mercado livre)",
};

function quantidade(i: ItemDetalhado) {
  if (i.quantidade === undefined || !i.unidade) return "";
  const casas = i.unidade === "MWh" ? 3 : i.unidade === "kW" || i.unidade === "kVAr" ? 2 : 0;
  const n = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(i.quantidade);
  return `${n} ${i.unidade}`;
}

function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="tabular truncate text-sm font-medium text-foreground">{valor}</dd>
    </div>
  );
}

/** Resumo em HTML de uma fatura fictícia (o que vai no PDF, em versão compacta) */
export function ResumoFatura({ fatura: f, className }: { fatura: FaturaFicticia; className?: string }) {
  const a4 = f.uc.subgrupo === "A4";
  const kwhDia = f.consumoKwh / Math.max(1, f.dias);
  const itensVisiveis = f.itens.filter((i) => i.valor !== 0 || i.descricao.startsWith("Uso Sistema") || i.descricao.startsWith("Consumo"));
  const ocultos = f.itens.length - itensVisiveis.length;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{ROTULO_TIPO_FATURA[f.tipo]}</p>
          <p className="truncate text-sm text-foreground">{f.emissor.nome}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Total</p>
          <p className="tabular text-2xl font-semibold tracking-tight text-foreground">{formatarMoeda(f.total)}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Dado rotulo="Competência" valor={formatarCompetenciaLonga(f.competencia)} />
        <Dado rotulo="Vencimento" valor={formatarData(f.vencimento)} />
        <Dado rotulo="Leituras" valor={`${formatarData(f.leituraAnterior).slice(0, 5)} a ${formatarData(f.leituraAtual).slice(0, 5)} · ${f.dias} dias`} />
        <Dado rotulo="Consumo" valor={`${formatarKwh(f.consumoKwh)} · ${formatarNumero(kwhDia)}/dia`} />
        {a4 && f.consumoPontaKwh !== undefined && (
          <Dado
            rotulo="Na ponta (18h–21h)"
            valor={`${formatarKwh(f.consumoPontaKwh)} · ${formatarPercentual((100 * f.consumoPontaKwh) / Math.max(1, f.consumoKwh))}`}
          />
        )}
        {a4 && f.demandaMedidaKw !== undefined && (
          <Dado
            rotulo="Demanda medida / contratada"
            valor={`${formatarKw(f.demandaMedidaKw)} / ${formatarKw(f.uc.demandaContratadaKw ?? 0)}`}
          />
        )}
        {f.tipo !== "comercializadora_livre" && (
          <Dado
            rotulo="Bandeira"
            valor={
              <Badge tom={TOM_BANDEIRA[f.bandeira]}>
                {f.bandeirasNoCiclo.length > 1
                  ? f.bandeirasNoCiclo.map((b) => `${ROTULO_BANDEIRA[b.bandeira]} ${b.dias}d`).join(" + ")
                  : ROTULO_BANDEIRA[f.bandeira]}
              </Badge>
            }
          />
        )}
        {a4 && !!f.reativoExcedenteKvarh && (
          <Dado rotulo="Reativo excedente" valor={`${formatarNumero(f.reativoExcedenteKvarh)} kVArh`} />
        )}
        {f.tipo === "comercializadora_livre" && (
          <Dado rotulo="Preço do contrato" valor={`${formatarMoeda(f.energia.precoMwhSemIcms)}/MWh sem ICMS`} />
        )}
      </dl>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Quant.</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-border">
            {itensVisiveis.map((i) => (
              <tr key={i.descricao}>
                <td className="px-3 py-1.5 text-foreground">{i.descricao}</td>
                <td className="hidden px-3 py-1.5 text-right whitespace-nowrap text-muted sm:table-cell">{quantidade(i)}</td>
                <td className={cn("px-3 py-1.5 text-right whitespace-nowrap", i.valor < 0 ? "text-ok" : "text-foreground")}>
                  {formatarMoeda(i.valor)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-2 font-semibold">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="hidden px-3 py-2 text-right text-xs font-normal text-muted sm:table-cell">
                ICMS {formatarMoeda(f.tributos.find((t) => t.tributo === "ICMS")?.valor ?? 0)}
              </td>
              <td className="tabular px-3 py-2 text-right">{formatarMoeda(f.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {ocultos > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          {ocultos} {ocultos === 1 ? "item zerado aparece" : "itens zerados aparecem"} só no PDF (reativo excedente etc.).
        </p>
      )}

      {f.tipo === "comercializadora_livre" && (
        <div className="mt-4 rounded-lg border border-ok/30 bg-ok-soft/50 p-3 text-sm">
          <p className="font-medium text-foreground">
            Economia estimada no mercado livre: {formatarMoeda(f.comparativo.economia)} (
            {formatarPercentual(f.comparativo.economiaPercentual)})
          </p>
          <p className="mt-0.5 text-muted">
            Livre (distribuição + energia) {formatarMoeda(f.comparativo.totalLivre)} × cativo estimado{" "}
            {formatarMoeda(f.comparativo.cativoEquivalente)}. Energia faturada {formatarNumero2(f.energia.faturadoMwh)} MWh (medido
            + 3% de perdas − 2% PROINFA).
          </p>
        </div>
      )}
    </div>
  );
}
