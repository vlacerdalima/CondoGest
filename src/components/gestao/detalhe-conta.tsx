"use client";

import { ArrowRight, CheckCircle2, ExternalLink, Paperclip, Trash2, Undo2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { DATA_REFERENCIA, diferencaEmDias, obterCondominio, obterUc, statusDaConta } from "@/lib/dados";
import { registrarPagamento, removerContaEnviada } from "@/lib/dados/store";
import {
  formatarCompetenciaLonga,
  formatarData,
  formatarKw,
  formatarKwh,
  formatarKwhDia,
  formatarMoeda,
  formatarNumero,
  formatarNumero1,
  formatarNumero2,
  ROTULOS_CATEGORIA,
} from "@/lib/formatacao";
import type { Conta } from "@/lib/tipos";
import { IconeCategoria } from "./categoria";
import { formatarDataHora, maiusculaInicial } from "./formato";
import { ROTULOS_BANDEIRA, ROTULOS_TIPO_FATURA } from "./rotulos";
import { SeloOrigem } from "./selo-origem";

function Campo({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="mt-0.5 text-sm break-words text-foreground">{children}</dd>
    </div>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5 sm:px-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icone}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * Painel lateral (diálogo modal nativo: foco preso, Esc fecha) com todos os
 * campos de uma conta e as ações de pagamento/remoção.
 */
export function PainelDetalheConta({ conta, aoFechar }: { conta: Conta | undefined; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [contaAnteriorId, setContaAnteriorId] = useState(conta?.id);

  // Ao trocar de conta, sai do modo de confirmação (ajuste de estado no render)
  if (conta?.id !== contaAnteriorId) {
    setContaAnteriorId(conta?.id);
    setConfirmandoRemocao(false);
  }

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (conta && !dialogo.open) dialogo.showModal();
    if (!conta && dialogo.open) dialogo.close();
  }, [conta]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl overflow-hidden bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 open:flex"
    >
      {conta && (
        <ConteudoDetalhe
          conta={conta}
          idTitulo={idTitulo}
          aoFechar={aoFechar}
          confirmandoRemocao={confirmandoRemocao}
          setConfirmandoRemocao={setConfirmandoRemocao}
        />
      )}
    </dialog>
  );
}

function ConteudoDetalhe({
  conta,
  idTitulo,
  aoFechar,
  confirmandoRemocao,
  setConfirmandoRemocao,
}: {
  conta: Conta;
  idTitulo: string;
  aoFechar: () => void;
  confirmandoRemocao: boolean;
  setConfirmandoRemocao: (v: boolean) => void;
}) {
  const condominio = obterCondominio(conta.condominioId);
  const status = statusDaConta(conta);
  const energia = conta.energia;
  const uc = energia ? obterUc(energia.ucId) : undefined;
  const diasParaVencer = diferencaEmDias(DATA_REFERENCIA, conta.vencimento);

  return (
    <div className="flex w-full flex-col">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
        <IconeCategoria categoria={conta.categoria} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {ROTULOS_CATEGORIA[conta.categoria]} · {condominio?.nome ?? "Condomínio"}
          </p>
          <h2 id={idTitulo} className="mt-0.5 text-base font-semibold text-foreground">
            {conta.descricao}
          </h2>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar detalhes"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <SeloOrigem conta={conta} />
          </div>
          <p className="tabular mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatarMoeda(conta.valor)}</p>
          <p className="mt-1 text-sm text-muted">
            {conta.pagaEm
              ? `Paga em ${formatarData(conta.pagaEm)} · vencimento ${formatarData(conta.vencimento)}`
              : status === "vencida"
                ? `Venceu em ${formatarData(conta.vencimento)} (há ${-diasParaVencer} ${-diasParaVencer === 1 ? "dia" : "dias"})`
                : `Vence em ${formatarData(conta.vencimento)}${
                    diasParaVencer === 0 ? " (hoje)" : ` (em ${diasParaVencer} ${diasParaVencer === 1 ? "dia" : "dias"})`
                  }`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {conta.pagaEm ? (
              <Button variante="contorno" tamanho="sm" onClick={() => registrarPagamento(conta.id, null)}>
                <Undo2 aria-hidden />
                Desfazer pagamento
              </Button>
            ) : (
              <Button tamanho="sm" onClick={() => registrarPagamento(conta.id, DATA_REFERENCIA)}>
                <CheckCircle2 aria-hidden />
                Marcar como paga
              </Button>
            )}
            {conta.origem === "envio" && !confirmandoRemocao && (
              <Button variante="fantasma" tamanho="sm" onClick={() => setConfirmandoRemocao(true)}>
                <Trash2 aria-hidden />
                Remover conta
              </Button>
            )}
          </div>
          {conta.origem === "envio" && confirmandoRemocao && (
            <div role="alert" className="mt-3 rounded-lg border border-critical/30 bg-critical-soft p-3 text-sm">
              <p className="font-medium text-foreground">Remover esta conta enviada?</p>
              <p className="mt-0.5 text-muted">Ela sai do painel e das análises. Não dá para desfazer.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variante="perigo"
                  tamanho="sm"
                  onClick={() => {
                    removerContaEnviada(conta.id);
                    aoFechar();
                  }}
                >
                  Sim, remover
                </Button>
                <Button variante="contorno" tamanho="sm" onClick={() => setConfirmandoRemocao(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {conta.pagaEm === undefined && (
            <p className="mt-2 text-xs text-subtle">
              O pagamento é registrado com a data de referência da demonstração ({formatarData(DATA_REFERENCIA)}).
            </p>
          )}
        </div>

        <Secao titulo="Dados da conta">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Campo rotulo="Fornecedor" largo>
              {conta.fornecedor}
            </Campo>
            <Campo rotulo="Condomínio">
              {condominio ? (
                <Link href={`/condominios/${condominio.slug}`} className="text-primary hover:underline">
                  {condominio.nome}
                </Link>
              ) : (
                "—"
              )}
            </Campo>
            <Campo rotulo="Categoria">{ROTULOS_CATEGORIA[conta.categoria]}</Campo>
            <Campo rotulo="Competência">
              {maiusculaInicial(formatarCompetenciaLonga(conta.competencia))}
            </Campo>
            <Campo rotulo="Emissão">{conta.emissao ? formatarData(conta.emissao) : "—"}</Campo>
            <Campo rotulo="Vencimento">{formatarData(conta.vencimento)}</Campo>
            <Campo rotulo="Pagamento">{conta.pagaEm ? formatarData(conta.pagaEm) : "Em aberto"}</Campo>
            <Campo rotulo="Origem">{conta.origem === "envio" ? "Enviada por você" : "Dados de demonstração"}</Campo>
            {conta.enviadaEm && <Campo rotulo="Enviada em">{formatarDataHora(conta.enviadaEm)}</Campo>}
            {conta.arquivoNome && (
              <Campo rotulo="Arquivo" largo>
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip className="size-3.5 text-subtle" aria-hidden />
                  {conta.arquivoNome}
                </span>
              </Campo>
            )}
            {conta.observacoes && (
              <Campo rotulo="Observações" largo>
                {conta.observacoes}
              </Campo>
            )}
          </dl>
        </Secao>

        {energia && (
          <Secao titulo="Energia" icone={<Zap className="size-4 text-energy" aria-hidden />}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Campo rotulo="Unidade consumidora" largo>
                {uc ? (
                  <>
                    {uc.apelido} <span className="text-muted">· UC {uc.numeroUc}</span>
                  </>
                ) : (
                  energia.ucId
                )}
              </Campo>
              {uc && (
                <Campo rotulo="Classificação" largo>
                  Subgrupo {uc.subgrupo} · tarifa {uc.modalidade} · mercado {uc.ambiente === "livre" ? "livre" : "cativo"}
                </Campo>
              )}
              <Campo rotulo="Tipo de fatura">{ROTULOS_TIPO_FATURA[energia.tipoFatura]}</Campo>
              <Campo rotulo="Bandeira">{ROTULOS_BANDEIRA[energia.bandeira]}</Campo>
              <Campo rotulo="Leituras">
                {formatarData(energia.leituraAnterior)} → {formatarData(energia.leituraAtual)}
              </Campo>
              <Campo rotulo="Dias do ciclo">{energia.dias} dias</Campo>
              <Campo rotulo="Consumo">
                <span className="tabular">{formatarKwh(energia.consumoKwh)}</span>
              </Campo>
              <Campo rotulo="Consumo por dia">
                <span className="tabular">{energia.dias ? formatarKwhDia(energia.consumoKwh / energia.dias) : "—"}</span>
              </Campo>
              {energia.consumoPontaKwh !== undefined && (
                <Campo rotulo="Ponta / fora de ponta">
                  <span className="tabular">
                    {formatarKwh(energia.consumoPontaKwh)} / {formatarKwh(energia.consumoForaPontaKwh ?? 0)}
                  </span>
                </Campo>
              )}
              {energia.demandaContratadaKw !== undefined && (
                <Campo rotulo="Demanda contratada / medida">
                  <span className="tabular">
                    {formatarKw(energia.demandaContratadaKw)} / {energia.demandaMedidaKw !== undefined ? formatarKw(energia.demandaMedidaKw) : "—"}
                  </span>
                </Campo>
              )}
              {energia.reativoExcedenteKvarh !== undefined && energia.reativoExcedenteKvarh > 0 && (
                <Campo rotulo="Energia reativa excedente">
                  <span className="tabular">{formatarNumero(energia.reativoExcedenteKvarh)} kVArh</span>
                </Campo>
              )}
              {energia.precoEnergiaLivreMwh !== undefined && (
                <Campo rotulo="Preço contratado (mercado livre)">
                  <span className="tabular">{formatarMoeda(energia.precoEnergiaLivreMwh)}/MWh</span>
                </Campo>
              )}
              {energia.custoEquivalenteCativo !== undefined && (
                <Campo rotulo="Custo estimado no mercado cativo">
                  <span className="tabular">{formatarMoeda(energia.custoEquivalenteCativo)}</span>
                </Campo>
              )}
            </dl>
            {energia.tipoFatura === "energia_livre" && (
              <p className="mt-3 text-xs text-subtle">
                O consumo desta fatura é o mesmo da fatura de distribuição — nos totais de kWh ele é contado uma vez só.
              </p>
            )}

            {energia.itens.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[420px] text-xs">
                  <caption className="sr-only">Itens da fatura</caption>
                  <thead className="bg-surface-2 text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Item da fatura
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Quantidade
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Preço
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {energia.itens.map((item, i) => (
                      <tr key={`${item.descricao}-${i}`}>
                        <td className="px-3 py-2 text-foreground">{item.descricao}</td>
                        <td className="tabular px-3 py-2 text-right text-muted">
                          {item.quantidade !== undefined
                            ? `${item.unidade === "MWh" ? formatarNumero2(item.quantidade) : formatarNumero(item.quantidade)} ${item.unidade ?? ""}`
                            : "—"}
                        </td>
                        <td className="tabular px-3 py-2 text-right text-muted">
                          {item.precoUnitario !== undefined ? formatarMoeda(item.precoUnitario) : "—"}
                        </td>
                        <td className="tabular px-3 py-2 text-right text-foreground">{formatarMoeda(item.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-2/60">
                      <th scope="row" colSpan={3} className="px-3 py-2 text-left font-semibold text-foreground">
                        Total
                      </th>
                      <td className="tabular px-3 py-2 text-right font-semibold text-foreground">{formatarMoeda(conta.valor)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {(energia.tributos.pis > 0 || energia.tributos.cofins > 0 || energia.tributos.icms > 0) && (
              <p className="tabular mt-3 text-xs text-muted">
                Tributos incluídos: PIS {formatarMoeda(energia.tributos.pis)} · COFINS {formatarMoeda(energia.tributos.cofins)} · ICMS{" "}
                {formatarMoeda(energia.tributos.icms)}
              </p>
            )}
            {condominio && (
              <ButtonLink href={`/energia/${condominio.slug}`} variante="contorno" tamanho="sm" className="mt-4">
                <Zap className="text-energy" aria-hidden />
                Ver análise de energia do condomínio
                <ArrowRight aria-hidden />
              </ButtonLink>
            )}
          </Secao>
        )}

        {conta.agua && (
          <Secao titulo="Água">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Campo rotulo="Consumo">
                <span className="tabular">{formatarNumero(conta.agua.consumoM3)} m³</span>
              </Campo>
              <Campo rotulo="Dias do ciclo">{conta.agua.dias} dias</Campo>
              <Campo rotulo="Consumo por dia">
                <span className="tabular">{formatarNumero1(conta.agua.consumoM3 / (conta.agua.dias || 30))} m³/dia</span>
              </Campo>
              <Campo rotulo="Custo por m³">
                <span className="tabular">{conta.agua.consumoM3 ? formatarMoeda(conta.valor / conta.agua.consumoM3) : "—"}</span>
              </Campo>
            </dl>
          </Secao>
        )}

        {conta.gas && (
          <Secao titulo="Gás">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Campo rotulo="Consumo">
                <span className="tabular">{formatarNumero(conta.gas.consumoM3)} m³</span>
              </Campo>
              <Campo rotulo="Custo por m³">
                <span className="tabular">{conta.gas.consumoM3 ? formatarMoeda(conta.valor / conta.gas.consumoM3) : "—"}</span>
              </Campo>
            </dl>
          </Secao>
        )}

        {condominio && (
          <div className="border-t border-border px-5 py-4 sm:px-6">
            <Link
              href={`/condominios/${condominio.slug}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver o condomínio
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
