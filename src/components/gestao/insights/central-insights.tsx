"use client";

import { FilterX, Lightbulb, PiggyBank } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { SEVERIDADES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, estiloCampo, PageHeader, Rotulo } from "@/components/ui/page-header";
import { contarPorSeveridade, economiaPotencial, ORDEM_CATEGORIAS } from "@/lib/analise/geral";
import { CONDOMINIOS, obterCondominio } from "@/lib/dados";
import { ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Severidade } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CartaoInsight } from "../cartao-insight";
import { formatarFaixaCompacta } from "../formato";
import { useCarteira } from "../use-carteira";

const ORDEM_SEVERIDADES: Severidade[] = ["critico", "atencao", "oportunidade", "info"];

const TOM_CONTADOR: Record<Severidade, string> = {
  critico: "text-critical",
  atencao: "text-warn",
  oportunidade: "text-primary",
  info: "text-muted",
};

export function CentralInsights() {
  const { insights } = useCarteira();
  const params = useSearchParams();
  const severidade = (params.get("severidade") ?? "") as Severidade | "";
  const condominioSlug = params.get("condominio") ?? "";
  const categoria = params.get("categoria") ?? "";
  const condominioId = condominioSlug ? obterCondominio(condominioSlug)?.id : undefined;

  function atualizar(patch: Record<string, string>) {
    const novo = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) novo.set(k, v);
      else novo.delete(k);
    }
    const qs = novo.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  // Contagens por severidade respeitam os outros filtros
  const semSeveridade = useMemo(
    () =>
      insights.filter(
        (i) =>
          (!condominioId || i.condominioId === condominioId) &&
          (!categoria || i.categoria === categoria),
      ),
    [insights, condominioId, categoria],
  );
  const filtrados = useMemo(
    () => semSeveridade.filter((i) => !severidade || i.severidade === severidade),
    [semSeveridade, severidade],
  );
  const contagem = contarPorSeveridade(semSeveridade);
  const economia = economiaPotencial(filtrados);
  const categoriasPresentes = useMemo(() => {
    const presentes = new Set(insights.map((i) => i.categoria));
    return [...ORDEM_CATEGORIAS.filter((c) => presentes.has(c)), ...(presentes.has("geral") ? (["geral"] as const) : [])];
  }, [insights]);
  const temFiltro = Boolean(severidade || condominioSlug || categoria);

  return (
    <div>
      <PageHeader
        titulo="Insights"
        descricao="Alertas e oportunidades encontrados nas contas da carteira, do mais urgente ao menos urgente. Cada um tem um link para você conferir os números."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 [&>*]:min-w-0">
        {ORDEM_SEVERIDADES.map((s) => {
          const { rotulo, icone: Icone } = SEVERIDADES[s];
          const ativo = severidade === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={ativo}
              onClick={() => atualizar({ severidade: ativo ? "" : s })}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-surface p-4 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                ativo ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
              )}
            >
              <Icone className={cn("size-5 shrink-0", TOM_CONTADOR[s])} aria-hidden />
              <span>
                <span className="block text-2xl font-semibold text-foreground">{contagem[s]}</span>
                <span className="block text-xs text-muted">{rotulo}</span>
              </span>
            </button>
          );
        })}
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4 sm:col-span-2 lg:col-span-1">
          <PiggyBank className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-foreground">
              {economia.quantidade ? `${formatarFaixaCompacta(economia)}` : "—"}
            </span>
            <span className="block text-xs text-muted">Impacto estimado por mês (filtro atual)</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="min-w-48 flex-1">
          <Rotulo htmlFor="insight-condominio">Condomínio</Rotulo>
          <select
            id="insight-condominio"
            value={condominioId ? obterCondominio(condominioId)!.slug : ""}
            onChange={(e) => atualizar({ condominio: e.target.value })}
            className={estiloCampo}
          >
            <option value="">Todos (inclui alertas da carteira)</option>
            {CONDOMINIOS.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <Rotulo htmlFor="insight-categoria">Categoria</Rotulo>
          <select
            id="insight-categoria"
            value={categoria}
            onChange={(e) => atualizar({ categoria: e.target.value })}
            className={estiloCampo}
          >
            <option value="">Todas</option>
            {categoriasPresentes.map((c) => (
              <option key={c} value={c}>
                {c === "geral" ? "Geral (custos e vencimentos)" : ROTULOS_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <Rotulo htmlFor="insight-severidade">Severidade</Rotulo>
          <select
            id="insight-severidade"
            value={severidade}
            onChange={(e) => atualizar({ severidade: e.target.value })}
            className={estiloCampo}
          >
            <option value="">Todas</option>
            {ORDEM_SEVERIDADES.map((s) => (
              <option key={s} value={s}>
                {SEVERIDADES[s].rotulo}
              </option>
            ))}
          </select>
        </div>
        {temFiltro && (
          <Button variante="fantasma" onClick={() => atualizar({ severidade: "", condominio: "", categoria: "" })}>
            <FilterX aria-hidden />
            Limpar filtros
          </Button>
        )}
      </div>

      <p className="mt-5 mb-3 text-sm text-muted" aria-live="polite">
        {filtrados.length} {filtrados.length === 1 ? "insight" : "insights"}
        {condominioId ? ` em ${obterCondominio(condominioId)?.nome}` : ""}, ordenados por severidade e impacto.
      </p>

      {filtrados.length === 0 ? (
        <EmptyState
          icone={<Lightbulb aria-hidden />}
          titulo="Nenhum insight com esses filtros"
          descricao="Tente outro condomínio, categoria ou severidade."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          {filtrados.map((i) => (
            <li key={i.id}>
              <CartaoInsight insight={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
