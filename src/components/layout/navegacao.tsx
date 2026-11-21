"use client";

import {
  Building2,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Menu,
  ReceiptText,
  Upload,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/marca/logo";
import { estiloBotao } from "@/components/ui/button";
import { ADMINISTRADORA, DATA_REFERENCIA } from "@/lib/dados";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

interface ItemNav {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  energia?: boolean;
  /** Rotas filhas que NÃO devem acender este item */
  exceto?: string[];
}

const PRINCIPAL: ItemNav[] = [
  { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/energia", rotulo: "Energia", icone: Zap, energia: true },
  { href: "/condominios", rotulo: "Condomínios", icone: Building2 },
  { href: "/contas", rotulo: "Contas", icone: ReceiptText, exceto: ["/contas/enviar"] },
  { href: "/insights", rotulo: "Insights", icone: Lightbulb },
];

const FERRAMENTAS: ItemNav[] = [
  { href: "/ferramentas/gerador-de-contas", rotulo: "Gerador de contas", icone: FlaskConical },
];

function ativo(pathname: string, item: ItemNav) {
  if (item.exceto?.some((e) => pathname.startsWith(e))) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ListaNav({ itens, pathname, aoNavegar }: { itens: ItemNav[]; pathname: string; aoNavegar?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {itens.map((item) => {
        const estaAtivo = ativo(pathname, item);
        const Icone = item.icone;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={aoNavegar}
              aria-current={estaAtivo ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                estaAtivo ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icone
                className={cn("size-[18px]", item.energia && (estaAtivo ? "text-energy" : "text-energy/80"))}
                aria-hidden
              />
              {item.rotulo}
              {item.energia && (
                <span className="ml-auto rounded-full bg-energy-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-energy uppercase">
                  Foco
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ConteudoNav({ pathname, aoNavegar }: { pathname: string; aoNavegar?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/painel" onClick={aoNavegar} className="px-2">
        <Logo />
      </Link>

      <Link href="/contas/enviar" onClick={aoNavegar} className={estiloBotao("primaria", "md", "mx-1")}>
        <Upload aria-hidden />
        Enviar conta
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-5">
        <ListaNav itens={PRINCIPAL} pathname={pathname} aoNavegar={aoNavegar} />
        <div>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-subtle uppercase">Ferramentas</p>
          <ListaNav itens={FERRAMENTAS} pathname={pathname} aoNavegar={aoNavegar} />
        </div>
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-surface-2/60 p-3 text-xs">
        <p className="font-semibold text-foreground">{ADMINISTRADORA.nome}</p>
        <p className="text-muted">
          {ADMINISTRADORA.gestor.nome} · {ADMINISTRADORA.gestor.cargo}
        </p>
        <p className="mt-2 text-subtle">Demonstração · dados fictícios · ref. {formatarData(DATA_REFERENCIA)}</p>
      </div>
    </div>
  );
}

export function Navegacao() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-surface lg:block">
        <ConteudoNav pathname={pathname} />
      </aside>

      {/* Mobile: barra superior + gaveta */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/painel">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={estiloBotao("fantasma", "icone")}
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <Menu />
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className={estiloBotao("fantasma", "icone", "absolute top-4 right-3")}
              aria-label="Fechar menu"
            >
              <X />
            </button>
            <ConteudoNav pathname={pathname} aoNavegar={() => setAberto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
