"use client";

import { useMemo } from "react";
import { gerarTodosInsights } from "@/lib/analise/geral";
import { CONDOMINIOS } from "@/lib/dados";
import { useContas } from "@/lib/dados/store";

/** Contas (demo + enviadas) e todos os insights (gerais + energia), memoizados */
export function useCarteira() {
  const contas = useContas();
  const insights = useMemo(() => gerarTodosInsights(contas, CONDOMINIOS), [contas]);
  return { contas, insights };
}
