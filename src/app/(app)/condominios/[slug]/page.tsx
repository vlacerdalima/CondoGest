import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/components/gestao/carregando";
import { DetalheCondominio } from "@/components/gestao/condominios/detalhe-condominio";
import { CONDOMINIOS, obterCondominio } from "@/lib/dados";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return CONDOMINIOS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: obterCondominio(slug)?.nome ?? "Condomínio" };
}

/** Lê o slug dentro do Suspense: a casca da página fica pronta na hora (navegação instantânea) */
async function Conteudo({ params }: { params: Params }) {
  const { slug } = await params;
  const condominio = obterCondominio(slug);
  if (!condominio) notFound();
  return <DetalheCondominio condominioId={condominio.id} />;
}

export default function Pagina({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Carregando titulo="Condomínio" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
