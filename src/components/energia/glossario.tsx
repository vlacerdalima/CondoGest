"use client";

import { BookOpen, HelpCircle } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Termos inevitáveis, em linguagem de síndico */
export const GLOSSARIO = {
  kwhDia: {
    termo: "kWh por dia",
    texto: "O consumo da conta dividido pelos dias de leitura. Cada conta tem de 28 a 33 dias; dividir pelos dias deixa os meses comparáveis.",
  },
  linhaDeBase: {
    termo: "Linha de base",
    texto: "O consumo \"normal\" do condomínio: a média dos 12 meses anteriores, sem os meses com anomalia. É a régua para dizer se um mês está alto ou se uma ação economizou.",
  },
  demandaContratada: {
    termo: "Demanda contratada",
    texto: "A potência máxima (em kW) que o condomínio reserva na rede da distribuidora. Na média tensão ela é paga todo mês, usando ou não — como um plano de internet.",
  },
  demandaOciosa: {
    termo: "Demanda ociosa",
    texto: "A parte da demanda contratada que é paga e não é usada: a diferença entre o que se contrata e o pico realmente medido.",
  },
  horarioPonta: {
    termo: "Horário de ponta",
    texto: "3 horas seguidas no fim da tarde/noite, em dias úteis, em que a energia da média tensão custa várias vezes mais. O horário exato vem na conta da distribuidora.",
  },
  bandeira: {
    termo: "Bandeira tarifária",
    texto: "Um acréscimo no preço do kWh definido todo mês pela ANEEL: verde (sem acréscimo), amarela e vermelha (mais cara, quando as usinas térmicas são ligadas).",
  },
  mercadoLivre: {
    termo: "Mercado livre",
    texto: "Forma de comprar a energia de uma comercializadora, com preço negociado em contrato. A energia chega pelos mesmos fios; o uso da rede continua sendo pago à distribuidora.",
  },
  mercadoCativo: {
    termo: "Mercado cativo",
    texto: "O jeito tradicional: a energia é comprada da própria distribuidora, pela tarifa da tabela, com bandeira tarifária.",
  },
  tusdTe: {
    termo: "TUSD e TE",
    texto: "As duas partes do preço do kWh: TUSD é o uso da rede (fios da distribuidora); TE é a energia em si. No mercado livre, a TE é trocada pelo preço da comercializadora.",
  },
  fatorPotencia: {
    termo: "Fator de potência e reativo",
    texto: "Motores puxam da rede uma energia \"de sobra\" (reativa) que não vira trabalho. Se o fator de potência fica abaixo de 0,92, a distribuidora cobra multa (reativo excedente).",
  },
  mediaTensao: {
    termo: "Média e baixa tensão",
    texto: "Média tensão (grupo A, subgrupo A4): conta com demanda contratada e preço diferente na ponta. Baixa tensão (grupo B): conta comum, cobrada só pelo kWh.",
  },
  assinatura: {
    termo: "Assinatura de energia",
    texto: "Geração compartilhada: o condomínio recebe créditos de uma usina solar de terceiros e paga por eles com desconto sobre a tarifa, sem obra.",
  },
  payback: {
    termo: "Retorno (payback)",
    texto: "Em quantos meses a economia paga o investimento da ação.",
  },
} satisfies Record<string, { termo: string; texto: string }>;

export type ChaveGlossario = keyof typeof GLOSSARIO;

/**
 * Termo com explicação curta (dica). Abre no foco, no hover e no toque;
 * acessível por teclado (botão com aria-describedby).
 */
export function Termo({ id, children, className }: { id: ChaveGlossario; children?: ReactNode; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const idDica = useId();
  const g = GLOSSARIO[id];
  return (
    <span className={cn("relative inline-flex items-baseline", className)}>
      <button
        type="button"
        className="inline-flex items-baseline gap-0.5 rounded-sm border-b border-dotted border-current/60 text-left font-[inherit] text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-describedby={aberto ? idDica : undefined}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
      >
        {children ?? g.termo}
        <HelpCircle className="size-3 shrink-0 self-center text-subtle" aria-hidden />
      </button>
      {aberto && (
        <span
          id={idDica}
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-1.5 w-64 max-w-[80vw] rounded-lg border border-border bg-surface p-3 text-left text-xs leading-relaxed font-normal text-foreground normal-case shadow-lg"
        >
          <span className="mb-0.5 block font-semibold">{g.termo}</span>
          {g.texto}
        </span>
      )}
    </span>
  );
}

export function CardGlossario({ termos }: { termos?: ChaveGlossario[] }) {
  const chaves = termos ?? (Object.keys(GLOSSARIO) as ChaveGlossario[]);
  return (
    <Card>
      <CardHeader
        icone={<BookOpen className="size-5" aria-hidden />}
        titulo="Glossário rápido"
        descricao="Os poucos termos técnicos que aparecem nesta tela, em uma frase."
      />
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {chaves.map((k) => (
            <div key={k}>
              <dt className="text-sm font-semibold text-foreground">{GLOSSARIO[k].termo}</dt>
              <dd className="mt-0.5 text-sm text-muted">{GLOSSARIO[k].texto}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
