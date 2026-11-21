"use client";

import { Inbox, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page-header";
import { obterCondominio, statusDaConta } from "@/lib/dados";
import { removerContaEnviada, restaurarDemonstracao, useContas, useContasEnviadas } from "@/lib/dados/store";
import { formatarCompetencia, formatarMoeda, ROTULOS_CATEGORIA } from "@/lib/formatacao";
import { IconeCategoria } from "../categoria";
import { formatarDataHora } from "../formato";

/** Lista das contas enviadas neste navegador, com remover e "Restaurar demonstração" */
export function ContasEnviadas() {
  const enviadas = useContasEnviadas();
  // Pagamentos aplicados (o status de uma enviada pode ter mudado na tela de Contas)
  const todas = useContas();
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [restaurado, setRestaurado] = useState(false);

  const lista = [...enviadas]
    .sort((a, b) => (b.enviadaEm ?? "").localeCompare(a.enviadaEm ?? ""))
    .map((c) => todas.find((t) => t.id === c.id) ?? c);

  return (
    <Card>
      <CardHeader
        titulo="Contas enviadas por você"
        descricao={
          enviadas.length
            ? `${enviadas.length} ${enviadas.length === 1 ? "conta enviada" : "contas enviadas"} neste navegador`
            : "As contas que você enviar aparecem aqui"
        }
        acoes={
          !confirmarRestauracao && (
            <Button
              variante="fantasma"
              tamanho="sm"
              onClick={() => {
                setConfirmarRestauracao(true);
                setRestaurado(false);
              }}
            >
              <RotateCcw aria-hidden />
              Restaurar demonstração
            </Button>
          )
        }
      />
      <CardContent>
        {confirmarRestauracao && (
          <div role="alert" className="mb-4 rounded-lg border border-critical/30 bg-critical-soft p-4 text-sm">
            <p className="font-semibold text-foreground">Voltar a demonstração ao estado original?</p>
            <p className="mt-1 text-muted">
              Isso apaga {enviadas.length ? `as ${enviadas.length} contas enviadas` : "as contas enviadas"} e todos os pagamentos que
              você marcou neste navegador. Não dá para desfazer.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variante="perigo"
                tamanho="sm"
                onClick={() => {
                  restaurarDemonstracao();
                  setConfirmarRestauracao(false);
                  setRestaurado(true);
                }}
              >
                Sim, restaurar
              </Button>
              <Button variante="contorno" tamanho="sm" onClick={() => setConfirmarRestauracao(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {restaurado && (
          <p role="status" className="mb-4 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            Pronto: a demonstração voltou ao estado original.
          </p>
        )}

        {lista.length === 0 ? (
          <EmptyState
            icone={<Inbox aria-hidden />}
            titulo="Nenhuma conta enviada ainda"
            descricao="Envie a primeira conta acima — ela entra no painel, nas análises e na lista de contas na hora."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lista.map((c) => {
              const condominio = obterCondominio(c.condominioId);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <IconeCategoria categoria={c.categoria} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contas?conta=${encodeURIComponent(c.id)}`}
                      className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {c.descricao}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                      <span>{condominio?.nome}</span>
                      <span aria-hidden>·</span>
                      <span>{ROTULOS_CATEGORIA[c.categoria]}</span>
                      <span aria-hidden>·</span>
                      <span>{formatarCompetencia(c.competencia)}</span>
                      {c.enviadaEm && (
                        <>
                          <span aria-hidden>·</span>
                          <span>enviada em {formatarDataHora(c.enviadaEm)}</span>
                        </>
                      )}
                      {c.arquivoNome && (
                        <span className="inline-flex max-w-full items-center gap-1 truncate">
                          <Paperclip className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{c.arquivoNome}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold text-foreground">{formatarMoeda(c.valor)}</span>
                  <StatusBadge status={statusDaConta(c)} />
                  {confirmarId === c.id ? (
                    <span className="flex items-center gap-1.5" role="group" aria-label="Confirmar remoção">
                      <span className="text-xs text-muted">Remover?</span>
                      <Button
                        variante="perigo"
                        tamanho="sm"
                        onClick={() => {
                          removerContaEnviada(c.id);
                          setConfirmarId(null);
                        }}
                      >
                        Sim
                      </Button>
                      <Button variante="contorno" tamanho="sm" onClick={() => setConfirmarId(null)}>
                        Não
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => setConfirmarId(c.id)}
                      aria-label={`Remover ${c.descricao}`}
                    >
                      <Trash2 aria-hidden />
                      Remover
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
