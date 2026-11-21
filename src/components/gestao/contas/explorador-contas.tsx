"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Download, FilterX, Inbox, Search, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, estiloCampo, PageHeader, Rotulo } from "@/components/ui/page-header";
import { ORDEM_CATEGORIAS } from "@/lib/analise/geral";
import { CONDOMINIOS, DATA_REFERENCIA, obterCondominio, statusDaConta } from "@/lib/dados";
import { registrarPagamento, useContas } from "@/lib/dados/store";
import { formatarCompetencia, formatarData, formatarMoeda, ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Categoria, Conta, StatusConta } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { IconeCategoria } from "../categoria";
import { PainelDetalheConta } from "../detalhe-conta";
import { ROTULOS_STATUS } from "../rotulos";
import { SeloOrigem } from "../selo-origem";

const POR_PAGINA = 20;

type FiltroStatus = StatusConta | "em_aberto" | "";

const OPCOES_STATUS: { id: FiltroStatus; rotulo: string }[] = [
  { id: "", rotulo: "Todas" },
  { id: "em_aberto", rotulo: "Em aberto" },
  { id: "vencida", rotulo: ROTULOS_STATUS.vencida },
  { id: "vence_em_breve", rotulo: ROTULOS_STATUS.vence_em_breve },
  { id: "a_vencer", rotulo: ROTULOS_STATUS.a_vencer },
  { id: "paga", rotulo: ROTULOS_STATUS.paga },
];

const ORDENACOES = {
  prioridade: "Prioridade (vencidas primeiro)",
  vencimento_desc: "Vencimento: mais recente",
  vencimento_asc: "Vencimento: mais antigo",
  valor_desc: "Valor: maior primeiro",
  valor_asc: "Valor: menor primeiro",
  competencia_desc: "Competência: mais recente",
} as const;
type Ordem = keyof typeof ORDENACOES;

const PESO_STATUS: Record<StatusConta, number> = { vencida: 0, vence_em_breve: 1, a_vencer: 2, paga: 3 };

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function ordenar(contas: Conta[], ordem: Ordem) {
  const lista = [...contas];
  switch (ordem) {
    case "vencimento_desc":
      return lista.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    case "vencimento_asc":
      return lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    case "valor_desc":
      return lista.sort((a, b) => b.valor - a.valor);
    case "valor_asc":
      return lista.sort((a, b) => a.valor - b.valor);
    case "competencia_desc":
      return lista.sort((a, b) => b.competencia.localeCompare(a.competencia) || b.valor - a.valor);
    default:
      return lista.sort((a, b) => {
        const sa = PESO_STATUS[statusDaConta(a)];
        const sb = PESO_STATUS[statusDaConta(b)];
        if (sa !== sb) return sa - sb;
        // em aberto: o que vence antes primeiro; pagas: as mais recentes primeiro
        return sa === 3 ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento);
      });
  }
}

function exportarCsv(contas: Conta[]) {
  const cabecalho = ["Condomínio", "Categoria", "Fornecedor", "Descrição", "Competência", "Vencimento", "Valor", "Status", "Pago em", "Origem"];
  const linhas = contas.map((c) => [
    obterCondominio(c.condominioId)?.nome ?? c.condominioId,
    ROTULOS_CATEGORIA[c.categoria],
    c.fornecedor,
    c.descricao,
    c.competencia,
    c.vencimento,
    c.valor.toFixed(2).replace(".", ","),
    statusDaConta(c),
    c.pagaEm ?? "",
    c.origem === "envio" ? "Enviada por você" : "Demonstração",
  ]);
  const csv = [cabecalho, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "contas-condogest.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ExploradorContas() {
  const contas = useContas();
  const params = useSearchParams();

  const filtros = {
    condominio: params.get("condominio") ?? "",
    categoria: (params.get("categoria") ?? "") as Categoria | "",
    status: (params.get("status") ?? "") as FiltroStatus,
    competencia: params.get("competencia") ?? "",
    busca: params.get("busca") ?? "",
    origem: params.get("origem") ?? "",
    ordem: ((params.get("ordem") ?? "prioridade") in ORDENACOES ? params.get("ordem") ?? "prioridade" : "prioridade") as Ordem,
    pagina: Math.max(1, Number(params.get("pagina") ?? "1") || 1),
    conta: params.get("conta") ?? "",
  };

  /** Atualiza a URL (sem recarregar) — os filtros vivem na URL e podem ser compartilhados */
  function atualizar(patch: Partial<Record<keyof typeof filtros, string | number>>, manterPagina = false) {
    const novo = new URLSearchParams(params.toString());
    for (const [chave, valor] of Object.entries(patch)) {
      const vazio = valor === "" || valor === undefined || (chave === "ordem" && valor === "prioridade") || (chave === "pagina" && valor === 1);
      if (vazio) novo.delete(chave);
      else novo.set(chave, String(valor));
    }
    if (!("pagina" in patch) && !manterPagina) novo.delete("pagina");
    const qs = novo.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const condominioId = CONDOMINIOS.find((c) => c.slug === filtros.condominio || c.id === filtros.condominio)?.id;
  const competencias = useMemo(() => [...new Set(contas.map((c) => c.competencia))].sort().reverse(), [contas]);

  // Todos os filtros menos o de status (para as contagens dos botões de status)
  const base = useMemo(() => {
    const termo = normalizar(filtros.busca.trim());
    return contas.filter(
      (c) =>
        (!condominioId || c.condominioId === condominioId) &&
        (!filtros.categoria || c.categoria === filtros.categoria) &&
        (!filtros.competencia || c.competencia === filtros.competencia) &&
        (!filtros.origem || c.origem === filtros.origem) &&
        (!termo || normalizar(`${c.fornecedor} ${c.descricao}`).includes(termo)),
    );
  }, [contas, condominioId, filtros.categoria, filtros.competencia, filtros.origem, filtros.busca]);

  const contagem = useMemo(() => {
    const r: Record<string, number> = { "": base.length, em_aberto: 0, vencida: 0, vence_em_breve: 0, a_vencer: 0, paga: 0 };
    for (const c of base) {
      const s = statusDaConta(c);
      r[s]++;
      if (s !== "paga") r.em_aberto++;
    }
    return r;
  }, [base]);

  const filtradas = useMemo(() => {
    const lista = base.filter((c) => {
      if (!filtros.status) return true;
      const s = statusDaConta(c);
      return filtros.status === "em_aberto" ? s !== "paga" : s === filtros.status;
    });
    return ordenar(lista, filtros.ordem);
  }, [base, filtros.status, filtros.ordem]);

  const totais = useMemo(() => {
    let total = 0;
    let aberto = 0;
    for (const c of filtradas) {
      total += c.valor;
      if (!c.pagaEm) aberto += c.valor;
    }
    return { total, aberto, pago: total - aberto };
  }, [filtradas]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = Math.min(filtros.pagina, paginas);
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const contaAberta = filtros.conta ? contas.find((c) => c.id === filtros.conta) : undefined;
  const temFiltro = Boolean(
    filtros.condominio || filtros.categoria || filtros.status || filtros.competencia || filtros.busca || filtros.origem,
  );

  const abrir = (id: string) => atualizar({ conta: id }, true);

  return (
    <div>
      <PageHeader
        titulo="Contas"
        descricao="Todas as contas da carteira — as de demonstração e as que você enviou. Filtre, confira os detalhes e marque pagamentos."
        acoes={
          <>
            <Button variante="contorno" onClick={() => exportarCsv(filtradas)} disabled={filtradas.length === 0}>
              <Download aria-hidden />
              Exportar CSV
            </Button>
            <ButtonLink href="/contas/enviar">
              <Upload aria-hidden />
              Enviar conta
            </ButtonLink>
          </>
        }
      />

      {/* Filtros: uma linha acima de tudo o que eles afetam */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Rotulo htmlFor="filtro-busca">Buscar</Rotulo>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                id="filtro-busca"
                type="search"
                value={filtros.busca}
                onChange={(e) => atualizar({ busca: e.target.value })}
                placeholder="Fornecedor ou descrição"
                className={cn(estiloCampo, "pl-9")}
              />
            </div>
          </div>
          <div>
            <Rotulo htmlFor="filtro-condominio">Condomínio</Rotulo>
            <select
              id="filtro-condominio"
              value={condominioId ? obterCondominio(condominioId)!.slug : ""}
              onChange={(e) => atualizar({ condominio: e.target.value })}
              className={estiloCampo}
            >
              <option value="">Todos</option>
              {CONDOMINIOS.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo htmlFor="filtro-categoria">Categoria</Rotulo>
            <select
              id="filtro-categoria"
              value={filtros.categoria}
              onChange={(e) => atualizar({ categoria: e.target.value })}
              className={estiloCampo}
            >
              <option value="">Todas</option>
              {ORDEM_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ROTULOS_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo htmlFor="filtro-competencia">Competência</Rotulo>
            <select
              id="filtro-competencia"
              value={filtros.competencia}
              onChange={(e) => atualizar({ competencia: e.target.value })}
              className={estiloCampo}
            >
              <option value="">Todas</option>
              {competencias.map((c) => (
                <option key={c} value={c}>
                  {formatarCompetencia(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo htmlFor="filtro-origem">Origem</Rotulo>
            <select
              id="filtro-origem"
              value={filtros.origem}
              onChange={(e) => atualizar({ origem: e.target.value })}
              className={estiloCampo}
            >
              <option value="">Todas</option>
              <option value="envio">Enviadas por você</option>
              <option value="demo">Demonstração</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
            {OPCOES_STATUS.map((o) => {
              const ativo = filtros.status === o.id;
              return (
                <button
                  key={o.id || "todas"}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => atualizar({ status: o.id })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                    ativo
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {o.rotulo}
                  <span className={cn("tabular rounded-full px-1.5 text-[11px]", ativo ? "bg-primary/15" : "bg-surface-2")}>
                    {contagem[o.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {temFiltro && (
              <Button
                variante="fantasma"
                tamanho="sm"
                onClick={() => atualizar({ condominio: "", categoria: "", status: "", competencia: "", busca: "", origem: "" })}
              >
                <FilterX aria-hidden />
                Limpar filtros
              </Button>
            )}
            <label htmlFor="ordem" className="sr-only">
              Ordenar por
            </label>
            <select
              id="ordem"
              value={filtros.ordem}
              onChange={(e) => atualizar({ ordem: e.target.value }, true)}
              className={cn(estiloCampo, "h-8 w-auto text-xs")}
            >
              {Object.entries(ORDENACOES).map(([id, rotulo]) => (
                <option key={id} value={id}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Totais do filtro */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
        {[
          { rotulo: "Contas", valor: filtradas.length.toLocaleString("pt-BR") },
          { rotulo: "Total", valor: formatarMoeda(totais.total) },
          { rotulo: "Em aberto", valor: formatarMoeda(totais.aberto) },
          { rotulo: "Pago", valor: formatarMoeda(totais.pago) },
        ].map((t) => (
          <div key={t.rotulo} className="rounded-lg bg-surface-2/70 px-3 py-2">
            <dt className="text-xs text-muted">{t.rotulo}</dt>
            <dd className="tabular text-sm font-semibold text-foreground">{t.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-xl border border-border bg-surface">
        {filtradas.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icone={<Inbox aria-hidden />}
              titulo="Nenhuma conta encontrada"
              descricao={temFiltro ? "Tente outros filtros ou limpe a busca." : "Ainda não há contas na carteira."}
              acao={
                temFiltro ? (
                  <Button
                    variante="contorno"
                    onClick={() => atualizar({ condominio: "", categoria: "", status: "", competencia: "", busca: "", origem: "" })}
                  >
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Tabela (md+) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Lista de contas filtradas</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      Conta
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Condomínio
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Competência
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Vencimento
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Valor
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Situação
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visiveis.map((c) => {
                    const status = statusDaConta(c);
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-surface-2/60">
                        <td className="max-w-[22rem] px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <IconeCategoria categoria={c.categoria} tamanho="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => abrir(c.id)}
                                className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              >
                                {c.descricao}
                              </button>
                              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                                <span className="truncate">{c.fornecedor}</span>
                                <SeloOrigem conta={c} />
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted">{obterCondominio(c.condominioId)?.nome}</td>
                        <td className="tabular px-3 py-2.5 text-muted">{formatarCompetencia(c.competencia)}</td>
                        <td className="tabular px-3 py-2.5 text-muted">{formatarData(c.vencimento)}</td>
                        <td className="tabular px-3 py-2.5 text-right font-medium text-foreground">{formatarMoeda(c.valor)}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {status !== "paga" && (
                              <Button
                                variante="fantasma"
                                tamanho="sm"
                                onClick={() => registrarPagamento(c.id, DATA_REFERENCIA)}
                                aria-label={`Marcar como paga: ${c.descricao}`}
                              >
                                <CheckCircle2 aria-hidden />
                                Pagar
                              </Button>
                            )}
                            <Button variante="contorno" tamanho="sm" onClick={() => abrir(c.id)} aria-label={`Ver detalhes: ${c.descricao}`}>
                              Detalhes
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cartões (celular) */}
            <ul className="divide-y divide-border md:hidden">
              {visiveis.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <IconeCategoria categoria={c.categoria} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{c.descricao}</span>
                      <span className="block truncate text-xs text-muted">
                        {obterCondominio(c.condominioId)?.nome} · {formatarCompetencia(c.competencia)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={statusDaConta(c)} />
                        <SeloOrigem conta={c} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-sm font-semibold text-foreground">{formatarMoeda(c.valor)}</span>
                      <span className="tabular text-xs text-muted">vence {formatarData(c.vencimento)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Paginação */}
            <nav
              aria-label="Paginação"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted"
            >
              <p className="tabular">
                Mostrando {((pagina - 1) * POR_PAGINA + 1).toLocaleString("pt-BR")}–
                {Math.min(pagina * POR_PAGINA, filtradas.length).toLocaleString("pt-BR")} de {filtradas.length.toLocaleString("pt-BR")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variante="contorno"
                  tamanho="sm"
                  disabled={pagina <= 1}
                  onClick={() => atualizar({ pagina: pagina - 1 })}
                >
                  <ChevronLeft aria-hidden />
                  Anterior
                </Button>
                <span className="tabular px-1" aria-current="page">
                  {pagina} / {paginas}
                </span>
                <Button
                  variante="contorno"
                  tamanho="sm"
                  disabled={pagina >= paginas}
                  onClick={() => atualizar({ pagina: pagina + 1 })}
                >
                  Próxima
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>

      <PainelDetalheConta conta={contaAberta} aoFechar={() => atualizar({ conta: "" }, true)} />
    </div>
  );
}
