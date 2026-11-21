import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CarregandoEnergia } from "@/components/energia/carregando";
import { FalaAssembleia } from "@/components/energia/fala-assembleia";
import { CONDOMINIOS, obterCondominio } from "@/lib/dados";

export function generateStaticParams() {
  return CONDOMINIOS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/energia/[slug]/assembleia">): Promise<Metadata> {
  const { slug } = await params;
  const condominio = obterCondominio(slug);
  return { title: condominio ? `Assembleia · ${condominio.nome}` : "Assembleia" };
}

async function Conteudo({ params }: Pick<PageProps<"/energia/[slug]/assembleia">, "params">) {
  const { slug } = await params;
  const condominio = obterCondominio(slug);
  if (!condominio) notFound();
  return <FalaAssembleia condominioId={condominio.id} />;
}

export default function Pagina(props: PageProps<"/energia/[slug]/assembleia">) {
  // useSearchParams (?acao=) no cliente exige Suspense
  return (
    <Suspense fallback={<CarregandoEnergia />}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
