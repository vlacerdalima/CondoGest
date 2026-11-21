import { cn } from "@/lib/utils";

/** Símbolo do CondoGest: prédio dentro de um anel aberto, com o raio de energia na abertura. */
export function LogoSimbolo({ className, titulo = "CondoGest" }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8", className)} role="img" aria-label={titulo}>
      <defs>
        <mask id="condogest-janelas">
          <rect width="48" height="48" fill="white" />
          {/* janelas e porta recortadas */}
          <rect x="19" y="23" width="3.2" height="3.2" rx="0.4" fill="black" />
          <rect x="25.8" y="23" width="3.2" height="3.2" rx="0.4" fill="black" />
          <rect x="19" y="28.4" width="3.2" height="3.2" rx="0.4" fill="black" />
          <rect x="25.8" y="28.4" width="3.2" height="3.2" rx="0.4" fill="black" />
          <rect x="12.6" y="29" width="1.8" height="2.6" rx="0.3" fill="black" />
          <rect x="33.6" y="29" width="1.8" height="2.6" rx="0.3" fill="black" />
          <rect x="21.8" y="33.6" width="4.4" height="5.4" rx="0.4" fill="black" />
        </mask>
      </defs>
      <path
        d="M42.79 17.16A20 20 0 1 1 27.47 4.3"
        fill="none"
        stroke="#0b8a80"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path d="M12.5 21.6 24 14.6l11.5 7" fill="none" stroke="#0b8a80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#0b8a80" mask="url(#condogest-janelas)">
        <rect x="16.5" y="20.5" width="15" height="18.5" rx="0.8" />
        <rect x="11" y="26.5" width="5.5" height="12.5" rx="0.6" />
        <rect x="31.5" y="26.5" width="5.5" height="12.5" rx="0.6" />
      </g>
      <path d="M38.6 1.6 31.6 10.6h4.6l-2.6 6.6 7.6-9.6h-4.6l2-6Z" fill="#f4b42c" />
    </svg>
  );
}

export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoSimbolo className="size-8 shrink-0" />
      {!compacto && (
        <span className="text-[1.35rem] leading-none font-extrabold tracking-tight text-[#0b8a80] dark:text-primary">
          CondoGest
        </span>
      )}
    </span>
  );
}
