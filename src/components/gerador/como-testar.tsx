import { Download, LayoutDashboard, ListChecks, Upload } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PASSOS = [
  {
    icone: Download,
    titulo: "Gere e baixe",
    texto: "Escolha a UC e a competência (o padrão já é o mês seguinte ao da demonstração) e baixe o PDF.",
  },
  {
    icone: Upload,
    titulo: "Envie a conta",
    texto: (
      <>
        Vá em{" "}
        <Link href="/contas/enviar" className="font-medium text-primary underline-offset-2 hover:underline">
          Enviar conta
        </Link>{" "}
        e arraste o PDF. Mercado livre: envie as duas faturas.
      </>
    ),
  },
  {
    icone: ListChecks,
    titulo: "Confira os dados lidos",
    texto: "Condomínio, UC, valor, vencimento e consumo vêm preenchidos a partir do arquivo. Revise e salve.",
  },
  {
    icone: LayoutDashboard,
    titulo: "Veja o painel atualizado",
    texto: (
      <>
        O mês novo aparece no{" "}
        <Link href="/painel" className="font-medium text-primary underline-offset-2 hover:underline">
          Painel
        </Link>
        , em{" "}
        <Link href="/contas" className="font-medium text-primary underline-offset-2 hover:underline">
          Contas
        </Link>{" "}
        e em{" "}
        <Link href="/energia" className="font-medium text-primary underline-offset-2 hover:underline">
          Energia
        </Link>
        .
      </>
    ),
  },
];

export function ComoTestar() {
  return (
    <Card>
      <CardHeader
        titulo="Como testar o fluxo completo"
        descricao="Do PDF ao painel em quatro passos. Para pular o envio, use “Adicionar direto à plataforma”."
      />
      <CardContent>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PASSOS.map((p, i) => {
            const Icone = p.icone;
            return (
              <li key={p.titulo} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Icone className="size-4 text-muted" aria-hidden />
                    {p.titulo}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{p.texto}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
