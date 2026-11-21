/** Esqueleto exibido enquanto telas que dependem da URL carregam no navegador */
export function Carregando({ titulo }: { titulo: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">{titulo}</h1>
        <div className="mt-2 h-4 w-2/3 max-w-md animate-pulse rounded bg-surface-2" />
      </div>
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
