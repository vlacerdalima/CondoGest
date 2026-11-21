import { Navegacao } from "@/components/layout/navegacao";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Navegacao />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
