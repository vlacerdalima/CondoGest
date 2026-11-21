"use client";

import { ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { estiloBotao } from "@/components/ui/button";
import type { FaturaFicticia } from "@/lib/gerador/tipos";

/**
 * Prévia do PDF num iframe (blob URL). O motor de PDF é carregado sob demanda
 * e o documento é refeito quando a fatura muda (com um pequeno atraso).
 */
export function PreviaPdf({ fatura }: { fatura: FaturaFicticia }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const urlAtual = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      setGerando(true);
      setErro(null);
      try {
        const { gerarBlobPdf } = await import("@/lib/gerador/pdf/navegador");
        const blob = await gerarBlobPdf(fatura);
        if (cancelado) return;
        const novo = URL.createObjectURL(blob);
        if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
        urlAtual.current = novo;
        setUrl(novo);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        if (!cancelado) setGerando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [fatura]);

  useEffect(
    () => () => {
      if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
    },
    [],
  );

  if (erro) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical-soft p-4 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
        <p>
          Não foi possível montar a prévia do PDF ({erro}). O resumo e o botão de download continuam funcionando; tente de
          novo em instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2">
        {url && (
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title="Prévia do PDF da conta fictícia"
            className="h-[70vh] max-h-[52rem] min-h-[26rem] w-full bg-white"
          />
        )}
        {gerando && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface/70 text-sm text-muted backdrop-blur-[1px]">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {url ? "Atualizando o PDF…" : "Montando o PDF (a primeira vez demora alguns segundos)…"}
          </div>
        )}
      </div>
      {url && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>No celular a prévia pode não aparecer: abra o PDF numa nova aba.</span>
          <a href={url} target="_blank" rel="noreferrer" className={estiloBotao("contorno", "sm")}>
            <ExternalLink aria-hidden />
            Abrir em nova aba
          </a>
        </div>
      )}
    </div>
  );
}
