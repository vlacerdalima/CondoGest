"use client";

import { Flag, Sun } from "lucide-react";
import type { AnaliseUc, ResumoBandeiras } from "@/lib/analise/energia";
import { ROTULOS_BANDEIRA, soma } from "@/lib/analise/energia";
import { formatarCompetencia, formatarMoeda, formatarNumero, formatarTarifa } from "@/lib/formatacao";
import type { Bandeira } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ChaveCor } from "./graficos-base";
import { pct, reais } from "./formato";
import { Termo } from "./glossario";

/* ------------------------------------------------------------------ */
/* Barra segmentada alta (parte de um todo)                            */
/* ------------------------------------------------------------------ */

interface Segmento {
  rotulo: string;
  valor: number;
  cor: string;
  /** Cor do texto dentro do bloco (branco ou quase preto, pela luminância) */
  texto: string;
  detalhe: string;
}

function BarraSegmentada({ titulo, segmentos }: { titulo: string; segmentos: Segmento[] }) {
  const total = soma(segmentos.map((s) => s.valor));
  const descricao = segmentos.map((s) => `${s.rotulo}: ${pct(total > 0 ? s.valor / total : 0)} (${s.detalhe})`).join("; ");
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground">{titulo}</p>
      <div className="flex h-7 w-full gap-0.5" role="img" aria-label={`${titulo}: ${descricao}`}>
        {segmentos.map((s) => {
          const parte = total > 0 ? s.valor / total : 0;
          if (parte <= 0) return null;
          return (
            <div
              key={s.rotulo}
              className="flex h-full min-w-1 items-center overflow-visible rounded-[4px] px-2 text-xs font-semibold"
              style={{ width: `${parte * 100}%`, background: s.cor, color: s.texto }}
              title={`${s.rotulo}: ${pct(parte)} — ${s.detalhe}`}
            >
              {parte >= 0.12 && <span className="tabular">{pct(parte)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ponta × fora de ponta                                               */
/* ------------------------------------------------------------------ */

const COR_PONTA = "var(--chart-4)";
const COR_FORA = "var(--chart-3)";

export function PontaForaPonta({ analise }: { analise: AnaliseUc }) {
  const janela = (analise.janela.length ? analise.janela : analise.meses.slice(-12)).filter((m) => m.pontaKwh !== undefined);
  const { ponta, foraPonta } = analise.tarifas;
  if (!janela.length || ponta === undefined || foraPonta === undefined) return null;
  const kwhPonta = soma(janela.map((m) => m.pontaKwh!));
  const kwhFora = soma(janela.map((m) => m.foraPontaKwh ?? m.kwh - m.pontaKwh!));
  const rPonta = kwhPonta * ponta;
  const rFora = kwhFora * foraPonta;
  const razao = foraPonta > 0 ? ponta / foraPonta : 0;
  const livre = analise.uc.ambiente === "livre";
  const parcelaKwh = kwhPonta / Math.max(1, kwhPonta + kwhFora);
  const parcelaReais = rPonta / Math.max(1, rPonta + rFora);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <ChaveCor cor={COR_PONTA} forma="barra" />
            <Termo id="horarioPonta">Na ponta</Termo>
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatarTarifa(ponta)}</p>
          <p className="text-xs text-muted">3 horas no fim da tarde, dias úteis</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <ChaveCor cor={COR_FORA} forma="barra" />
            Fora da ponta
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatarTarifa(foraPonta)}</p>
          <p className="text-xs text-muted">as outras 21 horas e fins de semana</p>
        </div>
        <div className="rounded-xl border border-energy-strong/50 bg-energy-soft/40 p-4">
          <p className="text-sm text-muted">Diferença</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {razao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× mais caro
          </p>
          <p className="text-xs text-muted">cada kWh consumido na ponta</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <BarraSegmentada
          titulo="Parte do consumo (kWh)"
          segmentos={[
            { rotulo: "Na ponta", valor: kwhPonta, cor: COR_PONTA, texto: "#1f1600", detalhe: `${formatarNumero(kwhPonta)} kWh` },
            { rotulo: "Fora da ponta", valor: kwhFora, cor: COR_FORA, texto: "#ffffff", detalhe: `${formatarNumero(kwhFora)} kWh` },
          ]}
        />
        <BarraSegmentada
          titulo="Parte do valor pago pelo consumo (R$)"
          segmentos={[
            { rotulo: "Na ponta", valor: rPonta, cor: COR_PONTA, texto: "#1f1600", detalhe: reais(rPonta) },
            { rotulo: "Fora da ponta", valor: rFora, cor: COR_FORA, texto: "#ffffff", detalhe: reais(rFora) },
          ]}
        />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li className="inline-flex items-center gap-1.5">
            <ChaveCor cor={COR_PONTA} forma="barra" /> Na ponta
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ChaveCor cor={COR_FORA} forma="barra" /> Fora da ponta
          </li>
        </ul>
      </div>
      <p className="text-sm text-muted">
        Em {janela.length} meses, <strong className="text-foreground">{pct(parcelaKwh)} do consumo</strong> caiu no horário de
        ponta, mas ele respondeu por <strong className="text-foreground">{pct(parcelaReais)} do valor</strong> pago pelo
        consumo.{" "}
        {livre ? (
          <>
            No mercado livre a energia tem preço único; a diferença está na parte da distribuidora (<Termo id="tusdTe">TUSD</Termo>).
          </>
        ) : (
          "Mudar bombas e filtragem de horário reduz a conta sem reduzir o serviço."
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeiras                                                           */
/* ------------------------------------------------------------------ */

const ESTILO_BANDEIRA: Record<Bandeira, { cor: string; fundo: string }> = {
  verde: { cor: "var(--ok)", fundo: "var(--ok-soft)" },
  amarela: { cor: "var(--warn)", fundo: "var(--warn-soft)" },
  vermelha_1: { cor: "var(--serious)", fundo: "var(--serious-soft)" },
  vermelha_2: { cor: "var(--critical)", fundo: "var(--critical-soft)" },
  escassez_hidrica: { cor: "var(--critical)", fundo: "var(--critical-soft)" },
};

export function SeloBandeira({ bandeira, className }: { bandeira: Bandeira; className?: string }) {
  const e = ESTILO_BANDEIRA[bandeira];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}
      style={{ background: e.fundo, color: e.cor }}
    >
      <Flag className="size-3.5" aria-hidden />
      {ROTULOS_BANDEIRA[bandeira]}
    </span>
  );
}

export function ImpactoBandeiras({ resumo }: { resumo: ResumoBandeiras }) {
  if (!resumo.meses.length) return null;
  const caras = resumo.meses.filter((m) => m.bandeira !== "verde");
  const estimado = resumo.meses.some((m) => m.estimado);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-sm text-muted">Custo das bandeiras em {resumo.meses.length} meses</p>
          <p className="text-2xl font-semibold text-foreground">{reais(resumo.total)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Do gasto com energia</p>
          <p className="text-2xl font-semibold text-foreground">{pct(resumo.percentualDoGasto, 1)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Meses com bandeira amarela ou vermelha</p>
          <p className="text-2xl font-semibold text-foreground">{caras.length}</p>
        </div>
      </div>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {resumo.meses.map((m) => (
          <li key={m.competencia} className="rounded-lg border border-border p-2">
            <p className="text-xs font-medium text-muted">{formatarCompetencia(m.competencia)}</p>
            <SeloBandeira bandeira={m.bandeira} className="mt-1" />
            <p className="tabular mt-1 text-sm font-semibold text-foreground">{m.custo > 0 ? `+${reais(m.custo)}` : "—"}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        <Sun className="mr-1 inline size-4 align-[-3px] text-energy" aria-hidden />
        A <Termo id="bandeira">bandeira</Termo> fica mais cara quando chove pouco e as usinas térmicas são ligadas — no Nordeste,
        isso costuma acontecer no 2º semestre.
        {resumo.temLivre && " Contas no mercado livre não pagam bandeira sobre a energia."}
        {estimado && " Alguns valores foram estimados porque a conta não traz o item da bandeira."}
      </p>
      <p className="sr-only">
        {resumo.meses.map((m) => `${formatarCompetencia(m.competencia)}: bandeira ${ROTULOS_BANDEIRA[m.bandeira]}, ${formatarMoeda(m.custo)}`).join(". ")}
      </p>
    </div>
  );
}
