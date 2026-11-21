import { ArrowRight, BarChart3, ReceiptText, Upload, Zap } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { ButtonLink } from "@/components/ui/button";

const PILARES = [
  {
    icone: ReceiptText,
    titulo: "Contas organizadas",
    texto: "Energia, água, gás e fornecedores de todos os condomínios da carteira num só lugar, com vencimentos e histórico.",
  },
  {
    icone: Zap,
    titulo: "Energia em foco",
    texto: "Consumo normalizado por dia, demanda, horário de ponta e mercado livre — com recomendações de economia em R$.",
  },
  {
    icone: BarChart3,
    titulo: "Insights para decidir",
    texto: "Alertas de desvios, comparação entre condomínios e um resumo pronto para levar à assembleia.",
  },
  {
    icone: Upload,
    titulo: "Envio simples de contas",
    texto: "Arraste o PDF da conta: o CondoGest lê os dados, você confere e pronto — o painel se atualiza na hora.",
  },
];

export default function Inicio() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <ButtonLink href="/painel" variante="contorno" tamanho="sm">
          Entrar
        </ButtonLink>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-energy-soft px-3 py-1 text-sm font-medium text-energy">
            <Zap className="size-4" aria-hidden />
            Gestão de condomínios com foco em energia
          </p>
          <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-foreground sm:text-5xl">
            O custo das áreas comuns, <span className="text-primary">claro e sob controle</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            O CondoGest organiza as contas da sua carteira de condomínios, mostra onde o dinheiro está indo e
            transforma a conta de energia — normalmente o maior custo variável — em decisões com número.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/painel" tamanho="lg">
              Entrar na demonstração
              <ArrowRight aria-hidden />
            </ButtonLink>
            <ButtonLink href="/energia" tamanho="lg" variante="contorno">
              <Zap className="text-energy" aria-hidden />
              Ver a tela de energia
            </ButtonLink>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo} className="rounded-xl border border-border bg-surface p-5">
              <Icone className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold text-foreground">{titulo}</h2>
              <p className="mt-1 text-sm text-muted">{texto}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-subtle sm:px-6">
        MVP acadêmico · todos os dados exibidos são fictícios.
      </footer>
    </div>
  );
}
