import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EnergiaCondominio } from "@/components/energia/energia-condominio";
import { CarregandoEnergia } from "@/components/energia/carregando";
import { CONDOMINIOS, obterCondominio } from "@/lib/dados";

export function generateStaticParams() {
  return CONDOMINIOS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/energia/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const condominio = obterCondominio(slug);
  return { title: condominio ? `Energia · ${condominio.nome}` : "Energia" };
}

async function Conteudo({ params }: Pick<PageProps<"/energia/[slug]">, "params">) {
  const { slug } = await params;
  const condominio = obterCondominio(slug);
  if (!condominio) notFound();
  return <EnergiaCondominio condominioId={condominio.id} />;
}

export default function Pagina(props: PageProps<"/energia/[slug]">) {
  return (
    <Suspense fallback={<CarregandoEnergia />}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
